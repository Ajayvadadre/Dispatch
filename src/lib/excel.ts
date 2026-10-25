import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { Doctor } from "@/lib/db/schema";

export interface ParsedDoctor {
  name: string;
  email: string;
  specialty: string | null;
  city: string | null;
  hospital: string | null;
}

export interface ParseResult {
  rows: ParsedDoctor[];
  invalid: { row: number; value: string; reason: string }[];
  duplicates: number;
  totalRows: number;
}

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/;

const HEADERS: Record<keyof ParsedDoctor, string[]> = {
  email: ["email", "e-mail", "email id", "emailid", "email address", "mail", "mail id"],
  name: ["name", "doctor", "doctor name", "full name", "dr name"],
  specialty: ["specialty", "speciality", "specialisation", "specialization", "department"],
  city: ["city", "location", "town"],
  hospital: ["hospital", "clinic", "organisation", "organization", "centre", "center"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim();

export function isValidEmail(email: string) {
  return EMAIL_RE.test(email);
}

export async function parseDoctorsFile(file: File): Promise<ParseResult> {
  const buf = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  if (file.name.toLowerCase().endsWith(".csv")) {
    await workbook.csv.read(Readable.from(buf));
  } else {
    // exceljs' types predate Node's generic Buffer.
    await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The file has no sheets.");

  // Find the header row: the first row (within the first 10) that has an email column.
  let headerRow = 0;
  const columns: Partial<Record<keyof ParsedDoctor, number>> = {};
  for (let r = 1; r <= Math.min(10, sheet.rowCount) && !headerRow; r++) {
    sheet.getRow(r).eachCell((cell, col) => {
      const label = norm(cell.text ?? "");
      for (const [field, names] of Object.entries(HEADERS) as [keyof ParsedDoctor, string[]][]) {
        if (columns[field] === undefined && names.includes(label)) columns[field] = col;
      }
    });
    if (columns.email !== undefined) headerRow = r;
    else for (const k of Object.keys(columns)) delete columns[k as keyof ParsedDoctor];
  }
  if (!headerRow) throw new Error('Couldn\'t find an "Email" column. Use the template for the expected format.');

  const result: ParseResult = { rows: [], invalid: [], duplicates: 0, totalRows: 0 };
  const seen = new Set<string>();
  const text = (row: ExcelJS.Row, col?: number) => (col ? (row.getCell(col).text ?? "").trim() : "");

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw = text(row, columns.email).replace(/^mailto:/i, "");
    const name = text(row, columns.name);
    if (!raw && !name) continue;
    result.totalRows++;
    const email = raw.toLowerCase();
    if (!email) {
      result.invalid.push({ row: r, value: name, reason: "Email is empty" });
      continue;
    }
    if (!isValidEmail(email)) {
      result.invalid.push({ row: r, value: raw, reason: "Not a valid email" });
      continue;
    }
    if (seen.has(email)) {
      result.duplicates++;
      continue;
    }
    seen.add(email);
    result.rows.push({
      email,
      name,
      specialty: text(row, columns.specialty) || null,
      city: text(row, columns.city) || null,
      hospital: text(row, columns.hospital) || null,
    });
  }
  return result;
}

const COLUMNS = [
  { header: "Name", key: "name", width: 28 },
  { header: "Email", key: "email", width: 34 },
  { header: "Specialty", key: "specialty", width: 22 },
  { header: "City", key: "city", width: 16 },
  { header: "Hospital", key: "hospital", width: 30 },
];

function styledWorkbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Doctors");
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return { wb, ws };
}

export async function buildDoctorsWorkbook(list: Pick<Doctor, "name" | "email" | "specialty" | "city" | "hospital">[]) {
  const { wb, ws } = styledWorkbook();
  for (const d of list) ws.addRow(d);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildTemplateWorkbook() {
  return buildDoctorsWorkbook([
    { name: "Dr. Ananya Rao", email: "ananya.rao@example.com", specialty: "Gynaecology", city: "Pune", hospital: "City Women's Hospital" },
    { name: "Dr. Vikram Mehta", email: "vikram.mehta@example.com", specialty: "Reproductive Medicine", city: "Jaipur", hospital: "" },
  ]);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
