import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleForm } from "@/components/article-form";
import { LinkButton, PageHeader } from "@/components/ui";
import { env } from "@/lib/env";
import { countActiveDoctors, getArticle } from "@/lib/queries";
import { toLocalDateInput, toLocalInput } from "@/lib/time";

export const metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: PageProps<"/articles/[id]/edit">) {
  const data = await getArticle(Number((await params).id));
  if (!data) notFound();
  const { article } = data;

  return (
    <>
      <PageHeader
        back={
          <LinkButton href={`/articles/${article.id}`} variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />} className="-ml-2.5">
            {article.title}
          </LinkButton>
        }
        eyebrow="Edit article"
        title="Change the article or its schedule"
        description="Changes apply to the next send. Emails already sent aren't affected."
      />
      <ArticleForm
        timezone={env.timezone}
        doctorCount={await countActiveDoctors()}
        senderName={env.email.fromName}
        initial={{
          id: article.id,
          title: article.title,
          subject: article.subject === article.title ? "" : article.subject,
          message: article.message,
          recurrence: article.recurrence,
          startAt: toLocalInput(article.startAt),
          endDate: article.endAt ? toLocalDateInput(article.endAt) : "",
          pdfName: article.pdfName,
          pdfSize: article.pdfSize,
        }}
      />
    </>
  );
}
