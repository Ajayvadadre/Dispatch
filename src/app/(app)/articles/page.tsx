import Link from "next/link";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { ArticleStatusPill, RunStatusPill } from "@/components/status";
import { Card, EmptyState, LinkButton, PageHeader, PdfGlyph } from "@/components/ui";
import { listArticles } from "@/lib/queries";
import { describeSchedule } from "@/lib/schedule";
import { formatDateTime, formatRelative } from "@/lib/time";

export const metadata = { title: "Articles" };

export default async function ArticlesPage() {
  const list = await listArticles();
  const now = new Date();

  return (
    <>
      <PageHeader
        eyebrow="Articles"
        title="What goes out, and when"
        description="Each article has its own PDF and schedule. It's emailed to every active doctor on the list."
        actions={
          <LinkButton href="/articles/new" variant="primary" icon={<Plus className="size-4" />}>
            New article
          </LinkButton>
        }
      />

      <Card>
        {list.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No articles yet"
            action={
              <LinkButton href="/articles/new" variant="primary" icon={<Plus className="size-4" />}>
                Add your first article
              </LinkButton>
            }
          >
            Upload an article PDF, write a short note and pick when it should be sent.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_180px_150px_110px_20px] gap-4 border-b border-line px-5 py-2.5 text-[12px] text-muted max-md:hidden">
              <div>Article</div>
              <div>Next send</div>
              <div>Last send</div>
              <div>Status</div>
              <div />
            </div>
            <ul className="divide-y divide-line">
              {list.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/articles/${a.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_180px_150px_110px_20px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper/60 max-md:grid-cols-1"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <PdfGlyph />
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-medium text-ink">{a.title}</div>
                        <div className="truncate text-[12.5px] text-muted">{describeSchedule(a)}</div>
                      </div>
                    </div>
                    <div className="text-[13px]">
                      {a.nextRunAt && a.status === "active" ? (
                        <>
                          <div className="text-ink">{formatDateTime(a.nextRunAt)}</div>
                          <div className="text-[12px] text-muted">{formatRelative(a.nextRunAt, now)}</div>
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </div>
                    <div>{a.lastRun ? <RunStatusPill status={a.lastRun.status} /> : <span className="text-[13px] text-faint">Not sent yet</span>}</div>
                    <div>
                      <ArticleStatusPill status={a.status} />
                    </div>
                    <ChevronRight className="size-4 text-faint max-md:hidden" />
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
