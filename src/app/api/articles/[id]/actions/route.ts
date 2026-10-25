import { handler, HttpError, parseId } from "@/lib/api";
import { getArticleOr404, setPaused } from "@/lib/articles";
import { sendNow, sendTest } from "@/lib/dispatcher";
import { isValidEmail } from "@/lib/excel";

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/articles/[id]/actions">) => {
  const id = parseId((await ctx.params).id);
  const body = await req.json();
  await getArticleOr404(id);

  switch (body.action) {
    case "send-now": {
      const run = await sendNow(id);
      return { runId: run.id };
    }
    case "test": {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!isValidEmail(email)) throw new HttpError(422, "Enter a valid email for the test.");
      const run = await sendTest(id, email, String(body.name ?? "").trim());
      return { runId: run.id };
    }
    case "pause":
      return setPaused(id, true);
    case "resume":
      return setPaused(id, false);
    default:
      throw new HttpError(400, "Unknown action.");
  }
});
