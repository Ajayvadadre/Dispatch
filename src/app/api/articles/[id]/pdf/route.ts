import { handler, parseId } from "@/lib/api";
import { getArticleOr404 } from "@/lib/articles";
import { readPdf } from "@/lib/storage";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/articles/[id]/pdf">) => {
  const article = await getArticleOr404(parseId((await ctx.params).id));
  const pdf = await readPdf(article.pdfPath);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(article.pdfName)}"`,
    },
  });
});
