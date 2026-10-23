import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { EntryTabs } from "@/components/EntryTabs";
import { SiteHeader } from "@/components/SiteHeader";
import { getArticles, getCategories, PAGE_SIZE } from "@/lib/supabase";
import { createSessionClient } from "@/lib/supabase-server";

export const revalidate = 300; // odśwież listę co 5 minut

type Props = { searchParams: Promise<{ k?: string; q?: string; widok?: string; strona?: string }> };

export default async function Home({ searchParams }: Props) {
  const { k, q, widok, strona } = await searchParams;
  const drafts = widok === "projekty";
  const page = Math.max(1, Number(strona) || 1);
  const categories = await getCategories();
  const active = categories.find((c) => c.slug === k);
  const found = await getArticles({
    categoryIds: active ? [active.id] : undefined,
    query: q,
    stages: drafts ? ["draft"] : ["news", "act"],
    page,
  });
  const hasMore = found.length > PAGE_SIZE;
  const articles = found.slice(0, PAGE_SIZE);

  // zalogowany widzi przyciski zakładek
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const bookmarkIds = data.user
    ? new Set((await supabase.from("bookmarks").select("article_id")).data?.map((b) => b.article_id))
    : null;

  const href = ({ slug = active?.slug, view = widok, toPage }: { slug?: string; view?: string; toPage?: number }) => {
    const p = new URLSearchParams();
    if (view) p.set("widok", view);
    if (slug) p.set("k", slug);
    if (q) p.set("q", q);
    if (toPage && toPage > 1) p.set("strona", String(toPage));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-10">
        <EntryTabs active={drafts ? "projekty" : "zmiany"} hrefs={{ zmiany: href({ view: "" }), projekty: href({ view: "projekty" }) }} />

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

        {(page > 1 || hasMore) && (
          <nav aria-label="Strony" className="mt-6 flex items-center justify-between text-sm font-semibold">
            {page > 1 ? (
              <Link href={href({ toPage: page - 1 })} className="rounded-lg bg-white px-4 py-2 ring-1 ring-[#dde1ea] hover:ring-[#c2410c]">
                ← Nowsze
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[#5b6478]">Strona {page}</span>
            {hasMore ? (
              <Link href={href({ toPage: page + 1 })} className="rounded-lg bg-white px-4 py-2 ring-1 ring-[#dde1ea] hover:ring-[#c2410c]">
                Starsze wpisy →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-[#5b6478]">
        PrzepisFK informuje, nie doradza — decyzje opieraj na treści przepisu.
      </footer>
    </div>
  );
}
