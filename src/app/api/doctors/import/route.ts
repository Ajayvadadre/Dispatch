import { handler, HttpError } from "@/lib/api";
import { applyImport, previewImport } from "@/lib/doctors";

// mode=preview returns what would change; mode=apply writes it.
export const POST = handler(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new HttpError(422, "Choose an Excel file to upload.");
  if (form.get("mode") === "apply") {
    return { result: await applyImport(file, form.get("removeMissing") === "true") };
  }
  return { preview: await previewImport(file) };
});
