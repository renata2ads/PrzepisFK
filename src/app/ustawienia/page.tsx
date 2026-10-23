import { SiteHeader } from "@/components/SiteHeader";
import { getUser } from "@/lib/supabase-server";

export const metadata = { title: "Ustawienia · PrzepisFK" };

// Wybór kategorii i powiadomień — etap 6
export default async function SettingsPage() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-10">
        <h1 className="text-2xl font-bold">Ustawienia</h1>
        <p className="mt-2 text-[#5b6478]">Konto: {user?.email}</p>
        <p className="mt-6 rounded-lg bg-white p-6 ring-1 ring-[#dde1ea]">
          Wkrótce wybierzesz tu obszary, które Cię interesują, i częstotliwość e-maili.
        </p>
      </main>
    </div>
  );
}
