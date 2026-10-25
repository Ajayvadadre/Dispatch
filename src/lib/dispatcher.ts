import { and, asc, eq, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { articles, deliveries, doctors, runs, type Article, type RunKind } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getProvider } from "@/lib/email/providers";
import { renderEmail } from "@/lib/email/template";
import { nextOccurrence } from "@/lib/schedule";
import { deletePdf, readPdf } from "@/lib/storage";

interface SchedulerState {
  started: boolean;
  ticking: boolean;
  working: boolean;
  lastTickAt: Date | null;
  lastError: string | null;
  lastRetentionAt: number;
}

const g = globalThis as unknown as { __dispatchScheduler?: SchedulerState; __dispatchTick?: () => Promise<void> };
const state: SchedulerState = (g.__dispatchScheduler ??= {
  started: false,
  ticking: false,
  working: false,
  lastTickAt: null,
  lastError: null,
  lastRetentionAt: 0,
});

export const schedulerState = () => state;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Scheduler loop ──────────────────────────────────────────────────────────

export function startScheduler() {
  if (state.started) return;
  state.started = true;
  // Go through globalThis so the timer always calls the latest code after a dev hot-reload.
  const run = () =>
    (g.__dispatchTick ?? tick)().catch((err) => {
      state.lastError = err instanceof Error ? err.message : String(err);
      console.error("[scheduler]", err);
    });
  void (async () => {
    const db = await getDb();
    // Anything mid-send when the app stopped goes back in the queue.
    await db.update(deliveries).set({ status: "pending" }).where(eq(deliveries.status, "sending"));
    await run();
  })();
  setInterval(run, env.scheduler.intervalSeconds * 1000).unref?.();
  console.log(`[scheduler] started · checking every ${env.scheduler.intervalSeconds}s · provider: ${env.email.provider}`);
}

g.__dispatchTick = tick;

async function tick() {
  if (state.ticking) return;
  state.ticking = true;
  try {
    const db = await getDb();
    await queueDueArticles(db);
    await finalizeRuns(db);
    kickWorker();
    if (Date.now() - state.lastRetentionAt > 60 * 60 * 1000) {
      state.lastRetentionAt = Date.now();
      await applyRetention(db);
    }
    state.lastTickAt = new Date();
    state.lastError = null;
  } finally {
    state.ticking = false;
  }
}

/** Turns due article schedules into send runs, recording any occurrences missed while the app was off. */
async function queueDueArticles(db: Db) {
  const now = new Date();
  const grace = env.scheduler.graceMinutes * 60_000;
  const due = await db
    .select()
    .from(articles)
    .where(and(eq(articles.status, "active"), isNotNull(articles.nextRunAt), lte(articles.nextRunAt, now)));

  for (const article of due) {
    const missed: Date[] = [];
    let fire: Date | null = null;
    let occurrence: Date | null = article.nextRunAt;
    while (occurrence && occurrence <= now) {
      if (now.getTime() - occurrence.getTime() <= grace) {
        if (fire) missed.push(fire);
        fire = occurrence;
      } else if (missed.length < 20) {
        missed.push(occurrence);
      }
      occurrence = nextOccurrence(article, occurrence);
    }

    // Once a scheduled send goes out the article stops: recurring ones pause (Resume picks up
    // the next occurrence), one-time ones finish.
    // Claim the occurrence: only one caller can move next_run_at forward from this value.
    const claimed = await db
      .update(articles)
      .set({
        nextRunAt: occurrence,
        status: !occurrence ? "completed" : fire ? "paused" : "active",
        lastRunAt: fire ?? article.lastRunAt,
        updatedAt: now,
      })
      .where(and(eq(articles.id, article.id), eq(articles.nextRunAt, article.nextRunAt!)))
      .returning({ id: articles.id });
    if (!claimed.length) continue;

    for (const at of missed) {
      await db.insert(runs).values({
        articleId: article.id,
        kind: "scheduled",
        status: "missed",
        scheduledFor: at,
        note: "The app wasn't running at the scheduled time.",
        finishedAt: now,
      });
    }
    if (fire) {
      await createRun(db, article.id, "scheduled", await activeRecipients(db), fire);
      console.log(`[scheduler] queued "${article.title}" for ${fire.toISOString()}`);
    }
  }
}

// ─── Runs ────────────────────────────────────────────────────────────────────

interface Recipient {
  email: string;
  name: string;
  doctorId: number | null;
}

async function activeRecipients(db: Db): Promise<Recipient[]> {
  const rows = await db
    .select({ email: doctors.email, name: doctors.name, doctorId: doctors.id })
    .from(doctors)
    .where(eq(doctors.active, true))
    .orderBy(asc(doctors.id));
  return rows;
}

async function createRun(db: Db, articleId: number, kind: RunKind, recipients: Recipient[], scheduledFor: Date) {
  const run = await db.transaction(async (tx) => {
    const empty = recipients.length === 0;
    const [created] = await tx
      .insert(runs)
      .values({
        articleId,
        kind,
        scheduledFor,
        total: recipients.length,
        status: empty ? "failed" : "queued",
        note: empty ? "There were no active doctors on the list." : null,
        finishedAt: empty ? new Date() : null,
      })
      .returning();
    for (let i = 0; i < recipients.length; i += 500) {
      await tx.insert(deliveries).values(recipients.slice(i, i + 500).map((r) => ({ runId: created.id, ...r })));
    }
    return created;
  });
  kickWorker();
  return run;
}

export function assertProviderReady() {
  const errors = getProvider().configErrors();
  if (errors.length) throw new Error(`Email isn't configured yet: ${errors.join("; ")}`);
}

export async function sendNow(articleId: number) {
  assertProviderReady();
  const db = await getDb();
  await db.update(articles).set({ lastRunAt: new Date() }).where(eq(articles.id, articleId));
  return createRun(db, articleId, "manual", await activeRecipients(db), new Date());
}

export async function sendTest(articleId: number, email: string, name: string) {
  assertProviderReady();
  const db = await getDb();
  return createRun(db, articleId, "test", [{ email, name, doctorId: null }], new Date());
}

export async function retryFailed(runId: number) {
  assertProviderReady();
  const db = await getDb();
  const reset = await db
    .update(deliveries)
    .set({ status: "pending", error: null })
    .where(and(eq(deliveries.runId, runId), eq(deliveries.status, "failed")))
    .returning({ id: deliveries.id });
  if (reset.length) {
    await db.update(runs).set({ status: "sending", finishedAt: null }).where(eq(runs.id, runId));
    await refreshRunCounts(db, runId);
    kickWorker();
  }
  return reset.length;
}

export async function cancelRun(runId: number) {
  const db = await getDb();
  await db
    .update(deliveries)
    .set({ status: "cancelled" })
    .where(and(eq(deliveries.runId, runId), eq(deliveries.status, "pending")));
  await db
    .update(runs)
    .set({ status: "cancelled", finishedAt: new Date(), note: "Stopped manually." })
    .where(and(eq(runs.id, runId), inArray(runs.status, ["queued", "sending"])));
  await refreshRunCounts(db, runId);
}

async function refreshRunCounts(db: Db, runId: number) {
  await db.execute(sql`
    UPDATE runs SET
      sent = (SELECT count(*) FROM deliveries WHERE run_id = ${runId} AND status = 'sent'),
      failed = (SELECT count(*) FROM deliveries WHERE run_id = ${runId} AND status = 'failed')
    WHERE id = ${runId}`);
}

async function finalizeRuns(db: Db) {
  await db.execute(sql`
    UPDATE runs r SET
      status = CASE WHEN r.failed >= r.total THEN 'failed' WHEN r.failed > 0 THEN 'partial' ELSE 'completed' END,
      finished_at = now()
    WHERE r.status IN ('queued', 'sending')
      AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.run_id = r.id AND d.status IN ('pending', 'sending'))`);
}

// ─── Delivery worker ─────────────────────────────────────────────────────────

export function kickWorker() {
  if (state.working) return;
  void work().catch((err) => console.error("[worker]", err));
}

interface Claimed {
  id: number;
  run_id: number;
  email: string;
  name: string;
}

async function claimNext(db: Db): Promise<Claimed | undefined> {
  // Test sends jump the queue so "Send test" responds instantly even mid-campaign.
  const res = await db.execute(sql`
    UPDATE deliveries SET status = 'sending', attempts = attempts + 1
    WHERE id = (
      SELECT d.id FROM deliveries d JOIN runs r ON r.id = d.run_id
      WHERE d.status = 'pending' AND r.status IN ('queued', 'sending')
      ORDER BY (r.kind = 'test') DESC, d.id
      LIMIT 1 FOR UPDATE OF d SKIP LOCKED)
    RETURNING id, run_id, email, name`);
  return res.rows[0] as unknown as Claimed | undefined;
}

async function work() {
  state.working = true;
  const db = await getDb();
  const provider = getProvider();
  const gap = 60_000 / env.email.ratePerMinute;
  const cache = new Map<number, { article: Article; pdf: Buffer }>();

  try {
    for (;;) {
      const delivery = await claimNext(db);
      if (!delivery) break;
      const started = Date.now();

      const [run] = await db
        .update(runs)
        .set({ status: "sending", startedAt: sql`coalesce(${runs.startedAt}, now())` })
        .where(and(eq(runs.id, delivery.run_id), inArray(runs.status, ["queued", "sending"])))
        .returning();

      try {
        if (!run) throw new Error("Send was stopped.");
        let entry = cache.get(run.articleId);
        if (!entry) {
          const [article] = await db.select().from(articles).where(eq(articles.id, run.articleId));
          if (!article) throw new Error("Article was deleted.");
          entry = { article, pdf: await readPdf(article.pdfPath) };
          cache.set(run.articleId, entry);
        }
        const { article, pdf } = entry;
        const mail = renderEmail({ ...article, name: delivery.name });
        const result = await provider.send({
          to: { email: delivery.email, name: delivery.name },
          ...mail,
          attachment: { filename: article.pdfName, content: pdf },
        });
        await db
          .update(deliveries)
          .set({ status: "sent", sentAt: new Date(), error: null, providerMessageId: result.messageId ?? null })
          .where(eq(deliveries.id, delivery.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(deliveries)
          .set({ status: "failed", error: message.slice(0, 500) })
          .where(eq(deliveries.id, delivery.id));
      }

      await refreshRunCounts(db, delivery.run_id);
      const wait = gap - (Date.now() - started);
      if (wait > 0) await sleep(wait);
    }
  } finally {
    state.working = false;
    await finalizeRuns(db);
  }
}

// ─── Retention ───────────────────────────────────────────────────────────────

async function applyRetention(db: Db) {
  const cutoff = new Date(Date.now() - env.scheduler.retentionDays * 24 * 60 * 60 * 1000);
  // Paused articles are included: after a send they pause automatically and are rarely resumed.
  const old = await db
    .delete(articles)
    .where(and(inArray(articles.status, ["completed", "paused"]), lt(articles.updatedAt, cutoff)))
    .returning({ pdfPath: articles.pdfPath });
  for (const a of old) await deletePdf(a.pdfPath);
  await db.delete(runs).where(and(eq(runs.kind, "test"), lt(runs.createdAt, cutoff)));
  if (old.length) console.log(`[retention] removed ${old.length} old article(s)`);
}
