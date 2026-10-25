export { DEFAULT_MESSAGE } from "./defaults";

export interface RenderInput {
  title: string;
  subject: string;
  message: string;
  name: string;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => vars[key.toLowerCase()] ?? m);
}

/** The email is just the subject and the message; the PDF goes along as an attachment. */
export function renderEmail(input: RenderInput) {
  const vars = { name: input.name.trim() || "Doctor", title: input.title };
  const subject = fill(input.subject, vars);
  const text = fill(input.message, vars);

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:20px;background:#ffffff">
<div style="max-width:600px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1c1a">${paragraphs}</div>
</body></html>`;

  return { subject, html, text };
}
