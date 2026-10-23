# PrzepisFK

Radar zmian w przepisach dla **kierowników produktu** u dostawcy oprogramowania dla **JST i jednostek budżetowych** — zmiany zebrane z sieci, ocenione przez AI pod kątem wpływu na system i przypisane do obszarów produktowych; kierownik weryfikuje „Wpływa / Nie wpływa”.

**Strona:** https://przepis-fk.vercel.app · projekt końcowy kursu Claude Code (ALX Vibecoding, 2026)

## Co potrafi

- **Zmiany w przepisach** — artykuły branżowe i akty prawne z Dziennika Ustaw, każdy ze streszczeniem AI, ramką „Co to zmienia”, datą wejścia w życie i pytaniami „Kogo dotyczy? / Od kiedy? / Co muszę zrobić?”.
- **Projekty przepisów** — osobna zakładka z projektami ustaw skierowanymi do Sejmu (jeszcze nie obowiązują).
- **Obszary produktowe** — FK, Wydatki, Budżetowanie, WIND, KP, JPK, Inne (opis zakresu w tabeli `categories` — podpowiedź dla AI).
- **Wpływ na system** — co sprawdzić w oprogramowaniu i rodzaj zmiany (struktury danych, wzory, słowniki, algorytmy, terminy, raporty, integracje).
- **Pilność** — pilne są akty, projekty i dokumenty urzędowe z wpływem na system i najwyżej 3 miesiącami do wejścia w życie (data z API ELI); przeliczane przy każdym przebiegu.
- **Terminarz** (`/terminarz`) — co wchodzi w życie w 3 / 6 / 12 miesięcy.
- **Obieg weryfikacji** — przy wpisie, osobno dla każdego obszaru: „Wpływa / Nie wpływa” + komentarz; w „Mój PrzepisFK” zakładki „Do weryfikacji” i „Wpływa”.
- **Tematy śledzone** — np. JPK_MAG, klasyfikacja budżetowa 2027, KSeF, sprawozdawczość Rb, PIT płatnika: zawsze przechodzą filtr i są wyróżnione (`src/lib/topics.ts`).
- **Konto użytkownika** — rejestracja, logowanie, reset hasła; wybór obszarów i własnych słów kluczowych, feed „Mój PrzepisFK”, zakładki „Zapisz na później”, usunięcie konta.
- **Zgłoś link** — zalogowany użytkownik zgłasza materiał spoza źródeł (projekt z RCL, komunikat MF, stanowisko RIO, PDF); AI streszcza go przy najbliższym przebiegu.
- **Powiadomienia** — e-mail z podsumowaniem (codziennie lub co tydzień, Resend) i nowe wpisy na kanale Discord.
- **Druki** — trzecia zakładka: nowe wersje druków z Druków Gofin (tabela „Wersje druku”) w 10 grupach (sprawozdania budżetowe, sprawozdania finansowe, JPK, VAT i KSeF, PIT płatnika, ZUS/PPK/PFRON…); grupy do wyboru w Ustawieniach.
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

Next.js 16 · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Row Level Security) · Vercel · Claude Code (`claude -p`) · rss-parser · unpdf · Resend · Discord webhook · Harmonogram zadań Windows

## Uruchomienie

Wymagania: Node.js 20+, zalogowany [Claude Code](https://claude.com/claude-code), projekt Supabase.

1. `npm install`
2. Baza: w Supabase → SQL Editor uruchom po kolei `supabase/schema.sql` i pliki z `supabase/migrations/` (002–013).
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
npm run fetch -- --przeocen --etap act # … tylko akty prawne (draft = projekty, news = artykuły)
npm run fetch -- --przeocen --fraza JPK # … tylko wpisy zawierające frazę
npm run fetch -- --pilnosc             # tylko przeliczenie pilności (bez AI)
npm run fetch -- --powiadomienia       # tylko Discord i e-mail
```

Automat: `scripts/run-fetch.bat` w Harmonogramie zadań Windows (codziennie 8:00), log w `logs/fetch.log`. Blokada `logs/fetch.lock` nie pozwala uruchomić dwóch przebiegów naraz.

Nowe źródło dodaje się wierszem w tabeli `sources` — rodzaj `rss` (kanał RSS/Atom), `eli` (Dziennik Ustaw), `sejm` (druki sejmowe) albo `page` (strona bez RSS, z której zbieramy nowe pliki PDF), `list` (strona z listą artykułów, np. GOFIN — Aktualności i sygnały) albo `forms` (dział Druków Gofin — nowe wersje druków; nazwa „Druki · <grupa>”, `category_slug` = obszar, `recursive` = przeszukiwanie poddziałów). Sprawdzenie ok. 1280 druków wydłuża przebieg o ok. 7 minut.

## Ograniczenia

- Projekty **rozporządzeń** (RCL, legislacja.gov.pl) nie mają RSS ani API — można je dodawać przez „Zgłoś link”.
- Kanały RSS zawierają tylko najnowsze ~50 artykułów; starszych artykułów nie da się pobrać wstecz.
- Oceny wpływu widzi każdy zalogowany, a rejestracja jest otwarta — w firmie warto ograniczyć ją do domeny firmowej.
- Resend bez własnej domeny wysyła e-maile tylko na adres właściciela konta.
- Nowe wpisy pojawiają się, gdy komputer z Claude Code jest włączony (zadanie nadrabia po zalogowaniu).

Streszczenia przygotowuje AI — PrzepisFK informuje, nie doradza; decyzje opieraj na treści przepisu.
