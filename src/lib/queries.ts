import { and, asc, count, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { articles, deliveries, doctors, runs, type Run } from "@/lib/db/schema";

export async function getOverview() {
  const db = await getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [[doctorCounts], [scheduled], [week], upcoming, recent] = await Promise.all([
    db
      .select({ total: count(), active: sql<number>`count(*) filter (where ${doctors.active})`.mapWith(Number) })
      .from(doctors),
    db.select({ n: count() }).from(articles).where(eq(articles.status, "active")),
    db
      .select({
        sent: sql<number>`count(*) filter (where ${deliveries.status} = 'sent')`.mapWith(Number),
        failed: sql<number>`count(*) filter (where ${deliveries.status} = 'failed')`.mapWith(Number),
      })
      .from(deliveries)
      .innerJoin(runs, eq(runs.id, deliveries.runId))
      .where(and(ne(runs.kind, "test"), gte(deliveries.createdAt, weekAgo))),
    db
      .select()
      .from(articles)
      .where(and(eq(articles.status, "active"), isNotNull(articles.nextRunAt)))
      .orderBy(asc(articles.nextRunAt))
      .limit(5),
    listRuns(6),
  ]);

  return { doctorCounts, scheduled: scheduled.n, week, upcoming, recent };
}

export async function listArticles() {
  const db = await getDb();
  const list = await db
    .select()
    .from(articles)
    .orderBy(sql`case ${articles.status} when 'active' then 0 when 'paused' then 1 else 2 end`, asc(articles.nextRunAt), desc(articles.createdAt));
  const latest = list.length ? await latestRunByArticle(list.map((a) => a.id)) : new Map<number, Run>();
  return list.map((a) => ({ ...a, lastRun: latest.get(a.id) ?? null }));
}

async function latestRunByArticle(ids: number[]) {
  const db = await getDb();
  const rows = await db
    .selectDistinctOn([runs.articleId])
    .from(runs)
    .where(and(inArray(runs.articleId, ids), ne(runs.kind, "test")))
    .orderBy(runs.articleId, desc(runs.createdAt));
  return new Map(rows.map((r) => [r.articleId, r]));
}

export async function getArticle(id: number) {
  const db = await getDb();
  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) return null;
  const history = await db.select().from(runs).where(eq(runs.articleId, id)).orderBy(desc(runs.createdAt)).limit(50);
  return { article, history };
}

export async function listRuns(limit = 100) {
  const db = await getDb();
  return db
    .select({ run: runs, title: articles.title })
    .from(runs)
    .innerJoin(articles, eq(articles.id, runs.articleId))
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}

export async function getRun(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ run: runs, article: articles })
    .from(runs)
    .innerJoin(articles, eq(articles.id, runs.articleId))
    .where(eq(runs.id, id));
  if (!row) return null;
  const items = await db.select().from(deliveries).where(eq(deliveries.runId, id)).orderBy(asc(deliveries.id));
  return { ...row, deliveries: items };
}

export async function listDoctors() {
  const db = await getDb();
  return db.select().from(doctors).orderBy(asc(doctors.name), asc(doctors.email));
}

export async function countActiveDoctors() {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(doctors).where(eq(doctors.active, true));
  return row.n;
}
