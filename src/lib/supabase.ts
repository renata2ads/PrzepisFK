import { createClient } from "@supabase/supabase-js";

// Klient publiczny (klucz anon) — odczyt chroniony przez RLS
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

export type Category = { id: number; slug: string; name: string };

export type Article = {
  id: number;
  url: string;
  title: string;
  published_at: string | null;
  summary: string | null;
  impact: string | null;
  effective_date: string | null;
  form_link: string | null;
  sources: { name: string } | null;
  categories: { slug: string; name: string }[];
  article_qa: { question: string; answer: string; sort: number }[];
};

const ARTICLE_FIELDS =
  "id, url, title, published_at, summary, impact, effective_date, form_link, sources(name), categories(slug, name), article_qa(question, answer, sort)";

export async function getCategories() {
  const { data, error } = await supabase.from("categories").select("id, slug, name").order("sort");
  if (error) throw error;
  return data as Category[];
}

type ArticleFilter = { categoryIds?: number[]; articleIds?: number[]; query?: string };

export async function getArticles({ categoryIds, articleIds, query }: ArticleFilter) {
  let req = supabase
    .from("articles")
    .select(ARTICLE_FIELDS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (categoryIds) {
    const { data: links, error } = await supabase
      .from("article_categories")
      .select("article_id")
      .in("category_id", categoryIds);
    if (error) throw error;
    req = req.in("id", [...new Set(links.map((l) => l.article_id))]);
  }
  if (articleIds) req = req.in("id", articleIds);

  // znaki specjalne składni filtra PostgREST usuwamy z frazy
  const q = query?.replace(/[%,()*\\]/g, " ").trim();
  if (q) req = req.or(`title.ilike.%${q}%,summary.ilike.%${q}%,impact.ilike.%${q}%`);

  const { data, error } = await req;
  if (error) throw error;
  return data as unknown as Article[];
}
