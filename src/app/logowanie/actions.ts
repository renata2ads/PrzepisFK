"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-server";

export type FormState = { error?: string; info?: string };

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/moj-feed";
};

// Komunikaty Supabase po polsku
function polish(message: string) {
  if (/invalid login credentials/i.test(message)) return "Nieprawidłowy e-mail lub hasło.";
  if (/email not confirmed/i.test(message)) return "Potwierdź najpierw adres e-mail — link wysłaliśmy w wiadomości.";
  if (/already registered/i.test(message)) return "Konto z tym adresem już istnieje — zaloguj się.";
  if (/at least 6 characters|password should be/i.test(message)) return "Hasło musi mieć co najmniej 6 znaków.";
  if (/rate limit/i.test(message)) return "Zbyt wiele prób. Spróbuj ponownie za kilka minut.";
  return `Coś poszło nie tak: ${message}`;
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) return { error: polish(error.message) };
  redirect(safeNext(form.get("dalej")));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signUp({
    email: String(form.get("email")),
    password: String(form.get("password")),
    options: { emailRedirectTo: `${await origin()}/auth/callback?dalej=/ustawienia` },
  });
  if (error) return { error: polish(error.message) };
  return { info: "Sprawdź skrzynkę — wysłaliśmy link potwierdzający konto." };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(String(form.get("email")), {
    redirectTo: `${await origin()}/auth/callback?dalej=/nowe-haslo`,
  });
  if (error) return { error: polish(error.message) };
  return { info: "Jeśli konto istnieje, wysłaliśmy link do ustawienia nowego hasła." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.updateUser({ password: String(form.get("password")) });
  if (error) return { error: polish(error.message) };
  redirect("/moj-feed");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/");
}
