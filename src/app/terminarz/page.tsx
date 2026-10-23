import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { IMPACT_TYPES, isImpactType, PRIORITY } from "@/lib/impact";
import { getCategories, getUpcoming, type Article } from "@/lib/supabase";

export const metadata = { title: "Terminarz zmian · PrzepisFK" };
export const revalidate = 300;

type Props = { searchParams: Promise<{ k?: string; okres?: string }> };

const HORIZONS = [3, 6, 12];
const monthFmt = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

const PRIORITY_DOT = { high: "bg-red-700", medium: "bg-amber-500", info: "bg-gray-400" } as const;

export default async function SchedulePage({ searchParams }: Props) {
  const { k, okres } = await searchParams;
  const months = HORIZONS.includes(Number(okres)) ? Number(okres) : 6;
  const categories = await getCategories();
  const active = categories.find((c) => c.slug === k);

  const today = new Date();
  const until = new Date(today);
  until.setMonth(until.getMonth() + months);
  const articles = await getUpcoming({ from: iso(today), to: iso(until), categoryId: active?.id });

  // grupowanie po miesiącu wejścia w życie
  const groups = new Map<string, Article[]>();
  for (const a of articles) {
    const key = a.effective_date!.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const high = articles.filter((a) => a.priority === "high").length;

  const href = (p: { k?: string; okres?: number }) => {
    const q = new URLSearchParams();
    const slug = "k" in p ? p.k : active?.slug;
    if (slug) q.set("k", slug);
    const m = p.okres ?? months;
    if (m !== 6) q.set("okres", String(m));
    const s = q.toString();
    return s ? `/terminarz?${s}` : "/terminarz";
  };
  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-[#14213d] text-white" : "bg-white ring-1 ring-[#dde1ea] hover:ring-[#c2410c]"}`;

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-10">
        <h1 className="text-2xl font-bold">Terminarz zmian</h1>
        <p className="mt-1 text-[#5b6478]">
          Co wchodzi w życie w najbliższych {months} miesiącach — {articles.length} zmian
          {high ? `, w tym ${high} pilnych` : ""}. Projekty ustaw pokazują planowaną datę.
        </p>

        <nav aria-label="Horyzont" className="mt-4 flex flex-wrap gap-2">
          {HORIZONS.map((m) => (
            <Link key={m} href={href({ okres: m })} className={chip(m === months)}>
              {m} mies.
            </Link>
          ))}
        </nav>
        <nav aria-label="Obszary" className="mt-2 flex flex-wrap gap-2">
          {[{ slug: undefined, name: "Wszystkie obszary" }, ...categories].map((c) => (
            <Link key={c.name} href={href({ k: c.slug })} className={chip(c.slug === active?.slug)}>
              {c.name}
            </Link>
          ))}
        </nav>

        {articles.length === 0 ? (
          <p className="mt-6 rounded-lg bg-white p-6 text-center text-[#5b6478]">Brak zmian z datą wejścia w życie w tym okresie.</p>
        ) : (
          [...groups].map(([month, items]) => (
            <section key={month} className="mt-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[#c2410c]">
                {monthFmt.format(new Date(`${month}-01`))} · {items.length}
              </h2>
              <ul className="mt-2 divide-y divide-[#dde1ea] rounded-lg bg-white ring-1 ring-[#dde1ea]">
                {items.map((a) => (
                  <li key={a.id} className="flex gap-4 p-4">
                    <div className="w-14 shrink-0 text-center">
                      <div className="text-lg font-bold leading-none">{dayFmt.format(new Date(a.effective_date!)).split(" ")[0]}</div>
                      <div className="text-xs text-[#5b6478]">{dayFmt.format(new Date(a.effective_date!)).split(" ")[1]}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {a.priority && (
                          <span className="flex items-center gap-1 font-semibold">
                            <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[a.priority]}`} aria-hidden />
                            {PRIORITY[a.priority].short}
                          </span>
                        )}
                        {a.stage === "draft" && <span className="rounded bg-amber-100 px-1.5 text-amber-900">projekt</span>}
                        {a.categories.map((c) => (
                          <span key={c.slug} className="rounded-full bg-[#fdeee4] px-2 font-semibold text-[#c2410c]">{c.name}</span>
                        ))}
                      </div>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold leading-snug hover:text-[#c2410c] hover:underline">
                        {a.title}
                      </a>
                      {a.system_impact && <p className="mt-1 text-sm text-[#5b6478]">{a.system_impact}</p>}
                      {a.impact_types.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {a.impact_types.filter(isImpactType).map((t) => (
                            <span key={t} className="rounded bg-[#e9ecf2] px-2 py-0.5 text-xs font-semibold">{IMPACT_TYPES[t]}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
