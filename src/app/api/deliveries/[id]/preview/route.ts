import { eq } from "drizzle-orm";
import { handler, HttpError, parseId } from "@/lib/api";
import { getDb } from "@/lib/db";
import { articles, deliveries, runs } from "@/lib/db/schema";
import { renderEmail } from "@/lib/email/template";

/** Renders exactly what a recipient receives, for the preview dialog. */
export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/deliveries/[id]/preview">) => {
  const db = await getDb();
  const [row] = await db
    .select({ delivery: deliveries, article: articles })
    .from(deliveries)
    .innerJoin(runs, eq(runs.id, deliveries.runId))
    .innerJoin(articles, eq(articles.id, runs.articleId))
    .where(eq(deliveries.id, parseId((await ctx.params).id)));
  if (!row) throw new HttpError(404, "Not found.");
  const mail = renderEmail({ ...row.article, name: row.delivery.name });
  return new Response(mail.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});
