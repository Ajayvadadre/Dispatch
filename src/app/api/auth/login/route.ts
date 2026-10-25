import { NextResponse } from "next/server";
import { checkPassword, signIn } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!checkPassword(String(password ?? ""))) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }
  await signIn();
  return NextResponse.json({ ok: true });
}
