import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { SiteHeader } from "@/components/SiteHeader";
import { keywordArticleIds, keywordsIn } from "@/lib/keywords";
import { getArticles, getCategories, type Review } from "@/lib/supabase";
import { createSessionClient } from "@/lib/supabase-server";

export const metadata = { title: "Mój PrzepisFK" };

type Props = { searchParams: Promise<{ widok?: string }> };

// widoki: feed (domyślny), do-weryfikacji, wplywa, zapisane
export default async function MyFeedPage({ searchParams }: Props) {
  const { widok } = await searchParams;
  const view = ["do-weryfikacji", "wplywa", "zapisane"].includes(widok ?? "") ? widok! : "feed";

  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user!; // proxy (src/proxy.ts) wpuszcza tu tylko zalogowanych

  const [categories, { data: chosen }, { data: marks }, { data: profile }] = await Promise.all([
    getCategories(),
    supabase.from("user_categories").select("category_id").eq("user_id", user.id),
    supabase.from("bookmarks").select("article_id").eq("user_id", user.id),
    supabase.from("profiles").select("keywords").eq("id", user.id).single(),
  ]);
  const chosenIds = (chosen ?? []).map((c) => c.category_id);
  const bookmarkIds = new Set((marks ?? []).map((m) => m.article_id));
  const keywords: string[] = profile?.keywords ?? [];
  const keywordIds = await keywordArticleIds(supabase, keywords);

  // Wpisy z moich obszarów i oceny w moich obszarach → co czeka na weryfikację, co wpływa
  const [{ data: links }, { data: myReviews }] = chosenIds.length
    ? await Promise.all([
        supabase.from("article_categories").select("article_id, category_id").in("category_id", chosenIds),
        supabase.from("article_reviews").select("article_id, category_id, status").in("category_id", chosenIds),
      ])
    : [{ data: [] }, { data: [] }];
  const reviewed = new Set((myReviews ?? []).map((r) => `${r.article_id}:${r.category_id}`));
  const unreviewed = [...new Set((links ?? []).filter((l) => !reviewed.has(`${l.article_id}:${l.category_id}`)).map((l) => l.article_id))];
  const { data: pendingRows } = unreviewed.length
    ? await supabase.from("articles").select("id").in("id", unreviewed).neq("priority", "info")
    : { data: [] };
  const pendingIds = (pendingRows ?? []).map((r) => r.id as number);
  const affectsIds = [...new Set((myReviews ?? []).filter((r) => r.status === "affects").map((r) => r.article_id))];

  const articles =
    view === "zapisane" ? await getArticles({ articleIds: [...bookmarkIds] })
    : view === "do-weryfikacji" ? (pendingIds.length ? await getArticles({ articleIds: pendingIds }) : [])
    : view === "wplywa" ? (affectsIds.length ? await getArticles({ articleIds: affectsIds }) : [])
    : chosenIds.length || keywordIds.length
      ? await getArticles({ articleIds: [...new Set([...(links ?? []).map((l) => l.article_id), ...keywordIds])] })
      : [];

  const { data: reviewRows } = articles.length
    ? await supabase
        .from("article_reviews")
        .select("article_id, category_id, status, comment, reviewer, updated_at")
        .in("article_id", articles.map((a) => a.id))
    : { data: [] };
  const reviews = (reviewRows ?? []) as Review[];

  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-[#14213d] text-white" : "bg-white ring-1 ring-[#dde1ea] hover:ring-[#c2410c]"}`;
  const empty = {
    feed: "Brak wpisów w Twoich obszarach.",
    "do-weryfikacji": "Wszystko ocenione — brak wpisów czekających na weryfikację.",
    wplywa: "Nikt jeszcze nie oznaczył wpisu z Twoich obszarów jako „Wpływa”.",
    zapisane: "Nie masz jeszcze zapisanych wpisów.",
  }[view];

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-10">
        <h1 className="text-2xl font-bold">Mój PrzepisFK</h1>

        {(chosenIds.length > 0 || keywords.length > 0) && (
          <p className="mt-1 text-sm text-[#5b6478]">
            Twoje obszary: {categories.filter((c) => chosenIds.includes(c.id)).map((c) => c.name).join(", ") || "brak"}
            {keywords.length > 0 && <> · słowa kluczowe: {keywords.join(", ")}</>} ·{" "}
            <Link href="/ustawienia" className="text-[#c2410c] underline">zmień</Link>
          </p>
        )}

        <nav className="mt-4 flex flex-wrap gap-2">
          <Link href="/moj-feed" className={tab(view === "feed")}>Mój feed</Link>
          <Link href="/moj-feed?widok=do-weryfikacji" className={tab(view === "do-weryfikacji")}>Do weryfikacji ({pendingIds.length})</Link>
          <Link href="/moj-feed?widok=wplywa" className={tab(view === "wplywa")}>Wpływa ({affectsIds.length})</Link>
          <Link href="/moj-feed?widok=zapisane" className={tab(view === "zapisane")}>Zapisane ({bookmarkIds.size})</Link>
        </nav>

        <div className="mt-6 space-y-4">
          {view !== "zapisane" && chosenIds.length === 0 && (view !== "feed" || keywords.length === 0) ? (
            <p className="rounded-lg bg-white p-6 text-center">
              Nie wybrano jeszcze obszarów.{" "}
              <Link href="/ustawienia" className="font-semibold text-[#c2410c] underline">Wybierz je w ustawieniach</Link>.
            </p>
          ) : articles.length === 0 ? (
            <p className="rounded-lg bg-white p-6 text-center text-[#5b6478]">{empty}</p>
          ) : (
            articles.map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                bookmarked={bookmarkIds.has(a.id)}
                keywords={keywordsIn(`${a.title} ${a.summary ?? ""} ${a.system_impact ?? ""}`, keywords)}
                review={{ reviews: reviews.filter((r) => r.article_id === a.id), myCategoryIds: chosenIds }}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
