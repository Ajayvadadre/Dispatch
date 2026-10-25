import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { articles, type Article, type Recurrence } from "@/lib/db/schema";
import { HttpError } from "@/lib/api";
import { DEFAULT_MESSAGE } from "@/lib/email/template";
import { firstOccurrenceFrom } from "@/lib/schedule";
import { deletePdf, savePdf } from "@/lib/storage";
import { endOfLocalDay, fromLocalInput } from "@/lib/time";

const RECURRENCES: Recurrence[] = ["once", "daily", "weekly"];

function readForm(form: FormData, existing?: Article) {
  const str = (key: string) => String(form.get(key) ?? "").trim();
  const title = str("title");
  if (!title) throw new HttpError(422, "Give the article a title.");

  const recurrence = str("recurrence") as Recurrence;
  if (!RECURRENCES.includes(recurrence)) throw new HttpError(422, "Choose how often to send it.");

  const startAt = fromLocalInput(str("startAt"));
  if (!startAt) throw new HttpError(422, "Pick a date and time for the first send.");
  const startChanged = !existing || existing.startAt.getTime() !== startAt.getTime();
  if (startChanged && startAt.getTime() < Date.now() - 60_000) {
    throw new HttpError(422, "The first send time is in the past. Pick a time from now on.");
  }

  let endAt: Date | null = null;
  if (recurrence !== "once" && str("endDate")) {
    endAt = endOfLocalDay(str("endDate"));
    if (!endAt) throw new HttpError(422, "The end date isn't valid.");
    if (endAt < startAt) throw new HttpError(422, "The end date is before the first send.");
  }

  const pdf = form.get("pdf");
  const file = pdf instanceof File && pdf.size > 0 ? pdf : null;
  if (!existing && !file) throw new HttpError(422, "Attach the article PDF.");

  return {
    file,
    values: {
      title,
      subject: str("subject") || title,
      message: str("message") || DEFAULT_MESSAGE,
      recurrence,
      startAt,
      endAt,
    },
  };
}

export async function createArticle(form: FormData) {
  const { file, values } = readForm(form);
  const stored = await savePdf(file!).catch((e) => {
    throw new HttpError(422, e.message);
  });
  const nextRunAt = firstOccurrenceFrom(values, new Date());
  const db = await getDb();
  const [article] = await db
    .insert(articles)
    .values({
      ...values,
      pdfPath: stored.path,
      pdfName: stored.name,
      pdfSize: stored.size,
      nextRunAt,
      status: nextRunAt ? "active" : "completed",
    })
    .returning();
  return article;
}

export async function updateArticle(id: number, form: FormData) {
  const db = await getDb();
  const existing = await getArticleOr404(id);
  const { file, values } = readForm(form, existing);
  const stored = file
    ? await savePdf(file).catch((e) => {
        throw new HttpError(422, e.message);
      })
    : null;

  const nextRunAt = firstOccurrenceFrom(values, new Date(), existing.lastRunAt);
  const status = !nextRunAt ? "completed" : existing.status === "paused" ? "paused" : "active";
  const [article] = await db
    .update(articles)
    .set({
      ...values,
      ...(stored && { pdfPath: stored.path, pdfName: stored.name, pdfSize: stored.size }),
      nextRunAt,
      status,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id))
    .returning();
  if (stored) await deletePdf(existing.pdfPath);
  return article;
}

export async function setPaused(id: number, paused: boolean) {
  const db = await getDb();
  const article = await getArticleOr404(id);
  if (paused) {
    await db.update(articles).set({ status: "paused", updatedAt: new Date() }).where(eq(articles.id, id));
    return;
  }
  // Resuming skips anything that fell due while paused.
  const nextRunAt = firstOccurrenceFrom(article, new Date(), article.lastRunAt);
  await db
    .update(articles)
    .set({ status: nextRunAt ? "active" : "completed", nextRunAt, updatedAt: new Date() })
    .where(eq(articles.id, id));
}

export async function deleteArticle(id: number) {
  const db = await getDb();
  const [deleted] = await db.delete(articles).where(eq(articles.id, id)).returning();
  if (deleted) await deletePdf(deleted.pdfPath);
}

export async function getArticleOr404(id: number) {
  const db = await getDb();
  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) throw new HttpError(404, "That article no longer exists.");
  return article;
}
