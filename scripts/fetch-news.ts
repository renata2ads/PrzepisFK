// PrzepisFK — pobieranie wpisów: RSS / Dziennik Ustaw → claude -p → Supabase
// Uruchomienie: npm run fetch            (domyślnie maks. 20 wpisów)
//               npm run fetch -- --limit 5 --days 14

import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import Parser from "rss-parser";

// ---------- ustawienia ----------

const args = process.argv.slice(2);
const argValue = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};

const LIMIT = argValue("limit", 20); // ile wpisów streszcza Claude w jednym przebiegu
const DAYS = argValue("days", 14); // jak stare wpisy w ogóle rozważamy
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "haiku"; // haiku oszczędza limit Pro

// Wstępny filtr (bez AI): wpis musi zawierać choć jedno z tych słów
const KEYWORDS = [
  "rachunkow", "księg", "ksieg", "bilans", "sprawozda", "budżet", "budzet",
  "finans", "vat", "ksef", "faktur", "jpk", "podat", "cit", "pit", "akcyz",
  "ordynac", "opłat", "oplat", "samorząd", "samorzad", "jst", "gmin", "powiat",
  "zus", "składk", "skladk", "wynagrodz", "płac", "plac", "środk", "srodk",
  "amortyz", "dotac", "wydatk", "dochod", "klasyfikac", "rio", "skarbni",
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local");
  process.exit(1);
}
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

// ---------- typy ----------

type Source = { id: number; name: string; url: string; kind: "rss" | "eli" };
type Category = { id: number; slug: string; name: string };
type Candidate = {
  source: Source;
  url: string;
  title: string;
  publishedAt: Date | null;
  text: string;
};
type AiResult = {
  relevant: boolean;
  categories: string[];
  summary: string;
  impact: string;
  effective_date: string | null;
  form: string | null;
  qa: { question: string; answer: string }[];
};

// ---------- pobieranie ----------

const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
const rss = new Parser({ timeout: 20000, headers: { "User-Agent": "PrzepisFK/1.0" } });

async function fromRss(source: Source): Promise<Candidate[]> {
  const feed = await rss.parseURL(source.url);
  return feed.items
    .filter((i) => i.link && i.title)
    .map((i) => ({
      source,
      url: i.link!.trim(),
      title: i.title!.trim(),
      publishedAt: i.isoDate ? new Date(i.isoDate) : null,
      text: stripHtml(i.summary ?? i.content ?? i.contentSnippet ?? "").slice(0, 3000),
    }));
}

async function fromEli(source: Source): Promise<Candidate[]> {
  const year = new Date().getFullYear();
  const res = await fetch(`${source.url}/${year}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    items: { pos: number; title: string; type: string; promulgation?: string; displayAddress: string }[];
  };
  return data.items.map((i) => ({
    source,
    url: `https://dziennikustaw.gov.pl/DU/${year}/${i.pos}`,
    title: i.title,
    publishedAt: i.promulgation ? new Date(i.promulgation) : null,
    text: `${i.displayAddress} · ${i.type}. ${i.title}`,
  }));
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Gdy kanał nie podaje treści (np. Infor), bierzemy z artykułu tylko jego opis (meta description)
async function enrichText(c: Candidate) {
  if (c.text.length >= 200 || c.source.kind === "eli") return;
  try {
    const res = await fetch(c.url, { headers: { "User-Agent": "PrzepisFK/1.0" }, signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i) ??
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
    if (m) c.text = `${c.text} ${m[1]}`.trim();
  } catch {
    // brak opisu — Claude oceni po tytule
  }
}

const matchesKeywords = (c: Candidate) => {
  const t = `${c.title} ${c.text}`.toLowerCase();
  return KEYWORDS.some((k) => t.includes(k));
};

// ---------- Claude ----------

function buildPrompt(c: Candidate, categories: Category[]) {
  return `Jesteś asystentem księgowych w Polsce (jednostki budżetowe, samorządy i firmy). Przeanalizuj wpis i odpowiedz WYŁĄCZNIE poprawnym JSON-em (bez komentarzy, bez bloku markdown).

Wpis:
Źródło: ${c.source.name}
Tytuł: ${c.title}
Data: ${c.publishedAt?.toISOString().slice(0, 10) ?? "brak"}
Treść: ${c.text || "(brak — oceniaj po tytule)"}

Dostępne kategorie (slug: nazwa):
${categories.map((k) => `- ${k.slug}: ${k.name}`).join("\n")}

Zwróć JSON:
{
  "relevant": true/false — czy wpis dotyczy przepisów lub praktyki finansowo-księgowej, podatków, sprawozdawczości, finansów publicznych, płac/ZUS (w tym kasy fiskalne, KSeF, obowiązki przedsiębiorców; false dla polityki, debat o świadczeniach społecznych, porad życiowych),
  "categories": ["slug", ...] — 1–2 najlepiej pasujące,
  "summary": "2–3 zdania po polsku: co się zmienia",
  "impact": "1–2 zdania: co to zmienia w praktyce dla księgowości / kadr",
  "effective_date": "RRRR-MM-DD" albo null — data wejścia w życie, tylko jeśli wynika z treści,
  "form": "symbol druku" albo null — tylko gdy wpis dotyczy konkretnego formularza / deklaracji / sprawozdania (np. "VAT-R", "PIT-11", "Rb-27S", "JPK_V7M", "ZUS DRA"),
  "qa": [{"question": "Kogo dotyczy?", "answer": "..."}, {"question": "Od kiedy?", "answer": "..."}, {"question": "Co muszę zrobić?", "answer": "..."}]
}
Nie zmyślaj faktów spoza treści — gdy czegoś nie wiadomo, napisz to wprost.`;
}

function askClaude(prompt: string): AiResult {
  const out = execFileSync("claude", ["-p", "--model", CLAUDE_MODEL], {
    input: prompt,
    encoding: "utf8",
    timeout: 180_000,
    cwd: tmpdir(), // bez kontekstu projektu — mniejsze zużycie limitu
    windowsHide: true,
  });
  const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  return JSON.parse(json) as AiResult;
}

// ---------- zapis ----------

async function existingUrls(urls: string[]) {
  const found = new Set<string>();
  for (let i = 0; i < urls.length; i += 20) {
    const { data, error } = await db.from("articles").select("url").in("url", urls.slice(i, i + 20));
    if (error) throw error;
    data.forEach((r) => found.add(r.url));
  }
  return found;
}

async function insertArticle(c: Candidate, fields: Record<string, unknown>) {
  const { data, error } = await db
    .from("articles")
    .insert({
      source_id: c.source.id,
      url: c.url,
      title: c.title,
      published_at: c.publishedAt?.toISOString() ?? null,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

// ---------- przebieg ----------

async function main() {
  console.log(`PrzepisFK: limit ${LIMIT}, ostatnie ${DAYS} dni, model ${CLAUDE_MODEL}`);

  const [{ data: sources, error: e1 }, { data: categories, error: e2 }] = await Promise.all([
    db.from("sources").select("id, name, url, kind").eq("active", true),
    db.from("categories").select("id, slug, name").order("sort"),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const slugToId = new Map(categories!.map((k) => [k.slug, k.id]));

  // 1. Pobierz wpisy ze wszystkich źródeł
  let candidates: Candidate[] = [];
  for (const s of sources as Source[]) {
    try {
      const items = s.kind === "eli" ? await fromEli(s) : await fromRss(s);
      const fresh = items.filter((c) => !c.publishedAt || c.publishedAt >= since);
      console.log(`  ${s.name}: ${items.length} wpisów, ${fresh.length} z ostatnich ${DAYS} dni`);
      candidates.push(...fresh);
    } catch (err) {
      console.error(`  ✗ ${s.name}: ${(err as Error).message}`);
    }
  }

  // 2. Bez duplikatów (w bazie i w tym przebiegu)
  const known = await existingUrls(candidates.map((c) => c.url));
  const seen = new Set<string>();
  candidates = candidates.filter((c) => !known.has(c.url) && !seen.has(c.url) && seen.add(c.url));

  // 3. Filtr słów kluczowych — odrzucone zapisujemy jako 'skipped', żeby nie wracały
  const offTopic = candidates.filter((c) => !matchesKeywords(c));
  for (const c of offTopic) await insertArticle(c, { status: "skipped" });
  const queue = candidates
    .filter(matchesKeywords)
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  console.log(`Nowe: ${candidates.length}, poza tematem: ${offTopic.length}, do streszczenia: ${queue.length} (w tym przebiegu maks. ${LIMIT})`);

  // 4. Claude streszcza najnowsze; reszta poczeka do następnego przebiegu
  let done = 0, skipped = 0, failed = 0;
  for (const c of queue.slice(0, LIMIT)) {
    try {
      await enrichText(c);
      const ai = askClaude(buildPrompt(c, categories!));
      if (!ai.relevant) {
        await insertArticle(c, { status: "skipped" });
        skipped++;
        console.log(`  – pominięty przez AI: ${c.title}`);
        continue;
      }
      const id = await insertArticle(c, {
        status: "done",
        summary: ai.summary,
        impact: ai.impact,
        form_link: ai.form ? `https://druki.gofin.pl/search/?search_form[phrase]=${encodeURIComponent(ai.form)}` : null,
        effective_date: /^\d{4}-\d{2}-\d{2}$/.test(ai.effective_date ?? "") ? ai.effective_date : null,
      });
      const catIds = ai.categories.map((s) => slugToId.get(s)).filter((x): x is number => !!x);
      if (catIds.length === 0) catIds.push(slugToId.get("inne")!);
      await db.from("article_categories").insert(catIds.map((category_id) => ({ article_id: id, category_id })));
      await db.from("article_qa").insert(
        ai.qa.slice(0, 3).map((q, sort) => ({ article_id: id, question: q.question, answer: q.answer, sort })),
      );
      done++;
      console.log(`  ✓ ${c.title}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${c.title}: ${(err as Error).message.split("\n")[0]}`);
    }
  }

  console.log(`Gotowe: zapisane ${done}, pominięte przez AI ${skipped}, błędy ${failed}, czeka ${Math.max(queue.length - LIMIT, 0)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
