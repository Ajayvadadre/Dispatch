import { handler, parseId } from "@/lib/api";
import { removeDoctor, updateDoctor } from "@/lib/doctors";

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/doctors/[id]">) => {
  const id = parseId((await ctx.params).id);
  return { doctor: await updateDoctor(id, await req.json()) };
});

export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/doctors/[id]">) => {
  await removeDoctor(parseId((await ctx.params).id));
});
