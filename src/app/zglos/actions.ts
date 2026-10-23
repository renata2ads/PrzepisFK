"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-server";

export type SubmitState = { error?: string; info?: string };

export async function submitLink(_: SubmitState, form: FormData): Promise<SubmitState> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie?dalej=/zglos");

  const raw = String(form.get("url") ?? "").trim();
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  let url: URL;
  try {
    url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    return { error: "To nie wygląda na poprawny link (powinien zaczynać się od https://)." };
  }

  const { error } = await supabase.from("submissions").insert({ url: url.toString(), note });
  if (error) {
    // RLS odrzuca wiersz po przekroczeniu limitu 5 zgłoszeń na dobę
    if (error.code === "42501") return { error: "Limit 5 zgłoszeń na dobę został wyczerpany. Spróbuj jutro." };
    return { error: "Nie udało się zapisać zgłoszenia." };
  }

  revalidatePath("/zglos");
  return { info: "Dziękujemy! Link zostanie streszczony przy najbliższym przebiegu skryptu." };
}
