import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getArticles, getCategories } from "@/lib/supabase";
import { createSessionClient } from "@/lib/supabase-server";

export const metadata = { title: "Mój PrzepisFK" };

type Props = { searchParams: Promise<{ widok?: string }> };

export default async function MyFeedPage({ searchParams }: Props) {
  const { widok } = await searchParams;
  const saved = widok === "zapisane";

  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user!; // middleware wpuszcza tu tylko zalogowanych

  const [categories, { data: chosen }, { data: marks }] = await Promise.all([
    getCategories(),
    supabase.from("user_categories").select("category_id").eq("user_id", user.id),
    supabase.from("bookmarks").select("article_id").eq("user_id", user.id),
  ]);
  const chosenIds = (chosen ?? []).map((c) => c.category_id);
  const bookmarkIds = new Set((marks ?? []).map((m) => m.article_id));

  const articles = saved
    ? await getArticles({ articleIds: [...bookmarkIds] })
    : chosenIds.length
      ? await getArticles({ categoryIds: chosenIds })
      : [];

  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-[#14213d] text-white" : "bg-white ring-1 ring-[#dde1ea] hover:ring-[#c2410c]"}`;

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-10">
        <h1 className="text-2xl font-bold">Mój PrzepisFK</h1>

        {chosenIds.length > 0 && (
          <p className="mt-1 text-sm text-[#5b6478]">
            Twoje obszary: {categories.filter((c) => chosenIds.includes(c.id)).map((c) => c.name).join(", ")} ·{" "}
            <Link href="/ustawienia" className="text-[#c2410c] underline">zmień</Link>
          </p>
        )}

        <nav className="mt-4 flex gap-2">
          <Link href="/moj-feed" className={tab(!saved)}>Mój feed</Link>
          <Link href="/moj-feed?widok=zapisane" className={tab(saved)}>Zapisane ({bookmarkIds.size})</Link>
        </nav>

        <div className="mt-6 space-y-4">
          {!saved && chosenIds.length === 0 ? (
            <p className="rounded-lg bg-white p-6 text-center">
              Nie wybrano jeszcze obszarów.{" "}
              <Link href="/ustawienia" className="font-semibold text-[#c2410c] underline">Wybierz je w ustawieniach</Link>.
            </p>
          ) : articles.length === 0 ? (
            <p className="rounded-lg bg-white p-6 text-center text-[#5b6478]">
              {saved ? "Nie masz jeszcze zapisanych wpisów." : "Brak wpisów w Twoich obszarach."}
            </p>
          ) : (
            articles.map((a) => <ArticleCard key={a.id} article={a} bookmarked={bookmarkIds.has(a.id)} />)
          )}
        </div>
      </main>
    </div>
  );
}
