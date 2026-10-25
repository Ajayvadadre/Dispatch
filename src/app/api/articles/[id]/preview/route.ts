import { handler, parseId } from "@/lib/api";
import { getArticleOr404 } from "@/lib/articles";
import { renderEmail } from "@/lib/email/template";

/** Email preview for an article, addressed to a sample recipient. */
export const GET = handler(async (req: Request, ctx: RouteContext<"/api/articles/[id]/preview">) => {
  const article = await getArticleOr404(parseId((await ctx.params).id));
  const name = new URL(req.url).searchParams.get("name") ?? "Dr. Ananya Rao";
  const mail = renderEmail({ ...article, name });
  return new Response(mail.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});
