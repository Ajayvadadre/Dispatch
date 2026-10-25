import { handler, HttpError, parseId } from "@/lib/api";
import { cancelRun, retryFailed } from "@/lib/dispatcher";

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/runs/[id]">) => {
  const id = parseId((await ctx.params).id);
  const { action } = await req.json();
  if (action === "retry") return { retried: await retryFailed(id) };
  if (action === "cancel") return cancelRun(id);
  throw new HttpError(400, "Unknown action.");
});
