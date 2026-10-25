import { ArrowLeft } from "lucide-react";
import { ArticleForm } from "@/components/article-form";
import { LinkButton, PageHeader } from "@/components/ui";
import { env } from "@/lib/env";
import { countActiveDoctors } from "@/lib/queries";

export const metadata = { title: "New article" };

export default async function NewArticlePage() {
  return (
    <>
      <PageHeader
        back={
          <LinkButton href="/articles" variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />} className="-ml-2.5">
            Articles
          </LinkButton>
        }
        eyebrow="New article"
        title="Schedule an article"
        description="Attach the PDF, choose when it goes out and write a short note. You can send yourself a test before it reaches anyone."
      />
      <ArticleForm timezone={env.timezone} doctorCount={await countActiveDoctors()} senderName={env.email.fromName} />
    </>
  );
}
