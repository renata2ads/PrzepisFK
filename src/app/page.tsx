import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { getArticles, getCategories } from "@/lib/supabase";

export const revalidate = 300; // odśwież listę co 5 minut

type Props = { searchParams: Promise<{ k?: string; q?: string }> };

export default async function Home({ searchParams }: Props) {
  const { k, q } = await searchParams;
  const categories = await getCategories();
  const active = categories.find((c) => c.slug === k);
  const articles = await getArticles({ categoryId: active?.id, query: q });

  const href = (slug?: string) => {
    const p = new URLSearchParams();
    if (slug) p.set("k", slug);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <header className="bg-[#14213d] px-4 py-8 text-white sm:px-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            <Link href="/">PrzepisFK</Link>
          </h1>
          <p className="mt-2 max-w-xl opacity-90">
            Zmiany w przepisach finansowo-księgowych, streszczone przez AI i dopasowane do Twoich obszarów.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-10">
        <form action="/" className="flex gap-2">
          {k && <input type="hidden" name="k" value={k} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Szukaj, np. KSeF, Rb-27S, amortyzacja…"
            aria-label="Szukaj we wpisach"
            className="min-w-0 flex-1 rounded-lg border border-[#dde1ea] bg-white px-3 py-2 outline-none focus:border-[#c2410c]"
          />
          <button className="rounded-lg bg-[#c2410c] px-4 py-2 font-semibold text-white hover:bg-[#9a3412]">Szukaj</button>
        </form>

        <nav aria-label="Kategorie" className="mt-4 flex flex-wrap gap-2">
          {[{ slug: undefined, name: "Wszystkie" }, ...categories].map((c) => {
            const isActive = c.slug === active?.slug;
            return (
              <Link
                key={c.name}
                href={href(c.slug)}
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
              Brak wpisów{q ? ` dla „${q}”` : ""}
              {active ? ` w kategorii ${active.name}` : ""}.
            </p>
          ) : (
            articles.map((a) => <ArticleCard key={a.id} article={a} />)
          )}
        </div>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-[#5b6478]">
        PrzepisFK informuje, nie doradza — decyzje opieraj na treści przepisu.
      </footer>
    </div>
  );
}
