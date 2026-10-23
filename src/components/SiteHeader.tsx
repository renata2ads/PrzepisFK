import Link from "next/link";
import { signOut } from "@/app/logowanie/actions";
import { getUser } from "@/lib/supabase-server";

export async function SiteHeader({ subtitle = true }: { subtitle?: boolean }) {
  const user = await getUser();

  return (
    <header className="bg-[#14213d] px-4 py-6 text-white sm:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            PrzepisFK
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link href="/terminarz" className="hover:underline">Terminarz</Link>            {user ? (
              <>
                <Link href="/moj-feed" className="font-semibold hover:underline">Mój PrzepisFK</Link>
                <Link href="/zglos" className="hover:underline">Zgłoś link</Link>
                <Link href="/ustawienia" className="hover:underline">Ustawienia</Link>
                <span className="hidden opacity-70 sm:inline">{user.email}</span>
                <form action={signOut}>
                  <button className="rounded-md border border-white/40 px-3 py-1 hover:bg-white/10">Wyloguj</button>
                </form>
              </>
            ) : (
              <Link href="/logowanie" className="rounded-md bg-[#c2410c] px-3 py-1.5 font-semibold hover:bg-[#9a3412]">
                Zaloguj się
              </Link>
            )}
          </nav>
        </div>
        {subtitle && (
          <p className="mt-2 max-w-xl opacity-90">
            Zmiany w przepisach dla JST i jednostek budżetowych, streszczone przez AI i dopasowane do Twoich obszarów.
          </p>
        )}
      </div>
    </header>
  );
}
