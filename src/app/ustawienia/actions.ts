"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-server";

export type SettingsState = { error?: string; info?: string };

const FREQUENCIES = ["none", "daily", "weekly"];

export async function saveSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie");
  const userId = data.user.id;

  const categoryIds = form.getAll("kategoria").map(Number).filter(Number.isInteger);
  const frequency = String(form.get("czestotliwosc"));

  // Zastępujemy cały wybór kategorii nowym (RLS pilnuje, że tylko własne wiersze)
  const del = await supabase.from("user_categories").delete().eq("user_id", userId);
  if (del.error) return { error: "Nie udało się zapisać kategorii." };
  if (categoryIds.length) {
    const ins = await supabase
      .from("user_categories")
      .insert(categoryIds.map((category_id) => ({ user_id: userId, category_id })));
    if (ins.error) return { error: "Nie udało się zapisać kategorii." };
  }

  const upd = await supabase
    .from("profiles")
    .update({ email_frequency: FREQUENCIES.includes(frequency) ? frequency : "none" })
    .eq("id", userId);
  if (upd.error) return { error: "Nie udało się zapisać ustawień powiadomień." };

  revalidatePath("/moj-feed");
  return { info: "Zapisano. Twój feed już uwzględnia zmiany." };
}

export async function deleteAccount() {
  const supabase = await createSessionClient();
  await supabase.rpc("delete_my_account");
  await supabase.auth.signOut();
  redirect("/?konto=usuniete");
}

export async function toggleBookmark(articleId: number, bookmarked: boolean) {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie");

  if (bookmarked) {
    await supabase.from("bookmarks").delete().eq("user_id", data.user.id).eq("article_id", articleId);
  } else {
    await supabase.from("bookmarks").insert({ user_id: data.user.id, article_id: articleId });
  }
  revalidatePath("/", "layout");
}
