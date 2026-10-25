import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, ExternalLink, Paperclip } from "lucide-react";
import { ArticleActions } from "@/components/article-actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ArticleStatusPill, isLive, RunStatusPill, runKindLabel } from "@/components/status";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, PdfGlyph, Progress } from "@/components/ui";
import { env } from "@/lib/env";
import { countActiveDoctors, getArticle } from "@/lib/queries";
import { describeSchedule, recurrenceLabel } from "@/lib/schedule";
import { formatBytes } from "@/lib/storage";
import { formatDate, formatDateTime, formatRelative } from "@/lib/time";

export default async function ArticlePage({ params }: PageProps<"/articles/[id]">) {
  const data = await getArticle(Number((await params).id));
  if (!data) notFound();
  const { article, history } = data;
  const doctorCount = await countActiveDoctors();
  const now = new Date();
  const live = history.some((r) => isLive(r.status));

  return (
    <>
      <AutoRefresh every={live ? 2500 : 10000} />
      <PageHeader
        back={
          <LinkButton href="/articles" variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />} className="-ml-2.5">
            Articles
          </LinkButton>
        }
        eyebrow={
          <span className="flex items-center gap-2.5 normal-case tracking-normal">
            <ArticleStatusPill status={article.status} />
            <span className="text-[12.5px] text-muted">{describeSchedule(article)}</span>
          </span>
        }
        title={article.title}
        actions={
          <ArticleActions
            id={article.id}
            title={article.title}
            status={article.status}
            doctorCount={doctorCount}
            defaultTestEmail={env.email.fromAddress || env.email.smtp.user}
          />
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-7">
          <CardHeader title="Email preview" meta={`Subject: ${article.subject.replace(/\{\{\s*title\s*\}\}/g, article.title)}`} />
          <iframe src={`/api/articles/${article.id}/preview`} title="Email preview" className="block h-44 w-full bg-white" />
          <div className="flex items-center gap-2.5 border-t border-line bg-paper/50 px-5 py-3">
            <Paperclip className="size-3.5 text-muted" />
            <span className="truncate text-[12.5px] font-medium">{article.pdfName}</span>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader title="Schedule" />
            <dl className="divide-y divide-line text-[13.5px]">
              <Item label="Repeats">{recurrenceLabel[article.recurrence]}</Item>
              <Item label="Next send">
                {article.status === "active" && article.nextRunAt ? (
                  <>
                    {formatDateTime(article.nextRunAt)} <span className="text-muted">· {formatRelative(article.nextRunAt, now)}</span>
                  </>
                ) : article.status === "paused" ? (
                  <span className="text-amber">
                    Paused
                    {article.lastRunAt && <span className="text-muted"> · after the send on {formatDateTime(article.lastRunAt)}</span>}
                  </span>
                ) : (
                  <span className="text-muted">No more sends</span>
                )}
              </Item>
              {article.recurrence !== "once" && article.endAt && <Item label="Ends">{formatDate(article.endAt)}</Item>}
              <Item label="Recipients">
                <Link href="/doctors" className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {doctorCount.toLocaleString("en-IN")} active doctors
                </Link>
              </Item>
            </dl>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3.5">
              <PdfGlyph />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{article.pdfName}</div>
                <div className="text-[12.5px] text-muted">{formatBytes(article.pdfSize)} · attached to every email</div>
              </div>
              <a href={`/api/articles/${article.id}/pdf`} target="_blank" className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
                Open <ExternalLink className="size-3.5" />
              </a>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Send history" meta={history.length ? `${history.length} sends` : undefined} />
        {history.length === 0 ? (
          <EmptyState title="Not sent yet">Sends and test emails for this article will be listed here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((run) => (
              <li key={run.id}>
                <Link href={`/activity/${run.id}`} className="grid grid-cols-[180px_100px_minmax(0,1fr)_110px_16px] items-center gap-4 px-5 py-3 text-[13.5px] transition-colors hover:bg-paper/60">
                  <span className="text-ink">{formatDateTime(run.scheduledFor)}</span>
                  <span className="text-muted">{runKindLabel[run.kind]}</span>
                  <span className="flex items-center gap-3">
                    {run.total > 0 ? (
                      <>
                        <Progress value={run.sent} failed={run.failed} total={run.total} className="max-w-56 flex-1" />
                        <span className="font-mono text-[12px] text-muted tabular-nums">
                          {run.sent}/{run.total}
                          {run.failed > 0 && <span className="text-brick"> · {run.failed} failed</span>}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-muted">{run.note}</span>
                    )}
                  </span>
                  <RunStatusPill status={run.status} />
                  <ChevronRight className="size-4 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}
