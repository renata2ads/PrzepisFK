"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-server";

// Ocena wpływu w obszarze: "affects" / "no_effect", pusty status = cofnięcie oceny
export async function saveReview(articleId: number, form: FormData) {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie");

  const categoryId = Number(form.get("obszar"));
  const status = String(form.get("status") ?? "");
  const comment = String(form.get("komentarz") ?? "").trim().slice(0, 1000) || null;
  if (!Number.isInteger(categoryId)) return;

  if (status === "affects" || status === "no_effect") {
    await supabase.from("article_reviews").upsert({
      article_id: articleId,
      category_id: categoryId,
      status,
      comment,
      user_id: data.user.id,
      reviewer: data.user.email,
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabase.from("article_reviews").delete().eq("article_id", articleId).eq("category_id", categoryId);
  }
  revalidatePath("/moj-feed");
}
