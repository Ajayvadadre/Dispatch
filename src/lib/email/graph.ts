import { env } from "@/lib/env";
import type { OutgoingEmail, SendResult } from "./providers";

const GRAPH = "https://graph.microsoft.com/v1.0";
// sendMail accepts inline attachments up to ~3 MB; larger files need an upload session.
const INLINE_LIMIT = 3 * 1000 * 1000;
const CHUNK = 320 * 1024 * 10; // upload chunks must be multiples of 320 KiB

let cachedToken: { value: string; expires: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const g = env.email.graph;
  const res = await fetch(`https://login.microsoftonline.com/${g.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: g.clientId,
      client_secret: g.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Microsoft sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  cachedToken = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

/** Calls Graph, waiting out throttling (429/503) a few times before giving up. */
async function graph(pathname: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const res = await fetch(`${GRAPH}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...init.headers },
  });
  if ((res.status === 429 || res.status === 503) && attempt < 4) {
    const wait = Number(res.headers.get("Retry-After")) || 2 ** attempt * 5;
    await new Promise((r) => setTimeout(r, wait * 1000));
    return graph(pathname, init, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error?.message ?? text;
    } catch {}
    throw new Error(`Graph ${res.status}: ${message}`);
  }
  return res;
}

export async function sendViaGraph(email: OutgoingEmail): Promise<SendResult> {
  const sender = encodeURIComponent(env.email.fromAddress);
  const message = {
    subject: email.subject,
    body: { contentType: "HTML", content: email.html },
    toRecipients: [{ emailAddress: { address: email.to.email, name: email.to.name || undefined } }],
  };
  const { filename, content } = email.attachment;

  if (content.length <= INLINE_LIMIT) {
    await graph(`/users/${sender}/sendMail`, {
      method: "POST",
      body: JSON.stringify({
        message: {
          ...message,
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: filename,
              contentType: "application/pdf",
              contentBytes: content.toString("base64"),
            },
          ],
        },
        saveToSentItems: true,
      }),
    });
    return {};
  }

  // Large attachment: draft → upload session → send.
  const draft = await (await graph(`/users/${sender}/messages`, { method: "POST", body: JSON.stringify(message) })).json();
  const session = await (
    await graph(`/users/${sender}/messages/${draft.id}/attachments/createUploadSession`, {
      method: "POST",
      body: JSON.stringify({ AttachmentItem: { attachmentType: "file", name: filename, size: content.length } }),
    })
  ).json();

  for (let start = 0; start < content.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, content.length);
    // The upload URL is pre-authorised; it must not receive the bearer token.
    const res = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(end - start),
        "Content-Range": `bytes ${start}-${end - 1}/${content.length}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(content.subarray(start, end)),
    });
    if (!res.ok) throw new Error(`Attachment upload failed (${res.status})`);
  }

  await graph(`/users/${sender}/messages/${draft.id}/send`, { method: "POST" });
  return { messageId: draft.id };
}
