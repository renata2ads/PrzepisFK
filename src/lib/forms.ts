import type { SupabaseClient } from "@supabase/supabase-js";

// Źródła druków nazywają się „Druki · <grupa>” — grupa to nazwa bez przedrostka
export const FORMS_PREFIX = "Druki · ";

// Id opublikowanych nowych wersji druków z wybranych grup
export async function formArticleIds(db: SupabaseClient, groups: string[]) {
  if (!groups.length) return [];
  const { data: sources } = await db.from("sources").select("id").in("name", groups.map((g) => FORMS_PREFIX + g));
  if (!sources?.length) return [];
  const { data } = await db.from("articles").select("id").eq("status", "done").in("source_id", sources.map((s) => s.id)).limit(300);
  return (data ?? []).map((r) => r.id as number);
}
