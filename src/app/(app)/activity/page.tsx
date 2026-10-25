import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { isLive, RunStatusPill, runKindLabel } from "@/components/status";
import { Card, EmptyState, PageHeader, Progress } from "@/components/ui";
import { listRuns } from "@/lib/queries";
import { formatDateTime, formatRelative } from "@/lib/time";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const list = await listRuns(150);
  const now = new Date();

  return (
    <>
      <AutoRefresh every={list.some(({ run }) => isLive(run.status)) ? 2500 : 10000} />
      <PageHeader
        eyebrow="Activity"
        title="Every send, and how it went"
        description="Open a send to see each doctor's delivery status, preview the exact email, or retry anything that failed."
      />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={<Activity className="size-5" />} title="Nothing sent yet">
            Scheduled sends, “Send now” and test emails all appear here.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_170px_minmax(0,220px)_110px_16px] gap-4 border-b border-line px-5 py-2.5 text-[12px] text-muted">
              <div>Article</div>
              <div>When</div>
              <div>Delivered</div>
              <div>Status</div>
              <div />
            </div>
            <ul className="divide-y divide-line">
              {list.map(({ run, title }) => (
                <li key={run.id}>
                  <Link
                    href={`/activity/${run.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_170px_minmax(0,220px)_110px_16px] items-center gap-4 px-5 py-3 text-[13.5px] transition-colors hover:bg-paper/60"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{title}</div>
                      <div className="text-[12.5px] text-muted">
                        #{run.id} · {runKindLabel[run.kind]}
                      </div>
                    </div>
                    <div>
                      <div className="text-ink">{formatDateTime(run.scheduledFor)}</div>
                      <div className="text-[12px] text-muted">{formatRelative(run.scheduledFor, now)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {run.total > 0 ? (
                        <>
                          <Progress value={run.sent} failed={run.failed} total={run.total} className="flex-1" />
                          <span className="font-mono text-[12px] text-muted tabular-nums">
                            {run.sent}/{run.total}
                          </span>
                        </>
                      ) : (
                        <span className="truncate text-[12.5px] text-muted">{run.note}</span>
                      )}
                    </div>
                    <RunStatusPill status={run.status} />
                    <ChevronRight className="size-4 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
