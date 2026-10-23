import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SubmitForm } from "@/components/SubmitForm";
import { createSessionClient } from "@/lib/supabase-server";

export const metadata = { title: "Zgłoś link · PrzepisFK" };

const STATUS = {
  pending: { label: "Czeka na streszczenie", cls: "bg-amber-100 text-amber-900" },
  done: { label: "Opublikowany", cls: "bg-green-100 text-green-900" },
  rejected: { label: "Poza zakresem JST", cls: "bg-gray-100 text-gray-700" },
  error: { label: "Nie udało się odczytać", cls: "bg-red-100 text-red-800" },
} as const;

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function SubmitPage() {
  const supabase = await createSessionClient();
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, url, note, status, message, created_at, articles(title, stage)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-10">
        <h1 className="text-2xl font-bold">Zgłoś link</h1>
        <p className="mb-5 mt-1 text-[#5b6478]">
          Materiał spoza naszych źródeł — projekt rozporządzenia z RCL, komunikat MF, stanowisko RIO, interpretacja
          podatkowa. AI go streści i doda do PrzepisFK. Strony i pliki PDF, maks. 5 zgłoszeń na dobę.
        </p>

        <SubmitForm />

        <h2 className="mt-8 text-lg font-bold">Moje zgłoszenia</h2>
        {!submissions?.length ? (
          <p className="mt-2 text-sm text-[#5b6478]">Nie masz jeszcze zgłoszeń.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {submissions.map((s) => {
              const st = STATUS[s.status as keyof typeof STATUS];
              const article = s.articles as unknown as { title: string; stage: string } | null;
              const articleHref = article
                ? `/?${new URLSearchParams({ q: article.title.slice(0, 60), ...(article.stage === "draft" ? { widok: "projekty" } : {}) })}`
                : null;
              return (
                <li key={s.id} className="rounded-lg bg-white p-4 text-sm ring-1 ring-[#dde1ea]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    <span className="text-xs text-[#5b6478]">{dateFmt.format(new Date(s.created_at))}</span>
                  </div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-[#c2410c] underline">
                    {s.url}
                  </a>
                  {s.note && <p className="mt-1 text-[#5b6478]">Notatka: {s.note}</p>}
                  {s.message && <p className="mt-1">{s.message}</p>}
                  {articleHref && (
                    <Link href={articleHref} className="mt-1 inline-block font-semibold underline">
                      {article!.title} →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
