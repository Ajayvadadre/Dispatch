import { asc } from "drizzle-orm";
import { handler } from "@/lib/api";
import { getDb } from "@/lib/db";
import { doctors } from "@/lib/db/schema";
import { buildDoctorsWorkbook, XLSX_TYPE } from "@/lib/excel";

export const GET = handler(async () => {
  const db = await getDb();
  const list = await db.select().from(doctors).orderBy(asc(doctors.name));
  const buf = await buildDoctorsWorkbook(list);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="doctors-${date}.xlsx"`,
    },
  });
});
