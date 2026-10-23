import { SettingsForm } from "@/components/SettingsForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getCategories } from "@/lib/supabase";
import { createSessionClient } from "@/lib/supabase-server";

export const metadata = { title: "Ustawienia · PrzepisFK" };

export default async function SettingsPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user!; // middleware wpuszcza tu tylko zalogowanych

  const [categories, { data: chosen }, { data: profile }] = await Promise.all([
    getCategories(),
    supabase.from("user_categories").select("category_id").eq("user_id", user.id),
    supabase.from("profiles").select("email_frequency").eq("id", user.id).single(),
  ]);

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-10">
        <h1 className="text-2xl font-bold">Ustawienia</h1>
        <p className="mb-6 mt-1 text-[#5b6478]">Konto: {user.email}</p>
        <SettingsForm
          categories={categories}
          selected={(chosen ?? []).map((c) => c.category_id)}
          frequency={profile?.email_frequency ?? "none"}
        />
      </main>
    </div>
  );
}
