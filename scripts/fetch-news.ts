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
import { IMPACT_TYPES, isImpactType, isPriority } from "../src/lib/impact";

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
const etapIndex = args.indexOf("--etap");
const STAGE_FILTER = etapIndex >= 0 ? args[etapIndex + 1] : null; // np. --przeocen --etap act
const frazaIndex = args.indexOf("--fraza");
const PHRASE_FILTER = frazaIndex >= 0 ? args[frazaIndex + 1]?.replace(/[%,()*\\]/g, "") : null; // np. --przeocen --fraza JPK
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

type Source = { id: number; name: string; url: string; kind: "rss" | "eli" | "sejm" | "manual" | "page" | "list" | "forms"; category_slug?: string | null };
type Stage = "news" | "act" | "draft";
type Category = { id: number; slug: string; name: string; description: string | null };
type Candidate = {
  source: Source;
  url: string;
  title: string;
  publishedAt: Date | null;
  text: string;
  stage: Stage;
  effectiveDate?: string | null; // z API Dziennika Ustaw — pewniejsza niż ocena AI
};
type AiResult = {
  title?: string;
  relevant: boolean;
  categories: string[];
  summary: string;
  impact: string;
  effective_date: string | null;
  form: string | null;
  system_impact: string;
  impact_types: string[];
  priority: string;
  qa: { question: string; answer: string }[];
};

// ---------- pobieranie ----------

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const since = (kind: Source["kind"]) =>
  kind === "rss" || kind === "list" ? daysAgo(DAYS) : kind === "page" ? new Date(0) : (FROM ?? daysAgo(LAW_DAYS));
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

// Strona z listą artykułów bez RSS (np. gofin.pl/aktualnosci-i-sygnaly):
// artykuły to linki „<ścieżka listy>/<numer>/<tytuł>”
async function fromList(source: Source): Promise<Candidate[]> {
  const res = await fetch(source.url, { headers: { "User-Agent": "PrzepisFK/1.0" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const base = new URL(source.url);
  const article = new RegExp(`^${base.pathname.replace(/\/$/, "")}/\\d+/`);
  const found = new Map<string, Candidate>();

  for (const [, href, inner] of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = new URL(href, base);
    const title = stripHtml(inner);
    if (url.host !== base.host || !article.test(url.pathname) || title.length < 10) continue;
    url.search = url.hash = "";
    const key = url.toString();
    if (!found.has(key)) found.set(key, { source, url: key, title, publishedAt: new Date(), text: "", stage: "news" });
  }
  return [...found.values()];
}

// Dział Druków Gofin (np. sprawozdawczość budżetowa): każda nowa wersja druku to osobny wpis.
// Strona druku ma tabelę „Wersje druku” z datą „Okres od”; bierzemy wersje z ostatnich 90 dni i przyszłe.
const checkedForms = new Set<string>();
async function fromForms(source: Source): Promise<Candidate[]> {
  const get = async (url: string) => {
    const res = await fetch(url, { headers: { "User-Agent": "PrzepisFK/1.0" }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };
  const base = new URL(source.url);
  const links = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => new URL(m[1], base).toString());
  const sectionRe = /href="(\/dzial\/\d+\/[a-z0-9-]+)"/g;
  const formRe = /href="(\/dzial\/\d+\/druk\/\d+\/[^"#?]+)"/g;

  // Dział główny (z menu) przeszukujemy w głąb: strona poddziału pokazuje drzewo jego działu głównego.
  // Poddział bierzemy bez schodzenia niżej — jego strona pokazuje też działy „rodzeństwa”.
  const menu = new Set(links(await get(base.origin), sectionRe));
  const sectionId = (url: string) => url.match(/\/dzial\/(\d+)\//)?.[1];
  const found = new Set<string>();
  const visited = new Set<string>();
  let level = [source.url];
  for (let depth = 0; depth < (menu.has(source.url) ? 3 : 1) && level.length; depth++) {
    const next: string[] = [];
    for (const section of level) {
      if (visited.has(section)) continue;
      visited.add(section);
      const html = await get(section);
      links(html, formRe).forEach((f) => found.add(f));
      next.push(...links(html, sectionRe).filter((s) => !menu.has(s) && !visited.has(s)));
    }
    level = [...new Set(next)];
  }
  // tylko druki z odwiedzonych działów (bez „popularnych druków” z innych części serwisu)
  const ids = new Set([...visited].map(sectionId));
  const forms = new Set([...found].filter((f) => ids.has(sectionId(f))));
  for (const f of checkedForms) forms.delete(f); // ten sam druk bywa w kilku działach — sprawdza go pierwsza grupa
  forms.forEach((f) => checkedForms.add(f));
  console.log(`  ${source.name}: ${visited.size} działów, ${forms.size} druków`);
  const from = daysAgo(LAW_DAYS).toISOString().slice(0, 10);
  const out: Candidate[] = [];

  for (const url of forms) {
    try {
      const text = stripHtml((await get(url)).replace(/<(script|style)[\s\S]*?<\/\1>/gi, " "));
      // tabela wersji jest na końcu strony, przed stopką „Pomocniki Księgowego”
      const versions = (text.split(/Okres od Okres do/i).pop() ?? "").split("Pomocniki Księgowego")[0];
      const since = [...versions.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((m) => m[1]).sort().pop();
      if (!since || since < from) continue;
      const name = text.match(/Powrót (.+?) Zobacz dostępne wersje/)?.[1] ?? url;
      const symbol = name.split(" - ")[0];
      const info = text.match(/Uwagi od redakcji: (.+?) WERSJE DRUKU/)?.[1] ?? "";
      out.push({
        source,
        url: `${url}#wersja-${since}`,
        title: `Nowa wersja druku ${symbol} (obowiązuje od ${since})`,
        publishedAt: new Date(),
        text: `Druk: ${name}. Nowa wersja obowiązuje od ${since}. ${info}`.slice(0, 3000),
        stage: "news",
        effectiveDate: since,
      });
    } catch (err) {
      console.error(`  ✗ ${url}: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300)); // bez zasypywania serwera zapytaniami
  }
  return out;
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
// Akt z Dziennika Ustaw: data wejścia w życie z API ELI (lista aktów jej nie zawiera)
async function eliEntryIntoForce(c: Candidate) {
  const m = c.url.match(/dziennikustaw\.gov\.pl\/DU\/(\d{4})\/(\d+)/);
  if (!m) return;
  try {
    const res = await fetch(`https://api.sejm.gov.pl/eli/acts/DU/${m[1]}/${m[2]}`, { signal: AbortSignal.timeout(15000) });
    const act = (await res.json()) as { entryIntoForce?: string };
    if (act.entryIntoForce) {
      c.effectiveDate = act.entryIntoForce;
      c.text = `${c.text} Data wejścia w życie: ${act.entryIntoForce}.`;
    }
  } catch {
    // bez daty — AI oceni po treści
  }
}

async function enrichText(c: Candidate) {
  await eliEntryIntoForce(c);
  if (c.source.kind === "page" || c.source.kind === "list") {
    c.text = (await readUrl(c.url)).text;
    // gofin: „… z dnia 22.10.2026, strona 2” — data wydania artykułu
    const d = c.source.kind === "list" && c.text.match(/z dnia (\d{2})\.(\d{2})\.(\d{4})/);
    if (d) c.publishedAt = new Date(`${d[3]}-${d[2]}-${d[1]}`);
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
  return c.stage !== "news" || c.source.kind === "page" || c.source.kind === "forms" || KEYWORDS.some((k) => t.includes(k)) || trackedTopicsIn(t).length > 0;
};

// ---------- Claude ----------

function buildPrompt(c: Candidate, categories: Category[]) {
  return `Jesteś analitykiem przepisów u dostawcy oprogramowania finansowo-księgowego dla jednostek samorządu terytorialnego (JST) i jednostek budżetowych w Polsce (urzędy miast i gmin, starostwa, szkoły, przedszkola, zarządy dróg, MOPS). Twoje streszczenie trafia do księgowych JST oraz do kierowników produktu, którzy decydują, czy zmiana wymaga dostosowania systemu. Przeanalizuj wpis i odpowiedz WYŁĄCZNIE poprawnym JSON-em (bez komentarzy, bez bloku markdown).

Tematy priorytetowe (zawsze relevant = true, jeśli wpis ich dotyczy): ${TRACKED_TOPICS.map((t) => t.label).join(", ")}.

Wpis (${{ news: "artykuł prasowy", act: "akt prawny z Dziennika Ustaw", draft: "projekt ustawy w Sejmie — jeszcze nie obowiązuje" }[c.stage]}):
Źródło: ${c.source.name}
Tytuł: ${c.title}
Data: ${c.publishedAt?.toISOString().slice(0, 10) ?? "brak"}
Treść: ${c.text || "(brak — oceniaj po tytule)"}

Obszary produktowe dostawcy oprogramowania dla JST (slug: nazwa — zakres):
${categories.map((k) => `- ${k.slug}: ${k.name} — ${k.description ?? ""}`).join("\n")}

Rodzaje wpływu na oprogramowanie (slug: opis):
${Object.entries(IMPACT_TYPES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Zwróć JSON:
{
  "title": "krótki, rzeczowy tytuł po polsku (do 120 znaków)",
  "relevant": true/false — true TYLKO gdy wpis ma praktyczne znaczenie dla JST lub jednostki budżetowej: rachunkowość budżetowa, sprawozdawczość (Rb, bilans), budżet i WPF, klasyfikacja budżetowa, finanse publiczne, VAT i KSeF w JST (centralizacja VAT), podatki i opłaty lokalne (JST jako organ podatkowy), płace i ZUS w sferze budżetowej (JST jako pracodawca), PIT po stronie płatnika (zaliczki od wynagrodzeń, skala i progi, koszty uzyskania, ulgi wpływające na zaliczki, PIT-11, PIT-4R, PIT-8AR, PIT-8C, terminy), oświata (subwencja, wynagrodzenia nauczycieli), zamówienia publiczne, dotacje i środki UE, kontrola RIO/NIK. false dla tematów dotyczących wyłącznie firm (CIT, estoński CIT, ulgi dla przedsiębiorców, JDG, kasy fiskalne), spraw wyłącznie osobistych (PCC, ulgi rozliczane tylko w zeznaniu rocznym podatnika, emerytury), polityki i porad życiowych,
  "categories": ["slug", ...] — 1–2 obszary produktowe, których zespół powinien sprawdzić zmianę ("inne" tylko gdy żaden nie pasuje),
  "summary": "2–3 zdania po polsku: co się zmienia",
  "impact": "1–2 zdania: co to zmienia w praktyce dla księgowości / kadr JST lub jednostki budżetowej",
  "system_impact": "1–2 zdania z perspektywy kierownika produktu systemu dziedzinowego dla JST: co konkretnie sprawdzić lub zmienić w oprogramowaniu (np. nowa wersja struktury XML, nowe pozycje w słowniku klasyfikacji, zmiana algorytmu naliczania, nowy wzór sprawozdania); jeśli zmiana nie wymaga zmian w systemie — napisz to",
  "impact_types": ["slug", ...] — 0–3 rodzaje wpływu z listy wyżej (pusta lista, gdy brak wpływu na system),
  "priority": "high" | "medium" | "info" — high: zmiana obowiązkowa wymagająca dostosowania systemu, która wchodzi w życie w ciągu najbliższych 3 miesięcy; medium: prawdopodobny wpływ, wymaga weryfikacji; info: brak wpływu na system lub tylko informacja,
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

// Pilne = akt lub projekt z wpływem na system i najwyżej 3 miesiące do wejścia w życie
// (tyle co najmniej trwa dostosowanie systemu); artykuły prasowe (RSS) nie bywają pilne
const URGENT_MONTHS = 3;
function urgency(priority: string, effectiveDate: string | null, press: boolean) {
  if (press) return priority === "high" ? "medium" : priority;
  if (priority === "info" || !effectiveDate) return priority;
  const limit = new Date();
  limit.setMonth(limit.getMonth() + URGENT_MONTHS);
  const today = new Date().toISOString().slice(0, 10);
  if (effectiveDate >= today && effectiveDate <= limit.toISOString().slice(0, 10)) return "high";
  return priority === "high" ? "medium" : priority;
}

// Zapisuje wynik AI: nowy wpis (insert) albo ponownie oceniony (update + nowe kategorie i Q&A)
async function saveResult(c: Candidate, ai: AiResult, slugToId: Map<string, number>, existingId?: number) {
  if (!ai.relevant) {
    if (existingId) await db.from("articles").update({ status: "skipped" }).eq("id", existingId);
    else await insertArticle(c, { status: "skipped" });
    return null;
  }

  const effective_date = c.effectiveDate ?? (/^\d{4}-\d{2}-\d{2}$/.test(ai.effective_date ?? "") ? ai.effective_date : null);
  const fields = {
    status: "done",
    summary: ai.summary,
    impact: ai.impact,
    system_impact: ai.system_impact ?? null,
    impact_types: (ai.impact_types ?? []).filter(isImpactType).slice(0, 3),
    priority: urgency(isPriority(ai.priority ?? "") ? ai.priority! : "medium", effective_date, c.source.kind === "rss" || c.source.kind === "list"),
    form_link: c.source.kind === "forms" ? c.url.split("#")[0] : ai.form ? `https://druki.gofin.pl/search/?search_form[phrase]=${encodeURIComponent(ai.form)}` : null,
    effective_date,
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

  // obszar przypisany do źródła (np. grupa druków „JPK” → JPK) jest zawsze pierwszy
  const catIds = [...new Set([c.source.category_slug, ...ai.categories].map((s) => slugToId.get(s ?? "")).filter((x): x is number => !!x))].slice(0, 2);
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
  // treść zaczyna się od <article> / <main> albo (gofin) od bloku „Źródło: … z dnia …” — menu przed nią pomijamy
  const starts = ["<article", "<main", 'class="source"'].map((m) => html.indexOf(m)).filter((i) => i >= 0);
  const content = starts.length ? html.slice(Math.min(...starts)) : html;
  const body = stripHtml(content.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, " "));
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
  let req = db
    .from("articles")
    .select("id, url, title, published_at, source_id, stage")
    .eq("status", "done")
    .order("published_at", { ascending: false })
    .limit(LIMIT);
  if (STAGE_FILTER) req = req.eq("stage", STAGE_FILTER);
  if (PHRASE_FILTER) {
    const p = `%${PHRASE_FILTER}%`;
    req = req.or(`title.ilike.${p},summary.ilike.${p},impact.ilike.${p},system_impact.ilike.${p}`);
  }
  const { data, error } = await req;
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

// Pilność zależy od daty: przeliczamy ją przy każdym przebiegu (bez AI)
async function refreshUrgency() {
  const { data, error } = await db
    .from("articles")
    .select("id, priority, effective_date, sources(kind)")
    .eq("status", "done")
        .neq("priority", "info");
  if (error) return console.error(`  ✗ pilność: ${error.message}`);
  let changed = 0;
  for (const a of data) {
    const press = ["rss", "list"].includes((a.sources as unknown as { kind: string } | null)?.kind ?? "");
    const priority = urgency(a.priority ?? "medium", a.effective_date, press);
    if (priority === a.priority) continue;
    await db.from("articles").update({ priority }).eq("id", a.id);
    changed++;
  }
  console.log(`Pilność: zmieniono ${changed}`);
}

async function main() {
  acquireLock();
  if (NOTIFY_ONLY) return notify(db);
  if (args.includes("--pilnosc")) return refreshUrgency();
  console.log(`PrzepisFK: limit ${LIMIT}, ostatnie ${DAYS} dni, model ${CLAUDE_MODEL}`);

  const [{ data: sources, error: e1 }, { data: categories, error: e2 }] = await Promise.all([
    db.from("sources").select("id, name, url, kind, active, category_slug").order("id"),
    db.from("categories").select("id, slug, name, description").order("sort"),
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
        : s.kind === "list" ? await fromList(s)
        : s.kind === "forms" ? await fromForms(s)
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

  // Lista artykułów podaje tylko tytuły — treść czytamy przed filtrem słów kluczowych
  for (const c of candidates.filter((x) => x.source.kind === "list")) {
    try {
      await enrichText(c);
    } catch (err) {
      console.error(`  ✗ ${c.url}: ${(err as Error).message}`);
    }
  }

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
  await refreshUrgency();
  await notify(db);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
