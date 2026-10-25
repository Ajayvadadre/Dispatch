import { handler } from "@/lib/api";
import { createArticle } from "@/lib/articles";

export const POST = handler(async (req: Request) => ({ article: await createArticle(await req.formData()) }));
