// PrzepisFK — pobieranie wpisów: RSS / Dziennik Ustaw → claude -p → Supabase
// Uruchomienie: npm run fetch            (domyślnie maks. 20 wpisów)
//               npm run fetch -- --limit 5 --days 14
//               npm run fetch -- --przeocen   (ponowna ocena opublikowanych wpisów, np. po zmianie promptu)
//               npm run fetch -- --powiadomienia   (tylko Discord i e-mail)
//               npm run fetch -- --od 2026-01-01   (uzupełnienie Dziennika Ustaw i projektów ustaw od tej daty)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import Parser from "rss-parser";
import { extractText, getDocumentProxy } from "unpdf";
import { trackedTopicsIn, TRACKED_TOPICS } from "../src/lib/topics";
import { notify } from "./notify";

// ---------- ustawienia ----------

const args = process.argv.slice(2);
const argValue = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};

const LIMIT = argValue("limit", 20); // ile wpisów streszcza Claude w jednym przebiegu
const DAYS = argValue("days", 14); // jak stare artykuły RSS w ogóle rozważamy
const LAW_DAYS = 90; // Dziennik Ustaw i projekty ustaw — dłuższe okno, żeby akty nie umykały
const odIndex = args.indexOf("--od");
const FROM = odIndex >= 0 ? new Date(args[odIndex + 1]) : null; // uzupełnienie wsteczne
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "haiku"; // haiku oszczędza limit Pro
const REASSESS = args.includes("--przeocen");
const NOTIFY_ONLY = args.includes("--powiadomienia"); // tylko Discord i e-mail, bez pobierania

// Wstępny filtr (bez AI): wpis musi zawierać choć jedno z tych słów.
// Profil: JST i jednostki budżetowe (urzędy, szkoły, przedszkola, zarządy dróg, MOPS…)
const KEYWORDS = [
  "rachunkow", "księg", "ksieg", "bilans", "sprawozda", "budżet", "budzet",
  "finans", "vat", "ksef", "faktur", "jpk", "podat", "pit", "ordynac",
  "opłat", "oplat", "samorząd", "samorzad", "jst", "gmin", "powiat", "województw", "wojewodztw",
  "urzęd", "urzed", "jednost", "sektor", "zus", "składk", "skladk", "wynagrodz", "płac", "plac",
  "środk", "srodk", "amortyz", "dotac", "subwencj", "wydatk", "dochod", "klasyfikac", "wpf",
  "rio", "skarbni", "oświat", "oswiat", "szkoł", "szkol", "przedszk", "nauczyc",
  "zamówie", "zamowie", "przetarg", "unijn", "fundusz", "pomoc społ", "kontrol",
];

// Ostrzejszy filtr dla tytułów aktów prawnych i projektów ustaw (język urzędowy)
const LAW_KEYWORDS = [
  "klasyfikac", "sprawozdawczoś", "rachunkowoś", "budżet", "finansów publicznych",
  "samorządu terytorialnego", "jednostek samorządu", "oświat", "subwencj", "wynagradzani",
  "podatk", "opłat lokaln", "opłaty miejscow", "zamówień publicznych", "dotac",
  "towarów i usług", "ubezpieczeń społecznych", "płatnik", "ordynacj", "struktur logiczn",
  "jednolitego pliku", "faktur", "planów kont", "regionalnych izb", "kontroli zarządczej",
  "wieloletniej prognoz", "dochodów jednostek",
];
const lawMatches = (title: string) => {
  const t = title.toLowerCase();
  return LAW_KEYWORDS.some((k) => t.includes(k)) || trackedTopicsIn(t).length > 0;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local");
  process.exit(1);
}
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

// ---------- typy ----------

type Source = { id: number; name: string; url: string; kind: "rss" | "eli" | "sejm" | "manual" | "page" };
type Stage = "news" | "act" | "draft";
type Category = { id: number; slug: string; name: string };
type Candidate = {
  source: Source;
  url: string;
  title: string;
  publishedAt: Date | null;
  text: string;
  stage: Stage;
};
type AiResult = {
  title?: string;
  relevant: boolean;
  categories: string[];
  summary: string;
  impact: string;
  effective_date: string | null;
  form: string | null;
  qa: { question: string; answer: string }[];
};

// ---------- pobieranie ----------

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const since = (kind: Source["kind"]) =>
  kind === "rss" ? daysAgo(DAYS) : kind === "page" ? new Date(0) : (FROM ?? daysAgo(LAW_DAYS));
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
      stage: "news" as const,
    }));
}

async function fromEli(source: Source): Promise<Candidate[]> {
  const year = new Date().getFullYear();
  const res = await fetch(`${source.url}/${year}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    items: { pos: number; title: string; type: string; promulgation?: string; displayAddress: string }[];
  };
  return data.items
    .filter((i) => i.type !== "Obwieszczenie" && lawMatches(i.title)) // bez tekstów jednolitych
    .map((i) => ({
      source,
      url: `https://dziennikustaw.gov.pl/DU/${year}/${i.pos}`,
      title: i.title,
      publishedAt: i.promulgation ? new Date(i.promulgation) : null,
      text: `${i.displayAddress} · ${i.type}. ${i.title}`,
      stage: "act" as const,
    }));
}

// Projekty ustaw z API Sejmu — tylko pierwotne druki, bez sprawozdań komisji i autopoprawek
async function fromSejm(source: Source): Promise<Candidate[]> {
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const prints = (await res.json()) as { number: string; title: string; deliveryDate: string; processPrint: string[] }[];
  const term = source.url.match(/term(\d+)/)?.[1] ?? "10";
  return prints
    .filter((p) => /projekt ustawy/i.test(p.title) && /^(rządowy|poselski|senacki|obywatelski|komisyjny|prezydencki)/i.test(p.title))
    .filter((p) => p.processPrint?.[0] === p.number && lawMatches(p.title))
    .map((p) => ({
      source,
      url: `https://www.sejm.gov.pl/Sejm${term}.nsf/druk.xsp?nr=${p.number}`,
      title: p.title.replace(/\.$/, ""),
      publishedAt: new Date(p.deliveryDate),
      text: `Druk sejmowy nr ${p.number}. ${p.title}`,
      stage: "draft" as const,
    }));
}

// Obserwowana strona bez RSS: każdy plik PDF na stronie to osobny wpis (schematy XSD pomijamy)
async function fromPage(source: Source): Promise<Candidate[]> {
  const res = await fetch(source.url, { headers: { "User-Agent": "PrzepisFK/1.0" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const base = new URL(source.url);
  const found = new Map<string, Candidate>();

  for (const [, href, inner] of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripHtml(inner).replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const isPdf = /\.pdf\b/i.test(text) || /\.pdf$/i.test(href);
    if (!isPdf || !(href.includes("/attachment/") || /\.pdf$/i.test(href))) continue;
    // tekst linku na gov.pl: „Opis Nazwa_pliku.pdf 0.11MB” → zostaje sam opis
    const title = text.split(/\s\S+\.pdf\b/i)[0].trim();
    const url = new URL(href, base).toString();
    if (title.length >= 8 && !found.has(url)) {
      found.set(url, { source, url, title, publishedAt: new Date(), text: "", stage: "news" });
    }
  }
  return [...found.values()];
}

// Pierwsze odczytanie strony: historię oznaczamy jako znaną, zostawiamy tylko bieżące lata i tematy śledzone
async function baselinePage(source: Source, items: Candidate[]) {
  const { count } = await db.from("articles").select("id", { count: "exact", head: true }).eq("source_id", source.id);
  if (count) return items;
  const current = (c: Candidate) => /\b202[6-9]\b/.test(c.title) || trackedTopicsIn(c.title).length > 0;
  const old = items.filter((c) => !current(c));
  for (const c of old) await insertArticle(c, { status: "skipped" });
  console.log(`  ${source.name}: pierwsze odczytanie — ${old.length} starszych plików oznaczonych jako znane`);
  return items.filter(current);
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[​­﻿]/g, "") // niewidoczne znaki (gov.pl: „JPK&#8203;_MAG”)
    .replace(/\s+/g, " ")
    .trim();
}

// Gdy kanał nie podaje treści (np. Infor), bierzemy z artykułu tylko jego opis (meta description)
async function enrichText(c: Candidate) {
  if (c.source.kind === "page") {
    c.text = (await readUrl(c.url)).text;
    return;
  }
  if (c.text.length >= 200 || c.source.kind !== "rss") return;
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
  return c.stage !== "news" || c.source.kind === "page" || KEYWORDS.some((k) => t.includes(k)) || trackedTopicsIn(t).length > 0;
};

// ---------- Claude ----------

function buildPrompt(c: Candidate, categories: Category[]) {
  return `Jesteś asystentem głównej księgowej / skarbnika w jednostce samorządu terytorialnego (JST) lub jednostce budżetowej w Polsce — np. urząd miasta lub gminy, starostwo, szkoła, przedszkole, zarząd dróg, MOPS. Przeanalizuj wpis i odpowiedz WYŁĄCZNIE poprawnym JSON-em (bez komentarzy, bez bloku markdown).

Tematy priorytetowe (zawsze relevant = true, jeśli wpis ich dotyczy): ${TRACKED_TOPICS.map((t) => t.label).join(", ")}.

Wpis (${{ news: "artykuł prasowy", act: "akt prawny z Dziennika Ustaw", draft: "projekt ustawy w Sejmie — jeszcze nie obowiązuje" }[c.stage]}):
Źródło: ${c.source.name}
Tytuł: ${c.title}
Data: ${c.publishedAt?.toISOString().slice(0, 10) ?? "brak"}
Treść: ${c.text || "(brak — oceniaj po tytule)"}

Dostępne kategorie (slug: nazwa):
${categories.map((k) => `- ${k.slug}: ${k.name}`).join("\n")}

Zwróć JSON:
{
  "title": "krótki, rzeczowy tytuł po polsku (do 120 znaków)",
  "relevant": true/false — true TYLKO gdy wpis ma praktyczne znaczenie dla JST lub jednostki budżetowej: rachunkowość budżetowa, sprawozdawczość (Rb, bilans), budżet i WPF, klasyfikacja budżetowa, finanse publiczne, VAT i KSeF w JST (centralizacja VAT), podatki i opłaty lokalne (JST jako organ podatkowy), płace i ZUS w sferze budżetowej (JST jako pracodawca), PIT po stronie płatnika (zaliczki od wynagrodzeń, skala i progi, koszty uzyskania, ulgi wpływające na zaliczki, PIT-11, PIT-4R, PIT-8AR, PIT-8C, terminy), oświata (subwencja, wynagrodzenia nauczycieli), zamówienia publiczne, dotacje i środki UE, kontrola RIO/NIK. false dla tematów dotyczących wyłącznie firm (CIT, estoński CIT, ulgi dla przedsiębiorców, JDG, kasy fiskalne), spraw wyłącznie osobistych (PCC, ulgi rozliczane tylko w zeznaniu rocznym podatnika, emerytury), polityki i porad życiowych,
  "categories": ["slug", ...] — 1–2 najlepiej pasujące,
  "summary": "2–3 zdania po polsku: co się zmienia",
  "impact": "1–2 zdania: co to zmienia w praktyce dla księgowości / kadr JST lub jednostki budżetowej",
  "effective_date": "RRRR-MM-DD" albo null — data wejścia w życie, tylko jeśli wynika z treści (dla projektu ustawy: planowana data, jeśli podana),
  "form": "symbol druku" albo null — tylko gdy wpis dotyczy konkretnego formularza / deklaracji / sprawozdania (np. "VAT-R", "PIT-11", "PIT-4R", "PIT-8AR", "Rb-27S", "JPK_V7M", "ZUS DRA"),
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
      stage: c.stage,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

// Zapisuje wynik AI: nowy wpis (insert) albo ponownie oceniony (update + nowe kategorie i Q&A)
async function saveResult(c: Candidate, ai: AiResult, slugToId: Map<string, number>, existingId?: number) {
  if (!ai.relevant) {
    if (existingId) await db.from("articles").update({ status: "skipped" }).eq("id", existingId);
    else await insertArticle(c, { status: "skipped" });
    return null;
  }

  const fields = {
    status: "done",
    summary: ai.summary,
    impact: ai.impact,
    form_link: ai.form ? `https://druki.gofin.pl/search/?search_form[phrase]=${encodeURIComponent(ai.form)}` : null,
    effective_date: /^\d{4}-\d{2}-\d{2}$/.test(ai.effective_date ?? "") ? ai.effective_date : null,
  };
  let id = existingId;
  if (id) {
    const { error } = await db.from("articles").update(fields).eq("id", id);
    if (error) throw error;
    await db.from("article_categories").delete().eq("article_id", id);
    await db.from("article_qa").delete().eq("article_id", id);
  } else {
    id = await insertArticle(c, fields);
  }

  const catIds = ai.categories.map((s) => slugToId.get(s)).filter((x): x is number => !!x);
  if (catIds.length === 0) catIds.push(slugToId.get("inne")!);
  await db.from("article_categories").insert(catIds.map((category_id) => ({ article_id: id, category_id })));
  await db.from("article_qa").insert(
    ai.qa.slice(0, 3).map((q, sort) => ({ article_id: id, question: q.question, answer: q.answer, sort })),
  );
  return id!;
}

// ---------- zgłoszone linki (strona /zglos) ----------

const SUBMISSIONS_PER_RUN = 10;

// Pobiera treść spod linku: strona HTML (tytuł, opis, tekst) albo PDF
async function readUrl(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "PrzepisFK/1.0" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`strona zwróciła błąd HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";

  if (type.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    // bez kropek ze spisu treści, żeby w limicie znaków zmieściła się właściwa treść
    return { title: "", text: text.replace(/(\s?\.){4,}\s*\d*/g, " ").replace(/\s+/g, " ").slice(0, 8000) };
  }

  const html = await res.text();
  const meta = (name: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`, "i"))?.[1] ?? "";
  const title = meta("og:title") || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");
  const body = stripHtml(html.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, " "));
  return { title: stripHtml(title), text: `${meta("og:description") || meta("description")} ${body}`.slice(0, 8000) };
}

const stageFor = (url: string): Stage =>
  /legislacja\.gov\.pl|legislacja\.rcl\.gov\.pl/.test(url) ? "draft" : /dziennikustaw\.gov\.pl|isap\.sejm\.gov\.pl/.test(url) ? "act" : "news";

async function processSubmissions(manual: Source | undefined, categories: Category[], slugToId: Map<string, number>) {
  const { data: pending, error } = await db
    .from("submissions")
    .select("id, url, note")
    .eq("status", "pending")
    .order("created_at")
    .limit(SUBMISSIONS_PER_RUN);
  if (error) return console.error(`  ✗ zgłoszenia: ${error.message}`);
  if (!pending.length) return;
  console.log(`Zgłoszone linki: ${pending.length}`);

  const finish = (id: number, status: string, message: string, article_id: number | null = null) =>
    db.from("submissions").update({ status, message, article_id, processed_at: new Date().toISOString() }).eq("id", id);

  for (const sub of pending) {
    try {
      const { data: existing } = await db.from("articles").select("id, status").eq("url", sub.url).maybeSingle();
      if (existing) {
        await (existing.status === "done"
          ? finish(sub.id, "done", "Ten materiał był już w PrzepisFK.", existing.id)
          : finish(sub.id, "rejected", "Ten materiał był już oceniony jako poza zakresem JST."));
        continue;
      }

      const page = await readUrl(sub.url);
      if (page.text.trim().length < 50) {
        await finish(sub.id, "error", "Nie udało się odczytać treści (strona może wymagać logowania lub być obrazem).");
        continue;
      }
      const c: Candidate = {
        source: manual ?? { id: 0, name: "Zgłoszony link", url: "", kind: "manual" },
        url: sub.url,
        title: page.title,
        publishedAt: new Date(),
        text: `${sub.note ? `Uwaga zgłaszającego: ${sub.note}\n` : ""}${page.text}`,
        stage: stageFor(sub.url),
      };
      const ai = askClaude(buildPrompt(c, categories));
      if (!c.title || c.title.length < 10) c.title = ai.title?.trim() || sub.url;
      if (manual) c.source = manual;
      const id = await saveResult(c, ai, slugToId);
      await (id
        ? finish(sub.id, "done", "Streszczenie opublikowane.", id)
        : finish(sub.id, "rejected", "AI oceniło, że materiał nie dotyczy JST ani jednostek budżetowych."));
      console.log(`  ${id ? "✓" : "–"} zgłoszenie: ${c.title}`);
    } catch (err) {
      await finish(sub.id, "error", `Nie udało się przetworzyć: ${(err as Error).message.split("\n")[0]}`);
      console.error(`  ✗ zgłoszenie ${sub.url}: ${(err as Error).message.split("\n")[0]}`);
    }
  }
}

// Ponowna ocena opublikowanych wpisów nowymi zasadami (np. po zmianie profilu na JST)
async function reassess(sources: Source[], categories: Category[], slugToId: Map<string, number>) {
  const { data, error } = await db
    .from("articles")
    .select("id, url, title, published_at, source_id, stage")
    .eq("status", "done")
    .order("published_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  console.log(`Ponowna ocena: ${data.length} opublikowanych wpisów`);

  let kept = 0, hidden = 0, failed = 0;
  for (const a of data) {
    const source = sources.find((s) => s.id === a.source_id) ?? { id: 0, name: "?", url: "", kind: "rss" as const };
    const c: Candidate = {
      source,
      url: a.url,
      title: a.title,
      publishedAt: a.published_at ? new Date(a.published_at) : null,
      text: source.kind === "rss" ? "" : a.title,
      stage: a.stage as Stage,
    };
    try {
      await enrichText(c);
      const ok = !!(await saveResult(c, askClaude(buildPrompt(c, categories)), slugToId, a.id));
      if (ok) kept++; else hidden++;
      console.log(`  ${ok ? "✓ zostaje" : "– ukryty"}: ${a.title}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${a.title}: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`Gotowe: zostaje ${kept}, ukryte ${hidden}, błędy ${failed}.`);
}

// ---------- przebieg ----------

// Blokada: dwa przebiegi naraz zapisywałyby te same wpisy (np. ręczny + Harmonogram zadań)
const LOCK = NOTIFY_ONLY ? "logs/notify.lock" : "logs/fetch.lock";

function acquireLock() {
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, "utf8"));
    try {
      process.kill(pid, 0); // proces nadal działa?
      console.error(`Skrypt już działa (PID ${pid}) — kończę. Jeśli to pomyłka, usuń plik ${LOCK}.`);
      process.exit(0);
    } catch {
      // stara blokada po przerwanym przebiegu
    }
  }
  mkdirSync("logs", { recursive: true });
  writeFileSync(LOCK, String(process.pid));
  process.on("exit", () => rmSync(LOCK, { force: true }));
}

async function main() {
  acquireLock();
  if (NOTIFY_ONLY) return notify(db);
  console.log(`PrzepisFK: limit ${LIMIT}, ostatnie ${DAYS} dni, model ${CLAUDE_MODEL}`);

  const [{ data: sources, error: e1 }, { data: categories, error: e2 }] = await Promise.all([
    db.from("sources").select("id, name, url, kind, active"),
    db.from("categories").select("id, slug, name").order("sort"),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const slugToId = new Map(categories!.map((k) => [k.slug, k.id]));

  if (REASSESS) return reassess(sources as Source[], categories!, slugToId);

  // 0. Najpierw linki zgłoszone przez użytkowników na stronie
  await processSubmissions((sources as Source[]).find((s) => s.kind === "manual"), categories!, slugToId);

  // 1. Pobierz wpisy ze wszystkich źródeł
  let candidates: Candidate[] = [];
  for (const s of (sources as (Source & { active: boolean })[]).filter((x) => x.active)) {
    try {
      const items =
        s.kind === "eli" ? await fromEli(s)
        : s.kind === "sejm" ? await fromSejm(s)
        : s.kind === "page" ? await baselinePage(s, await fromPage(s))
        : await fromRss(s);
      const from = since(s.kind);
      const fresh = items.filter((c) => !c.publishedAt || c.publishedAt >= from);
      console.log(`  ${s.name}: ${items.length} pasujących, ${fresh.length} od ${from.toISOString().slice(0, 10)}`);
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
  // kolejność: tematy śledzone, potem akty i projekty, potem najnowsze
  const rank = (c: Candidate) => (trackedTopicsIn(`${c.title} ${c.text}`).length ? 0 : c.stage === "news" ? 2 : 1);
  const queue = candidates
    .filter(matchesKeywords)
    .sort((a, b) => rank(a) - rank(b) || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  console.log(`Nowe: ${candidates.length}, poza tematem: ${offTopic.length}, do streszczenia: ${queue.length} (w tym przebiegu maks. ${LIMIT})`);

  // 4. Claude streszcza najnowsze; reszta poczeka do następnego przebiegu
  let done = 0, skipped = 0, failed = 0;
  for (const c of queue.slice(0, LIMIT)) {
    try {
      await enrichText(c);
      const saved = !!(await saveResult(c, askClaude(buildPrompt(c, categories!)), slugToId));
      if (saved) done++;
      else skipped++;
      console.log(`  ${saved ? "✓" : "– pominięty przez AI:"} ${c.title}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${c.title}: ${(err as Error).message.split("\n")[0]}`);
    }
  }

  console.log(`Gotowe: zapisane ${done}, pominięte przez AI ${skipped}, błędy ${failed}, czeka ${Math.max(queue.length - LIMIT, 0)}.`);

  // 5. Powiadomienia o nowych wpisach
  await notify(db);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
