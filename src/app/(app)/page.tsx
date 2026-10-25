import Link from "next/link";
import { ArrowUpRight, Check, FileText, Plus, Users } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { isLive, RunStatusPill, runKindLabel } from "@/components/status";
import { Card, CardHeader, cx, EmptyState, LinkButton, PageHeader, Progress } from "@/components/ui";
import { getOverview } from "@/lib/queries";
import { describeSchedule } from "@/lib/schedule";
import { formatDateLong, formatDateTime, formatDay, formatMonth, formatRelative, formatTime, greeting } from "@/lib/time";

export default async function OverviewPage() {
  const { doctorCounts, scheduled, week, upcoming, recent } = await getOverview();
  const now = new Date();
  const next = upcoming[0];
  const anyLive = recent.some((r) => isLive(r.run.status));
  const attempted = week.sent + week.failed;
  const setupDone = doctorCounts.total > 0 && (upcoming.length > 0 || recent.length > 0);

  return (
    <>
      <AutoRefresh every={anyLive ? 2500 : 15000} />
      <PageHeader
        eyebrow={formatDateLong(now)}
        title={`${greeting(now)}.`}
        description={
          next ? (
            <>
              Next email goes out <span className="text-ink">{formatRelative(next.nextRunAt!, now)}</span>: “{next.title}” to{" "}
              {doctorCounts.active} doctors.
            </>
          ) : (
            "Nothing is scheduled right now."
          )
        }
        actions={
          <LinkButton href="/articles/new" variant="primary" icon={<Plus className="size-4" />}>
            New article
          </LinkButton>
        }
      />

      {!setupDone && <GettingStarted hasDoctors={doctorCounts.total > 0} />}

      <Card className="mb-6 grid grid-cols-2 divide-line max-md:divide-y md:grid-cols-4 md:divide-x">
        <Stat label="Doctors on the list" value={doctorCounts.active} note={doctorCounts.total !== doctorCounts.active ? `${doctorCounts.total - doctorCounts.active} paused` : "all active"} href="/doctors" />
        <Stat label="Scheduled articles" value={scheduled} note={next ? `next ${formatTime(next.nextRunAt!)}` : "none upcoming"} href="/articles" />
        <Stat label="Emails sent · 7 days" value={week.sent} note={week.failed ? `${week.failed} failed` : "no failures"} href="/activity" />
        <Stat
          label="Delivery success"
          value={attempted ? `${((week.sent / attempted) * 100).toFixed(attempted === week.sent ? 0 : 1)}%` : "—"}
          note="last 7 days"
          href="/activity"
        />
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title="Up next" action={<SmallLink href="/articles">All articles</SmallLink>} />
          {upcoming.length === 0 ? (
            <EmptyState title="No sends scheduled">Schedule an article and it will show up here.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={`/articles/${a.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper/60">
                    <div className="w-11 shrink-0 text-center">
                      <div className="text-[10.5px] font-medium tracking-[0.12em] text-brick uppercase">{formatMonth(a.nextRunAt!)}</div>
                      <div className="font-serif text-[24px] leading-none font-[420]">{formatDay(a.nextRunAt!)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">{a.title}</div>
                      <div className="truncate text-[12.5px] text-muted">{describeSchedule(a)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[12.5px] text-ink-2">{formatTime(a.nextRunAt!)}</div>
                      <div className="text-[12px] text-muted">{formatRelative(a.nextRunAt!, now)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader title="Recent sends" action={<SmallLink href="/activity">All activity</SmallLink>} />
          {recent.length === 0 ? (
            <EmptyState title="Nothing sent yet">Sends, test emails and their results appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map(({ run, title }) => (
                <li key={run.id}>
                  <Link href={`/activity/${run.id}`} className="block px-5 py-3.5 transition-colors hover:bg-paper/60">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-ink">{title}</div>
                        <div className="text-[12.5px] text-muted">
                          {runKindLabel[run.kind]} · {formatDateTime(run.scheduledFor)}
                        </div>
                      </div>
                      <RunStatusPill status={run.status} />
                    </div>
                    {run.total > 0 && (
                      <div className="mt-2.5 flex items-center gap-3">
                        <Progress value={run.sent} failed={run.failed} total={run.total} className="flex-1" />
                        <span className="font-mono text-[12px] text-muted tabular-nums">
                          {run.sent}/{run.total}
                        </span>
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, note, href }: { label: string; value: number | string; note: string; href: string }) {
  return (
    <Link href={href} className="group px-5 py-4 transition-colors hover:bg-paper/50">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1.5 font-serif text-[30px] leading-none font-[400] tracking-[-0.01em] tabular-nums">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </div>
      <div className="mt-2 text-[12px] text-faint group-hover:text-muted">{note}</div>
    </Link>
  );
}

function SmallLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-[12.5px] text-muted hover:text-ink">
      {children}
      <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

function GettingStarted({ hasDoctors }: { hasDoctors: boolean }) {
  const steps = [
    { done: hasDoctors, title: "Upload your doctors list", body: "One Excel sheet with names and emails.", href: "/doctors", icon: Users },
    { done: false, title: "Add an article", body: "Attach the PDF and choose when it goes out.", href: "/articles/new", icon: FileText },
  ];
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="grid md:grid-cols-[1fr_1fr_1fr]">
        <div className="bg-pine px-6 py-5 text-white">
          <div className="text-[11px] font-medium tracking-[0.12em] text-white/70 uppercase">Getting started</div>
          <p className="mt-2 font-serif text-[20px] leading-snug font-[420]">Two steps and your first article is on its way.</p>
        </div>
        {steps.map((s, i) => (
          <Link key={s.title} href={s.href} className="group flex gap-3.5 border-line px-6 py-5 transition-colors hover:bg-paper/60 md:border-l">
            <div
              className={cx(
                "grid size-7 shrink-0 place-items-center rounded-full border text-[12px] font-medium",
                s.done ? "border-pine bg-pine text-white" : "border-line-strong text-muted",
              )}
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </div>
            <div>
              <div className={cx("text-[14px] font-medium", s.done ? "text-muted line-through" : "text-ink")}>{s.title}</div>
              <div className="mt-0.5 text-[13px] text-muted">{s.body}</div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
