import { saveReview } from "@/app/moj-feed/actions";
import type { Article, Review } from "@/lib/supabase";

const STATUS = {
  affects: { label: "Wpływa na system", cls: "bg-red-700 text-white" },
  no_effect: { label: "Nie wpływa", cls: "bg-emerald-700 text-white" },
} as const;

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });

// Weryfikacja wpływu — osobno dla każdego obszaru wpisu; najpierw obszary użytkownika
export function ReviewPanel({ article, reviews, myCategoryIds }: { article: Article; reviews: Review[]; myCategoryIds: number[] }) {
  const areas = [...article.categories].sort(
    (a, b) => Number(myCategoryIds.includes(b.id)) - Number(myCategoryIds.includes(a.id)),
  );
  const open = areas.some((c) => myCategoryIds.includes(c.id) && !reviews.some((r) => r.category_id === c.id));

  return (
    <details open={open} className="mt-3 rounded-md bg-[#f6f7fa] px-3 py-2 text-sm ring-1 ring-[#dde1ea]">
      <summary className="cursor-pointer font-semibold marker:text-[#c2410c]">
        Weryfikacja wpływu
        {areas.map((c) => {
          const r = reviews.find((x) => x.category_id === c.id);
          return (
            <span key={c.id} className={`ml-2 rounded px-1.5 py-0.5 text-xs ${r ? STATUS[r.status].cls : "bg-amber-100 text-amber-900"}`}>
              {c.name}: {r ? STATUS[r.status].label : "do oceny"}
            </span>
          );
        })}
      </summary>

      <div className="mt-2 space-y-3">
        {areas.map((c) => {
          const r = reviews.find((x) => x.category_id === c.id);
          return (
            <form key={c.id} action={saveReview.bind(null, article.id)} className="border-t border-[#dde1ea] pt-2 first:border-0 first:pt-0">
              <input type="hidden" name="obszar" value={c.id} />
              <div className="font-semibold">{c.name}</div>
              {r && (
                <p className="text-xs text-[#5b6478]">
                  {STATUS[r.status].label} · {r.reviewer ?? "?"} · {dateFmt.format(new Date(r.updated_at))}
                </p>
              )}
              <textarea
                name="komentarz"
                defaultValue={r?.comment ?? ""}
                maxLength={1000}
                rows={2}
                placeholder="Komentarz: co trzeba zmienić, numer zadania, kto się zajmie…"
                aria-label={`Komentarz dla obszaru ${c.name}`}
                className="mt-1 w-full rounded-md border border-[#dde1ea] bg-white px-2 py-1"
              />
              <div className="mt-1 flex flex-wrap gap-2">
                <button name="status" value="affects" className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800">
                  Wpływa
                </button>
                <button name="status" value="no_effect" className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800">
                  Nie wpływa
                </button>
                {r && (
                  <button name="status" value="" className="rounded-md px-3 py-1 text-xs font-semibold ring-1 ring-[#dde1ea] hover:ring-[#c2410c]">
                    Cofnij ocenę
                  </button>
                )}
              </div>
            </form>
          );
        })}
      </div>
    </details>
  );
}
