import { toggleBookmark } from "@/app/ustawienia/actions";
import type { Article } from "@/lib/supabase";
import { trackedTopicsIn } from "@/lib/topics";

const STAGE_LABEL = { news: null, act: "Akt prawny", draft: "Projekt — jeszcze nie obowiązuje" } as const;

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" });
const formatDate = (d: string) => dateFmt.format(new Date(d));

// bookmarked: undefined = niezalogowany (bez przycisku zakładki)
export function ArticleCard({ article, bookmarked }: { article: Article; bookmarked?: boolean }) {
  const qa = [...article.article_qa].sort((a, b) => a.sort - b.sort);
  const tracked = trackedTopicsIn(`${article.title} ${article.summary ?? ""}`);
  const stage = STAGE_LABEL[article.stage];

  return (
    <article
      className={`rounded-lg bg-white p-5 shadow-sm sm:p-6 ${tracked.length ? "ring-2 ring-[#c2410c]" : "ring-1 ring-[#dde1ea]"}`}
    >
      {(tracked.length > 0 || stage) && (
        <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
          {tracked.map((t) => (
            <span key={t} className="rounded bg-[#c2410c] px-2 py-0.5 text-white">★ {t}</span>
          ))}
          {stage && (
            <span className={`rounded px-2 py-0.5 ${article.stage === "draft" ? "bg-amber-100 text-amber-900" : "bg-[#14213d] text-white"}`}>
              {stage}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5b6478]">
        {article.published_at && <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>}
        {article.sources && <span>· {article.sources.name}</span>}
        {article.categories.map((c) => (
          <span key={c.slug} className="rounded-full bg-[#fdeee4] px-2.5 py-0.5 font-semibold text-[#c2410c]">
            {c.name}
          </span>
        ))}
      </div>

      <h2 className="mt-2 text-lg font-bold leading-snug">
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#c2410c] hover:underline">
          {article.title}
        </a>
      </h2>

      {article.summary && <p className="mt-2 text-[15px] leading-relaxed">{article.summary}</p>}

      {article.impact && (
        <div className="mt-3 border-l-4 border-[#c2410c] bg-[#fdeee4]/60 px-3 py-2 text-sm">
          <b>Co to zmienia: </b>
          {article.impact}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {article.effective_date && (
          <span>
            <b>{article.stage === "draft" ? "Planowane wejście w życie:" : "Wchodzi w życie:"}</b>{" "}
            {formatDate(article.effective_date)}
          </span>
        )}
        {article.form_link && (
          <a href={article.form_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#c2410c] hover:underline">
            Sprawdź druk w Druki Gofin →
          </a>
        )}
      </div>

      {qa.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold marker:text-[#c2410c]">Pytania i odpowiedzi</summary>
          <dl className="mt-2 space-y-2 pl-4">
            {qa.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold">{item.question}</dt>
                <dd className="text-[#5b6478]">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#5b6478]">
          Streszczenie przygotowane przez AI —{" "}
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="underline">
            przeczytaj źródło
          </a>
          .
        </p>
        {bookmarked !== undefined && (
          <form action={toggleBookmark.bind(null, article.id, bookmarked)}>
            <button
              aria-pressed={bookmarked}
              className={`rounded-md px-3 py-1 text-xs font-semibold ring-1 ${
                bookmarked ? "bg-[#14213d] text-white ring-[#14213d]" : "ring-[#dde1ea] hover:ring-[#c2410c]"
              }`}
            >
              {bookmarked ? "★ Zapisane" : "☆ Zapisz na później"}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
