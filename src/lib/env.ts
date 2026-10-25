import path from "node:path";

export type EmailProviderName = "console" | "smtp" | "graph";

function num(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const provider = (process.env.EMAIL_PROVIDER || "console").trim().toLowerCase() as EmailProviderName;
// Runtime data folder, not source: tell the bundler not to trace it.
const dataDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR || "data");

export const env = {
  timezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  databaseUrl: process.env.DATABASE_URL || "",
  dataDir,
  pgliteDir: path.join(dataDir, "pglite"),
  pdfDir: path.join(dataDir, "pdfs"),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  sessionSecret: process.env.SESSION_SECRET || "dispatch-local-session-secret",
  // Set to true when the app is served over HTTPS (production).
  cookieSecure: process.env.COOKIE_SECURE === "true",
  email: {
    provider,
    fromName: process.env.MAIL_FROM_NAME || "Medical Affairs Team",
    fromAddress: process.env.MAIL_FROM_ADDRESS || "",
    // Exchange Online allows ~30 messages/minute per mailbox; console mode can go faster.
    ratePerMinute: num(process.env.EMAIL_RATE_PER_MINUTE, provider === "console" ? 240 : 30),
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: num(process.env.SMTP_PORT, 587),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
    graph: {
      tenantId: process.env.GRAPH_TENANT_ID || "",
      clientId: process.env.GRAPH_CLIENT_ID || "",
      clientSecret: process.env.GRAPH_CLIENT_SECRET || "",
    },
  },
  scheduler: {
    intervalSeconds: num(process.env.SCHEDULER_INTERVAL_SECONDS, 15),
    // A send that was due while the app was off still goes out if we're within this window.
    graceMinutes: num(process.env.SCHEDULER_GRACE_MINUTES, 120),
    retentionDays: num(process.env.RETENTION_DAYS, 56),
  },
};
