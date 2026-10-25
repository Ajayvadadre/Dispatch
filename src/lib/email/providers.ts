import { env, type EmailProviderName } from "@/lib/env";
import { sendViaGraph } from "./graph";

export interface OutgoingEmail {
  to: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
  attachment: { filename: string; content: Buffer };
}

export interface SendResult {
  messageId?: string;
}

export interface EmailProvider {
  name: EmailProviderName;
  label: string;
  /** Problems that stop this provider from sending (missing settings etc). */
  configErrors(): string[];
  send(email: OutgoingEmail): Promise<SendResult>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const consoleProvider: EmailProvider = {
  name: "console",
  label: "Console (simulated)",
  configErrors: () => [],
  async send(email) {
    await sleep(60);
    // Reserved ".invalid" TLD lets you demo a failed delivery + retry.
    if (email.to.email.endsWith(".invalid")) throw new Error("Mailbox unavailable (simulated failure)");
    console.log(`[mail:console] → ${email.to.email} · "${email.subject}" · ${email.attachment.filename}`);
    return { messageId: `console-${Date.now()}` };
  },
};

let smtpTransport: import("nodemailer").Transporter | null = null;

const smtpProvider: EmailProvider = {
  name: "smtp",
  label: "SMTP",
  configErrors() {
    const s = env.email.smtp;
    const missing = [
      !s.host && "SMTP_HOST",
      !s.user && "SMTP_USER",
      !s.pass && "SMTP_PASS",
      !env.email.fromAddress && !s.user && "MAIL_FROM_ADDRESS",
    ].filter(Boolean);
    return missing.length ? [`Missing ${missing.join(", ")} in .env`] : [];
  },
  async send(email) {
    const s = env.email.smtp;
    if (!smtpTransport) {
      const nodemailer = await import("nodemailer");
      smtpTransport = nodemailer.createTransport({
        host: s.host,
        port: s.port,
        secure: s.port === 465,
        pool: true,
        maxConnections: 2,
        auth: { user: s.user, pass: s.pass },
      });
    }
    const info = await smtpTransport.sendMail({
      from: { name: env.email.fromName, address: env.email.fromAddress || s.user },
      to: { name: email.to.name, address: email.to.email },
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: [{ filename: email.attachment.filename, content: email.attachment.content, contentType: "application/pdf" }],
    });
    return { messageId: info.messageId };
  },
};

const graphProvider: EmailProvider = {
  name: "graph",
  label: "Microsoft 365 (Graph)",
  configErrors() {
    const g = env.email.graph;
    const missing = [
      !g.tenantId && "GRAPH_TENANT_ID",
      !g.clientId && "GRAPH_CLIENT_ID",
      !g.clientSecret && "GRAPH_CLIENT_SECRET",
      !env.email.fromAddress && "MAIL_FROM_ADDRESS",
    ].filter(Boolean);
    return missing.length ? [`Missing ${missing.join(", ")} in .env`] : [];
  },
  send: (email) => sendViaGraph(email),
};

const providers: Record<EmailProviderName, EmailProvider> = {
  console: consoleProvider,
  smtp: smtpProvider,
  graph: graphProvider,
};

export function getProvider(): EmailProvider {
  return providers[env.email.provider] ?? consoleProvider;
}
