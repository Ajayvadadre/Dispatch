import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeliveriesTable, RunActions } from "@/components/run-view";
import { isLive, RunStatusPill, runKindLabel } from "@/components/status";
import { Card, cx, LinkButton, PageHeader, Progress } from "@/components/ui";
import { env } from "@/lib/env";
import { getRun } from "@/lib/queries";
import { formatDateTime, formatTime } from "@/lib/time";

export default async function RunPage({ params }: PageProps<"/activity/[id]">) {
  const data = await getRun(Number((await params).id));
  if (!data) notFound();
  const { run, article, deliveries } = data;
  const live = isLive(run.status);
  const waiting = deliveries.filter((d) => d.status === "pending" || d.status === "sending").length;
  const pct = run.total ? Math.round(((run.sent + run.failed) / run.total) * 100) : 0;

  // Rough time left at the configured send rate.
  const minutesLeft = waiting / env.email.ratePerMinute;
  const eta = live && waiting ? (minutesLeft < 1 ? "under a minute left" : `about ${Math.ceil(minutesLeft)} min left`) : null;

  return (
    <>
      <AutoRefresh active={live} every={2000} />
      <PageHeader
        back={
          <LinkButton href="/activity" variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />} className="-ml-2.5">
            Activity
          </LinkButton>
        }
        eyebrow={
          <span className="flex items-center gap-2.5 normal-case tracking-normal">
            <RunStatusPill status={run.status} />
            <span className="text-[12.5px] text-muted">
              {runKindLabel[run.kind]} send #{run.id} · {formatDateTime(run.scheduledFor)}
            </span>
          </span>
        }
        title={
          <Link href={`/articles/${article.id}`} className="hover:underline hover:decoration-line-strong hover:underline-offset-[6px]">
            {article.title}
          </Link>
        }
        actions={<RunActions runId={run.id} status={run.status} failed={run.failed} />}
      />

      {run.total > 0 ? (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-10">
              <Figure label="Sent" value={run.sent} className="text-pine" />
              <Figure label="Failed" value={run.failed} className={run.failed ? "text-brick" : undefined} />
              <Figure label="Waiting" value={waiting} />
              <Figure label="Total" value={run.total} />
            </div>
            <div className="text-right text-[12.5px] text-muted">
              {live ? (
                <>
                  <span className="font-mono text-ink">{pct}%</span> · {eta ?? "starting…"}
                </>
              ) : run.finishedAt ? (
                <>
                  Finished at {formatTime(run.finishedAt)}
                  {run.startedAt && ` · took ${duration(run.startedAt, run.finishedAt)}`}
                </>
              ) : null}
            </div>
          </div>
          <Progress value={run.sent} failed={run.failed} total={run.total} className="h-2" />
          {run.note && <p className="mt-3 text-[12.5px] text-muted">{run.note}</p>}
        </Card>
      ) : (
        <Card className="mb-6 p-5 text-[13.5px] text-ink-2">{run.note ?? "No recipients."}</Card>
      )}

      {deliveries.length > 0 && (
        <DeliveriesTable
          timezone={env.timezone}
          pdfName={article.pdfName}
          rows={deliveries.map((d) => ({
            id: d.id,
            name: d.name,
            email: d.email,
            status: d.status,
            error: d.error,
            sentAt: d.sentAt?.toISOString() ?? null,
          }))}
        />
      )}
    </>
  );
}

function Figure({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className={cx("font-serif text-[30px] leading-none font-[400] tabular-nums", className)}>{value.toLocaleString("en-IN")}</div>
      <div className="mt-1.5 text-[12px] text-muted">{label}</div>
    </div>
  );
}

function duration(a: Date, b: Date) {
  const s = Math.max(1, Math.round((b.getTime() - a.getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min ${s % 60}s`;
}
