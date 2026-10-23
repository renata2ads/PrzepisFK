# PrzepisFK

Zmiany w przepisach dla **jednostek samorządu terytorialnego i jednostek budżetowych** (urzędy, szkoły, przedszkola, zarządy dróg, MOPS…) — zebrane z sieci, streszczone przez AI i dopasowane do obszarów wybranych przez użytkownika.

**Strona:** https://przepis-fk.vercel.app · projekt końcowy kursu Claude Code (ALX Vibecoding, 2026)

## Co potrafi

- **Zmiany w przepisach** — artykuły branżowe i akty prawne z Dziennika Ustaw, każdy ze streszczeniem AI, ramką „Co to zmienia”, datą wejścia w życie i pytaniami „Kogo dotyczy? / Od kiedy? / Co muszę zrobić?”.
- **Projekty przepisów** — osobna zakładka z projektami ustaw skierowanymi do Sejmu (jeszcze nie obowiązują).
- **10 obszarów JST** — rachunkowość budżetowa, sprawozdawczość (Rb, bilans), budżet i WPF, VAT i KSeF w JST, podatki i opłaty lokalne, płace i ZUS, oświata, zamówienia publiczne, dotacje i środki UE, inne.
- **Tematy śledzone** — np. JPK_MAG, klasyfikacja budżetowa 2027, KSeF, sprawozdawczość Rb, PIT płatnika: zawsze przechodzą filtr i są wyróżnione (`src/lib/topics.ts`).
- **Konto użytkownika** — rejestracja, logowanie, reset hasła; wybór obszarów, feed „Mój PrzepisFK”, zakładki „Zapisz na później”, usunięcie konta.
- **Zgłoś link** — zalogowany użytkownik zgłasza materiał spoza źródeł (projekt z RCL, komunikat MF, stanowisko RIO, PDF); AI streszcza go przy najbliższym przebiegu.
- **Powiadomienia** — e-mail z podsumowaniem (codziennie lub co tydzień, Resend) i nowe wpisy na kanale Discord.
- **Link do Druków Gofin** przy wpisach o konkretnym formularzu (PIT-11, PIT-4R, Rb-27S…).

## Jak to działa

```
[Twój komputer, codziennie 8:00]
  zgłoszone linki ─┐
  RSS (Infor, PIT.pl)   ├─► filtr JST ─► claude -p (Haiku, subskrypcja Pro) ─► Supabase ─► Discord / e-mail
  Dziennik Ustaw (API ELI) │
  Sejm — projekty ustaw    │
  gov.pl MF — struktury JPK┘
[Vercel]  strona Next.js czyta gotowe wpisy z Supabase (RLS)
```

AI działa **wyłącznie lokalnie** (`claude -p` na koncie Claude Pro) — bez klucza API, bez sekretów na GitHubie i w Vercelu poza publicznym kluczem `anon` Supabase.

## Stos

Next.js 15 · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Row Level Security) · Vercel · Claude Code (`claude -p`) · rss-parser · unpdf · Resend · Discord webhook · Harmonogram zadań Windows

## Uruchomienie

Wymagania: Node.js 20+, zalogowany [Claude Code](https://claude.com/claude-code), projekt Supabase.

1. `npm install`
2. Baza: w Supabase → SQL Editor uruchom po kolei `supabase/schema.sql` i pliki z `supabase/migrations/` (002–006).
3. Skopiuj `.env.example` do `.env.local` i uzupełnij:
   | Zmienna | Gdzie |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` **i** Vercel → Environment Variables |
   | `SUPABASE_SERVICE_ROLE_KEY` | tylko `.env.local` (skrypt) |
   | `RESEND_API_KEY`, `DISCORD_WEBHOOK_URL` | tylko `.env.local` (opcjonalne) |
4. W Supabase → Authentication → URL Configuration ustaw Site URL i Redirect URLs na adres strony.
5. Strona lokalnie: `npm run dev` → http://localhost:3000

## Skrypt pobierający wpisy

```bash
npm run fetch                          # nowe wpisy (maks. 20 streszczeń) + powiadomienia
npm run fetch -- --limit 5             # mniej streszczeń — oszczędza limit Pro
npm run fetch -- --od 2026-01-01       # uzupełnienie Dziennika Ustaw i projektów od daty
npm run fetch -- --przeocen            # ponowna ocena opublikowanych wpisów (po zmianie promptu)
npm run fetch -- --powiadomienia       # tylko Discord i e-mail
```

Automat: `scripts/run-fetch.bat` w Harmonogramie zadań Windows (codziennie 8:00), log w `logs/fetch.log`. Blokada `logs/fetch.lock` nie pozwala uruchomić dwóch przebiegów naraz.

Nowe źródło dodaje się wierszem w tabeli `sources` — rodzaj `rss` (kanał RSS/Atom), `eli` (Dziennik Ustaw), `sejm` (druki sejmowe) albo `page` (strona bez RSS, z której zbieramy nowe pliki PDF).

## Ograniczenia

- Projekty **rozporządzeń** (RCL, legislacja.gov.pl) nie mają RSS ani API — można je dodawać przez „Zgłoś link”.
- Kanały RSS zawierają tylko najnowsze ~50 artykułów; starszych artykułów nie da się pobrać wstecz.
- Resend bez własnej domeny wysyła e-maile tylko na adres właściciela konta.
- Nowe wpisy pojawiają się, gdy komputer z Claude Code jest włączony (zadanie nadrabia po zalogowaniu).

Streszczenia przygotowuje AI — PrzepisFK informuje, nie doradza; decyzje opieraj na treści przepisu.
