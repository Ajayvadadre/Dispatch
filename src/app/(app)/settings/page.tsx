import path from "node:path";
import { CircleAlert, CircleCheck } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Card, CardHeader, cx, PageHeader } from "@/components/ui";
import { describeDatabase } from "@/lib/db";
import { schedulerState } from "@/lib/dispatcher";
import { getProvider } from "@/lib/email/providers";
import { env } from "@/lib/env";
import { formatRelative, formatTime, timezoneLabel } from "@/lib/time";

export const metadata = { title: "Settings" };

const PROVIDERS = [
  {
    id: "console",
    name: "Console",
    body: "Nothing leaves your laptop. Every email is fully processed, logged and previewable. Use it for rehearsals and demos.",
    env: "EMAIL_PROVIDER=console",
  },
  {
    id: "smtp",
    name: "SMTP mailbox",
    body: "Real emails through any SMTP account, e.g. a Gmail address with an app password. A good stop-gap until Microsoft 365 is approved.",
    env: `EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-char-app-password`,
  },
  {
    id: "graph",
    name: "Microsoft 365",
    body: "Sends from your organisation's mailbox through Microsoft Graph. Needs an app registration with Mail.Send, approved by IT.",
    env: `EMAIL_PROVIDER=graph
GRAPH_TENANT_ID=…
GRAPH_CLIENT_ID=…
GRAPH_CLIENT_SECRET=…
MAIL_FROM_ADDRESS=articles@yourdomain.com`,
  },
];

export default function SettingsPage() {
  const provider = getProvider();
  const errors = provider.configErrors();
  const scheduler = schedulerState();
  const db = describeDatabase();
  const now = new Date();

  return (
    <>
      <AutoRefresh every={10000} />
      <PageHeader
        eyebrow="Settings"
        title="How Dispatch is set up"
        description={
          <>
            Settings live in the <code className="font-mono text-[13px] text-ink">.env</code> file in the project folder. After changing it, restart the app.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Email delivery" />
          <div className="grid gap-px bg-line md:grid-cols-3">
            {PROVIDERS.map((p) => {
              const current = p.id === provider.name;
              return (
                <div key={p.id} className={cx("bg-surface p-5", current && "bg-pine-soft/40")}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[14px] font-semibold">{p.name}</span>
                    {current &&
                      (errors.length ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber">
                          <CircleAlert className="size-3.5" /> Needs setup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-pine">
                          <CircleCheck className="size-3.5" /> In use
                        </span>
                      ))}
                  </div>
                  <p className="mb-3.5 text-[13px] text-muted">{p.body}</p>
                  <pre className="overflow-x-auto rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-ink-2">{p.env}</pre>
                  {current && errors.length > 0 && <p className="mt-3 text-[12.5px] text-amber">{errors.join(" · ")}</p>}
                </div>
              );
            })}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 border-t border-line px-5 py-4 text-[13px] md:grid-cols-4">
            <Item label="Sender name">{env.email.fromName}</Item>
            <Item label="Sender address">{env.email.fromAddress || env.email.smtp.user || "—"}</Item>
            <Item label="Sending pace">{env.email.ratePerMinute} emails / min</Item>
            <Item label="Time zone">{env.timezone}</Item>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Scheduler" />
          <dl className="divide-y divide-line text-[13.5px]">
            <Row label="Status">
              <span className="inline-flex items-center gap-2">
                <span className={cx("size-1.5 rounded-full", scheduler.started && !scheduler.lastError ? "animate-pulse-dot bg-pine" : "bg-brick")} />
                {scheduler.started ? (scheduler.lastError ? "Running with errors" : "Running") : "Not started"}
              </span>
            </Row>
            <Row label="Checks">Every {env.scheduler.intervalSeconds} seconds</Row>
            <Row label="Last check">{scheduler.lastTickAt ? `${formatTime(scheduler.lastTickAt)} · ${formatRelative(scheduler.lastTickAt, now)}` : "—"}</Row>
            <Row label="Missed sends">Sent late if the app was off for less than {env.scheduler.graceMinutes} minutes, otherwise marked missed</Row>
            <Row label="Time zone">{timezoneLabel()}</Row>
            {scheduler.lastError && <Row label="Last error"><span className="text-brick">{scheduler.lastError}</span></Row>}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Storage" />
          <dl className="divide-y divide-line text-[13.5px]">
            <Row label="Database">{db.kind}</Row>
            <Row label="Location">
              <span className="font-mono text-[12.5px]">{db.detail}</span>
            </Row>
            <Row label="PDF files">
              <span className="font-mono text-[12.5px]">{path.relative(process.cwd(), env.pdfDir)}</span>
            </Row>
            <Row label="Clean-up">Finished articles and their PDFs are removed after {env.scheduler.retentionDays} days</Row>
            <Row label="Sign-in">{env.adminPassword ? "Password protected" : "Open (no ADMIN_PASSWORD set)"}</Row>
          </dl>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-ink">{children}</dd>
    </div>
  );
}
