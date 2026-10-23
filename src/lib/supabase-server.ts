import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// Klient z sesją zalogowanego użytkownika (ciasteczka) — dla stron i akcji serwerowych
export const createSessionClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // wywołane z komponentu serwerowego — sesję odświeża proxy (src/proxy.ts)
          }
        },
      },
    },
  );
});

// Jedno sprawdzenie użytkownika na żądanie (strona i nagłówek korzystają z tego samego wyniku)
export const getUser = cache(async () => {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
