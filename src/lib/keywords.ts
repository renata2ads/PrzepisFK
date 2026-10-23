import type { SupabaseClient } from "@supabase/supabase-js";

// Filtr PostgREST: wpis zawiera którekolwiek ze słów (w tytule, streszczeniu albo wpływie na system)
export const keywordFilter = (keywords: string[]) =>
  keywords
    .flatMap((k) => ["title", "summary", "system_impact"].map((f) => `${f}.ilike.%${k.replace(/[%,()*\\]/g, "")}%`))
    .join(",");

// Id opublikowanych wpisów z dowolnym ze słów kluczowych użytkownika
export async function keywordArticleIds(db: SupabaseClient, keywords: string[]) {
  if (!keywords.length) return [];
  const { data } = await db.from("articles").select("id").eq("status", "done").or(keywordFilter(keywords)).limit(300);
  return (data ?? []).map((r) => r.id as number);
}

export const keywordsIn = (text: string, keywords: string[]) =>
  keywords.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
