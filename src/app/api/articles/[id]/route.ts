import { handler, parseId } from "@/lib/api";
import { deleteArticle, updateArticle } from "@/lib/articles";

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/articles/[id]">) => {
  const id = parseId((await ctx.params).id);
  return { article: await updateArticle(id, await req.formData()) };
});

export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/articles/[id]">) => {
  await deleteArticle(parseId((await ctx.params).id));
});
