import { createClient } from "@supabase/supabase-js";

// Klient publiczny (klucz anon) — odczyt chroniony przez RLS
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

export type Category = { id: number; slug: string; name: string };

// news = artykuł prasowy, act = akt prawny (Dziennik Ustaw), draft = projekt przepisu
export type Stage = "news" | "act" | "draft";

export type Article = {
  id: number;
  url: string;
  title: string;
  published_at: string | null;
  summary: string | null;
  impact: string | null;
  effective_date: string | null;
  form_link: string | null;
  stage: Stage;
  system_impact: string | null;
  impact_types: string[];
  priority: "high" | "medium" | "info" | null;
  sources: { name: string } | null;
  categories: { id: number; slug: string; name: string }[];
  article_qa: { question: string; answer: string; sort: number }[];
};

// Ocena wpływu w obszarze (tabela article_reviews, widoczna tylko dla zalogowanych)
export type Review = {
  article_id: number;
  category_id: number;
  status: "affects" | "no_effect";
  comment: string | null;
  reviewer: string | null;
  updated_at: string;
};

const ARTICLE_FIELDS =
  "id, url, title, published_at, summary, impact, effective_date, form_link, stage, system_impact, impact_types, priority, sources(name), categories!article_categories(id, slug, name), article_qa(question, answer, sort)";

export async function getCategories() {
  const { data, error } = await supabase.from("categories").select("id, slug, name").order("sort");
  if (error) throw error;
  return data as Category[];
}

// Terminarz: wpisy z datą wejścia w życie w podanym przedziale (rosnąco)
export async function getUpcoming({ from, to, categoryId }: { from: string; to: string; categoryId?: number }) {
  let req = supabase
    .from("articles")
    .select(ARTICLE_FIELDS)
    .gte("effective_date", from)
    .lte("effective_date", to)
    .order("effective_date")
    .limit(300);

  if (categoryId) {
    const { data: links, error } = await supabase.from("article_categories").select("article_id").eq("category_id", categoryId);
    if (error) throw error;
    req = req.in("id", links.map((l) => l.article_id));
  }

  const { data, error } = await req;
  if (error) throw error;
  return data as unknown as Article[];
}

export const PAGE_SIZE = 30;

type ArticleFilter = { categoryIds?: number[]; articleIds?: number[]; query?: string; stages?: Stage[]; page?: number };

// Zwraca o jeden wpis więcej niż PAGE_SIZE — po nim poznajemy, że jest następna strona
export async function getArticles({ categoryIds, articleIds, query, stages, page = 1 }: ArticleFilter) {
  const from = (page - 1) * PAGE_SIZE;
  let req = supabase
    .from("articles")
    .select(ARTICLE_FIELDS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, from + PAGE_SIZE);

  if (stages) req = req.in("stage", stages);

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
