import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { IMPACT_TYPES, isImpactType, PRIORITY } from "@/lib/impact";
import { FORMS_PREFIX, getFormVersions, type Article } from "@/lib/supabase";

export const metadata = { title: "Druki · PrzepisFK" };
export const revalidate = 300;

type Props = { searchParams: Promise<{ g?: string }> };

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" });
const PRIORITY_DOT = { high: "bg-red-700", medium: "bg-amber-500", info: "bg-gray-400" } as const;
const groupOf = (a: Article) => (a.sources?.name ?? "").replace(FORMS_PREFIX, "");

// Nowe wersje druków (Druki Gofin) w grupach: sprawozdania budżetowe, JPK, sprawozdania finansowe…
export default async function FormsPage({ searchParams }: Props) {
  const { g } = await searchParams;
  const { groups, articles: all } = await getFormVersions();
  const active = groups.includes(g ?? "") ? g : undefined;
  const articles = active ? all.filter((a) => groupOf(a) === active) : all;

  const byGroup = new Map<string, Article[]>();
  for (const a of articles) byGroup.set(groupOf(a), [...(byGroup.get(groupOf(a)) ?? []), a]);

  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-[#14213d] text-white" : "bg-white ring-1 ring-[#dde1ea] hover:ring-[#c2410c]"}`;

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-10">
        <h1 className="text-2xl font-bold">Nowe wersje druków</h1>
        <p className="mt-1 text-[#5b6478]">
          Druki Gofin sprawdzane codziennie — nowa wersja druku (data „obowiązuje od”) pojawia się tu z oceną wpływu na system.
        </p>

        <nav aria-label="Grupy druków" className="mt-4 flex flex-wrap gap-2">
          <Link href="/druki" className={chip(!active)}>Wszystkie</Link>
          {groups.map((name) => (
            <Link key={name} href={`/druki?g=${encodeURIComponent(name)}`} className={chip(name === active)}>
              {name}
            </Link>
          ))}
        </nav>

        {articles.length === 0 ? (
          <p className="mt-6 rounded-lg bg-white p-6 text-center text-[#5b6478]">
            {active ? `Brak nowych wersji w grupie „${active}”` : "Brak nowych wersji druków"} z ostatnich 90 dni — skrypt
            sprawdza je przy każdym porannym przebiegu.
          </p>
        ) : (
          [...byGroup].map(([name, items]) => (
            <section key={name} className="mt-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[#c2410c]">{name} · {items.length}</h2>
              <ul className="mt-2 divide-y divide-[#dde1ea] rounded-lg bg-white ring-1 ring-[#dde1ea]">
                {items.map((a) => (
                  <li key={a.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {a.priority && (
                        <span className="flex items-center gap-1 font-semibold">
                          <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[a.priority]}`} aria-hidden />
                          {PRIORITY[a.priority].short}
                        </span>
                      )}
                      {a.effective_date && <span>obowiązuje od <b>{dateFmt.format(new Date(a.effective_date))}</b></span>}
                      {a.categories.map((c) => (
                        <span key={c.slug} className="rounded-full bg-[#fdeee4] px-2 font-semibold text-[#c2410c]">{c.name}</span>
                      ))}
                    </div>
                    <a href={a.form_link ?? a.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold leading-snug hover:text-[#c2410c] hover:underline">
                      {a.title}
                    </a>
                    {a.summary && <p className="mt-1 text-sm">{a.summary}</p>}
                    {a.system_impact && <p className="mt-1 text-sm text-[#5b6478]"><b>Wpływ na system:</b> {a.system_impact}</p>}
                    {a.impact_types.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {a.impact_types.filter(isImpactType).map((t) => (
                          <span key={t} className="rounded bg-[#e9ecf2] px-2 py-0.5 text-xs font-semibold">{IMPACT_TYPES[t]}</span>
                        ))}
                      </div>
                    )}
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
