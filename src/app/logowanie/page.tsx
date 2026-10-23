import { redirect } from "next/navigation";
import { LoginForms } from "@/components/AuthForms";
import { SiteHeader } from "@/components/SiteHeader";
import { getUser } from "@/lib/supabase-server";

export const metadata = { title: "Logowanie · PrzepisFK" };

type Props = { searchParams: Promise<{ dalej?: string; blad?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { dalej, blad } = await searchParams;
  const safe = dalej?.startsWith("/") && !dalej.startsWith("//") ? dalej : "/moj-feed";
  if (await getUser()) redirect(safe);

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="mb-5 text-center text-[#5b6478]">
          Zaloguj się, żeby wybrać swoje obszary i dostawać powiadomienia.
        </p>
        <LoginForms next={dalej} linkError={blad === "link"} />
      </main>
    </div>
  );
}
