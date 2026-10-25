import { handler } from "@/lib/api";
import { buildTemplateWorkbook, XLSX_TYPE } from "@/lib/excel";

export const GET = handler(async () => {
  const buf = await buildTemplateWorkbook();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": 'attachment; filename="doctors-template.xlsx"',
    },
  });
});
