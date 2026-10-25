import { eq, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appMeta, doctors, type Doctor } from "@/lib/db/schema";
import { HttpError } from "@/lib/api";
import { isValidEmail, parseDoctorsFile, type ParsedDoctor, type ParseResult } from "@/lib/excel";

export interface ImportPreview extends Omit<ParseResult, "rows"> {
  valid: number;
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  sampleAdded: ParsedDoctor[];
  sampleRemoved: Pick<Doctor, "name" | "email">[];
}

export interface LastImport {
  fileName: string;
  at: string;
  added: number;
  updated: number;
  removed: number;
  total: number;
}

const fields = ["name", "specialty", "city", "hospital"] as const;

async function diff(rows: ParsedDoctor[]) {
  const db = await getDb();
  const current = await db.select().from(doctors);
  const byEmail = new Map(current.map((d) => [d.email, d]));
  const incoming = new Set(rows.map((r) => r.email));
  const added = rows.filter((r) => !byEmail.has(r.email));
  const updated = rows.filter((r) => {
    const d = byEmail.get(r.email);
    return d && fields.some((f) => (d[f] ?? "") !== (r[f] ?? ""));
  });
  const removed = current.filter((d) => !incoming.has(d.email));
  return { added, updated, removed, unchanged: rows.length - added.length - updated.length };
}

export async function previewImport(file: File): Promise<ImportPreview> {
  const parsed = await readFile(file);
  const d = await diff(parsed.rows);
  return {
    totalRows: parsed.totalRows,
    invalid: parsed.invalid.slice(0, 50),
    duplicates: parsed.duplicates,
    valid: parsed.rows.length,
    added: d.added.length,
    updated: d.updated.length,
    unchanged: d.unchanged,
    removed: d.removed.length,
    sampleAdded: d.added.slice(0, 5),
    sampleRemoved: d.removed.slice(0, 5).map(({ name, email }) => ({ name, email })),
  };
}

export async function applyImport(file: File, removeMissing: boolean) {
  const parsed = await readFile(file);
  if (!parsed.rows.length) throw new HttpError(422, "The file has no valid emails to import.");
  const d = await diff(parsed.rows);
  const db = await getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.rows.length; i += 500) {
      await tx
        .insert(doctors)
        .values(parsed.rows.slice(i, i + 500))
        .onConflictDoUpdate({
          target: doctors.email,
          set: {
            name: sql`excluded.name`,
            specialty: sql`excluded.specialty`,
            city: sql`excluded.city`,
            hospital: sql`excluded.hospital`,
            updatedAt: now,
          },
        });
    }
    if (removeMissing) {
      await tx.delete(doctors).where(
        notInArray(
          doctors.email,
          parsed.rows.map((r) => r.email),
        ),
      );
    }
    const meta: LastImport = {
      fileName: file.name,
      at: now.toISOString(),
      added: d.added.length,
      updated: d.updated.length,
      removed: removeMissing ? d.removed.length : 0,
      total: parsed.rows.length,
    };
    await tx
      .insert(appMeta)
      .values({ key: "lastImport", value: meta })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: meta, updatedAt: now } });
  });

  return { added: d.added.length, updated: d.updated.length, removed: removeMissing ? d.removed.length : 0 };
}

async function readFile(file: File) {
  if (!/\.(xlsx|csv)$/i.test(file.name)) throw new HttpError(422, "Upload an .xlsx or .csv file.");
  try {
    return await parseDoctorsFile(file);
  } catch (err) {
    throw new HttpError(422, err instanceof Error ? err.message : "Couldn't read that file.");
  }
}

export async function getLastImport(): Promise<LastImport | null> {
  const db = await getDb();
  const [row] = await db.select().from(appMeta).where(eq(appMeta.key, "lastImport"));
  return (row?.value as LastImport) ?? null;
}

interface DoctorInput {
  name?: unknown;
  email?: unknown;
  specialty?: unknown;
  city?: unknown;
  hospital?: unknown;
  active?: unknown;
}

function clean(input: DoctorInput, partial: boolean) {
  const out: Partial<typeof doctors.$inferInsert> = {};
  const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (input.email !== undefined || !partial) {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) throw new HttpError(422, "Enter a valid email address.");
    out.email = email;
  }
  if (input.name !== undefined) out.name = String(input.name).trim();
  if (input.specialty !== undefined) out.specialty = opt(input.specialty);
  if (input.city !== undefined) out.city = opt(input.city);
  if (input.hospital !== undefined) out.hospital = opt(input.hospital);
  if (typeof input.active === "boolean") out.active = input.active;
  return out;
}

function uniqueViolation(err: unknown) {
  const code = (err as { code?: string; cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
  return code === "23505";
}

export async function addDoctor(input: DoctorInput) {
  const db = await getDb();
  try {
    const [row] = await db
      .insert(doctors)
      .values(clean(input, false) as typeof doctors.$inferInsert)
      .returning();
    return row;
  } catch (err) {
    if (uniqueViolation(err)) throw new HttpError(409, "That email is already on the list.");
    throw err;
  }
}

export async function updateDoctor(id: number, input: DoctorInput) {
  const db = await getDb();
  try {
    const [row] = await db
      .update(doctors)
      .set({ ...clean(input, true), updatedAt: new Date() })
      .where(eq(doctors.id, id))
      .returning();
    if (!row) throw new HttpError(404, "That doctor no longer exists.");
    return row;
  } catch (err) {
    if (uniqueViolation(err)) throw new HttpError(409, "That email is already on the list.");
    throw err;
  }
}

export async function removeDoctor(id: number) {
  const db = await getDb();
  await db.delete(doctors).where(eq(doctors.id, id));
}
