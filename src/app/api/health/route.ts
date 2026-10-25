import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { schedulerState } from "@/lib/dispatcher";

/** Unauthenticated liveness check for load balancers / uptime monitors. Reveals no data. */
export async function GET() {
  const scheduler = schedulerState();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
  const stale = !scheduler.lastTickAt || Date.now() - scheduler.lastTickAt.getTime() > 5 * 60_000;
  return NextResponse.json(
    { ok: !stale, scheduler: stale ? "stalled" : "running", lastCheck: scheduler.lastTickAt },
    { status: stale ? 503 : 200 },
  );
}
