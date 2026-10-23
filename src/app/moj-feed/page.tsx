import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getUser } from "@/lib/supabase-server";

export const metadata = { title: "Mój PrzepisFK" };

// Pełny feed z wybranych kategorii — etap 6
export default async function MyFeedPage() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-10">
        <h1 className="text-2xl font-bold">Mój PrzepisFK</h1>
        <p className="mt-2 text-[#5b6478]">Zalogowano jako {user?.email}.</p>
        <p className="mt-6 rounded-lg bg-white p-6 ring-1 ring-[#dde1ea]">
          Wkrótce zobaczysz tu wpisy tylko z wybranych obszarów. Na razie{" "}
          <Link href="/" className="font-semibold text-[#c2410c] underline">przeglądaj wszystkie wpisy</Link>.
        </p>
      </main>
    </div>
  );
}
