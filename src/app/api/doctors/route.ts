import { handler } from "@/lib/api";
import { addDoctor } from "@/lib/doctors";

export const POST = handler(async (req: Request) => ({ doctor: await addDoctor(await req.json()) }));
