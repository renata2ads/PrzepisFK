import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getArticles, getCategories } from "@/lib/supabase";
import { createSessionClient } from "@/lib/supabase-server";

export const revalidate = 300; // odśwież listę co 5 minut

type Props = { searchParams: Promise<{ k?: string; q?: string; widok?: string }> };

export default async function Home({ searchParams }: Props) {
  const { k, q, widok } = await searchParams;
  const drafts = widok === "projekty";
  const categories = await getCategories();
  const active = categories.find((c) => c.slug === k);
  const articles = await getArticles({
    categoryIds: active ? [active.id] : undefined,
    query: q,
    stages: drafts ? ["draft"] : ["news", "act"],
  });

  // zalogowany widzi przyciski zakładek
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const bookmarkIds = data.user
    ? new Set((await supabase.from("bookmarks").select("article_id")).data?.map((b) => b.article_id))
    : null;

  const href = ({ slug = active?.slug, view = widok }: { slug?: string; view?: string }) => {
    const p = new URLSearchParams();
    if (view) p.set("widok", view);
    if (slug) p.set("k", slug);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const tab = (isActive: boolean) =>
    `border-b-2 px-1 pb-2 font-semibold ${isActive ? "border-[#c2410c] text-[#14213d]" : "border-transparent text-[#5b6478] hover:text-[#14213d]"}`;

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-10">
        <nav aria-label="Rodzaj wpisów" className="mb-5 flex gap-6 border-b border-[#dde1ea]">
          <Link href={href({ view: "" })} aria-current={!drafts ? "page" : undefined} className={tab(!drafts)}>
            Zmiany w przepisach
          </Link>
          <Link href={href({ view: "projekty" })} aria-current={drafts ? "page" : undefined} className={tab(drafts)}>
            Projekty przepisów
          </Link>
        </nav>

        {drafts && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            Projekty ustaw skierowane do Sejmu — <b>jeszcze nie obowiązują</b> i mogą się zmienić w trakcie prac.
          </p>
        )}

        <form action="/" className="flex gap-2">
          {widok && <input type="hidden" name="widok" value={widok} />}
          {k && <input type="hidden" name="k" value={k} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Szukaj, np. KSeF, Rb-27S, klasyfikacja…"
            aria-label="Szukaj we wpisach"
            className="min-w-0 flex-1 rounded-lg border border-[#dde1ea] bg-white px-3 py-2 outline-none focus:border-[#c2410c]"
          />
          <button className="rounded-lg bg-[#c2410c] px-4 py-2 font-semibold text-white hover:bg-[#9a3412]">Szukaj</button>
        </form>

        <nav aria-label="Kategorie" className="mt-4 flex flex-wrap gap-2">
          {[{ slug: "", name: "Wszystkie" }, ...categories].map((c) => {
            const isActive = (c.slug || undefined) === active?.slug;
            return (
              <Link
                key={c.name}
                href={href({ slug: c.slug })}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  isActive ? "bg-[#14213d] text-white" : "bg-white ring-1 ring-[#dde1ea] hover:ring-[#c2410c]"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 space-y-4">
          {articles.length === 0 ? (
            <p className="rounded-lg bg-white p-6 text-center text-[#5b6478]">
              Brak {drafts ? "projektów" : "wpisów"}
              {q ? ` dla „${q}”` : ""}
              {active ? ` w kategorii ${active.name}` : ""}.
            </p>
          ) : (
            articles.map((a) => <ArticleCard key={a.id} article={a} bookmarked={bookmarkIds?.has(a.id)} />)
          )}
        </div>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-[#5b6478]">
        PrzepisFK informuje, nie doradza — decyzje opieraj na treści przepisu.
      </footer>
    </div>
  );
}
