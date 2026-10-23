# PrzepisFK — plan wdrożenia

Na podstawie: `PrzepisFK-wymagania-biznesowe.md` i `przepisfk-karta-technologii.html`.
Wariant AI: **A** — `claude -p` lokalnie na subskrypcji Pro, bez klucza API, bez sekretów na GitHubie.

Każdy etap kończy się **działającą** aplikacją i commitem. Kod pisze Claude Code; w każdym etapie jest gotowy prompt do wklejenia.

## Stan realizacji (2026-10-23)

| Etap | Status | Uwagi z realizacji |
|---|---|---|
| 0 — Konta i narzędzia | ✅ | GitHub, Vercel, Supabase (Frankfurt), Resend, webhook Discord |
| 1 — Szkielet + GitHub + Vercel | ✅ | https://przepis-fk.vercel.app · repo `renata2ads/PrzepisFK` |
| 2 — Baza Supabase | ✅ | + migracje 002–006 (kategorie JST, projekty, zgłoszenia, obserwowane strony) |
| 3 — Skrypt RSS → Claude → Supabase | ✅ | Infor nie podaje treści w RSS → skrypt dociąga opis artykułu; model Haiku |
| 4 — Publiczna strona | ✅ | + zakładka „Projekty przepisów”, tematy śledzone, link do Druków Gofin, stronicowanie |
| 5 — Logowanie | ✅ | zmienne w Vercelu trzeba było dodać dla środowiska Production |
| 6 — Preferencje i Mój PrzepisFK | ✅ | + zakładki, usuwanie konta; RLS sprawdzone na 2 kontach testowych |
| 7 — E-mail i Discord | ✅ | Resend w trybie testowym wysyła tylko na adres właściciela konta |
| 8 — Automat | ✅ | Harmonogram zadań, codziennie 8:00; skrypt przez `node --import tsx` |
| 9 — Testy i prezentacja | ✅ | README, aktualne wymagania i karty, lista kontrolna MVP |
| 10 — Radar dla kierowników produktu | ✅ | obszary produktowe (FK, Wydatki, Budżetowanie, WIND, KP, JPK, Inne), ocena wpływu na system, pilność, Terminarz, obieg weryfikacji, słowa kluczowe — migracje 007–009 |

**Zmiany zakresu w trakcie:** profil zawężony do JST i jednostek budżetowych; nowe źródła — Dziennik Ustaw wstecz od 2026-01-01, projekty ustaw z API Sejmu, strona MF ze strukturami JPK; funkcja „Zgłoś link” zamiast pytań do wpisów. Następnie **zmiana celu**: aplikacja jest impulsem dla kierowników produktu u dostawcy oprogramowania — kategorie księgowe zastąpione obszarami produktowymi, AI ocenia wpływ na system, a kierownik zatwierdza „Wpływa / Nie wpływa”. JPK wydzielone jako osobny obszar (osobny zespół).

**Etap 10 — co powstało:**
- `articles`: wpływ na system, rodzaje zmian (struktury, wzory, słowniki, algorytmy, terminy, raporty, integracje), pilność; data wejścia w życie aktów z API ELI.
- **Pilność** liczona w kodzie: akt / projekt / dokument urzędowy z wpływem na system i ≤ 3 miesiące do wejścia w życie; przeliczana przy każdym przebiegu (`npm run fetch -- --pilnosc` ręcznie).
- `/terminarz` — zmiany w horyzoncie 3 / 6 / 12 miesięcy.
- Obieg weryfikacji (`article_reviews`) — zakładki „Do weryfikacji” i „Wpływa” w „Mój PrzepisFK”.
- Własne słowa kluczowe w Ustawieniach — feed i e-mail.
- Ponowna ocena zawężana flagami `--etap act`, `--fraza JPK` (oszczędza limit Pro).
- Next.js 16 (middleware → `src/proxy.ts`), `npm audit` — 0 podatności.

**Lekcje:** (1) RSS nie wystarczy dla przepisów — trzeba łączyć API (ELI, Sejm), obserwowanie stron i zgłoszenia ręczne; (2) polityka RLS nie może liczyć wierszy własnej tabeli (rekurencja) — liczenie w funkcji `security definer`; (3) dwa przebiegi skryptu naraz dublowały pracę — blokada pliku; (4) gov.pl wstawia niewidoczne znaki w nazwy (`JPK&#8203;_MAG`); (5) pełna ponowna ocena wyczerpuje limit Pro — przeoceniać tylko wybrane wpisy; (6) to, co da się policzyć (data, pilność), liczy kod, nie AI — wynik jest powtarzalny i nie kosztuje limitu.

---

## Etap 0 — Przygotowanie kont i narzędzi (ok. 30 min)

| Krok | Co zrobić | Sprawdzenie |
|---|---|---|
| 0.1 | Zainstaluj **Node.js LTS** i **Git** | `node -v`, `git -v` działają |
| 0.2 | Załóż konta: **GitHub**, **Vercel** (logowanie przez GitHub), **Supabase** (logowanie przez GitHub) | możesz się zalogować do wszystkich trzech |
| 0.3 | Sprawdź, że Claude Code działa na koncie Pro: `claude -p "powiedz cześć"` | dostajesz odpowiedź |
| 0.4 | Załóż konto **Resend** (e-maile) i na swoim serwerze Discord utwórz **webhook** kanału (Ustawienia kanału → Integracje → Webhooki) | masz klucz Resend i URL webhooka (zapisz je w bezpiecznym miejscu, **nie** w kodzie) |

---

## Etap 1 — Szkielet aplikacji + GitHub + Vercel (ok. 1 h)

**Cel:** pusta strona PrzepisFK jest dostępna w internecie.

1. Utwórz folder `przepisfk` i uruchom w nim `claude`.
2. Prompt:
   > Utwórz aplikację Next.js (App Router) z TypeScript i Tailwind CSS o nazwie PrzepisFK. Strona główna: nagłówek „PrzepisFK” i opis „Zmiany w przepisach finansowo-księgowych, streszczone przez AI”. Dodaj `.gitignore` z `.env*`. Zainicjuj repozytorium git i zrób pierwszy commit.
3. Na GitHubie utwórz **prywatne** repozytorium `przepisfk` i wypchnij kod (`git remote add origin …`, `git push -u origin main`).
4. Na Vercelu: **Add New → Project → Import** repozytorium `przepisfk` → Deploy.

✅ **Gotowe, gdy:** strona otwiera się pod `przepisfk.vercel.app` (lub podobnym adresem), a każdy push na `main` sam ją aktualizuje.

---

## Etap 2 — Baza danych Supabase (ok. 1 h)

**Cel:** tabele gotowe, zabezpieczone RLS.

1. W Supabase: **New project** `przepisfk`, region **Frankfurt (eu-central-1)**, zapisz hasło bazy.
2. Prompt:
   > Przygotuj plik `supabase/schema.sql` z tabelami: `sources` (źródła RSS), `categories`, `articles` (url unikalny, tytuł, źródło, data publikacji, streszczenie, wpływ_na_fk, data_wejscia_w_zycie, status), `article_categories`, `article_qa` (pytanie, odpowiedź), `profiles` (powiązany z auth.users, częstotliwość e-maili, zgoda na powiadomienia), `user_categories`, `bookmarks`. Włącz RLS: artykuły, kategorie i Q&A czytelne publicznie; profile, preferencje i zakładki — tylko właściciel. Dodaj startowe kategorie: Rachunkowość, Finanse publiczne / Rb, VAT i KSeF, JPK, Podatki lokalne, Płace i ZUS, Inne. Dodaj trigger tworzący profil po rejestracji.
3. Wklej `schema.sql` w Supabase → **SQL Editor** → Run.
4. Dodaj 3–5 źródeł RSS do tabeli `sources` (Table Editor).
5. Klucze (Supabase → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` → do `.env.local` **i** do Vercel → Settings → Environment Variables,
   - `SUPABASE_SERVICE_ROLE_KEY` → **tylko** do `.env.local` na Twoim komputerze.

✅ **Gotowe, gdy:** tabele widać w Table Editor, a przy każdej jest kłódka RLS.

---

## Etap 3 — Skrypt: RSS → Claude → Supabase (ok. 2 h)

**Cel:** jedno polecenie dodaje nowe wpisy ze streszczeniami do bazy.

1. Prompt:
   > Utwórz skrypt `scripts/fetch-news.ts` (uruchamiany `npm run fetch`), który: 1) czyta aktywne źródła z tabeli `sources`, 2) pobiera RSS (biblioteka `rss-parser`), 3) pomija wpisy, których url jest już w `articles`, 4) dla maks. 20 nowych wpisów wywołuje `claude -p` z promptem po polsku zwracającym JSON: kategorie (z listy z bazy), streszczenie 2–3 zdania, „co to zmienia dla księgowości”, data wejścia w życie (lub null), 2–3 pytania z odpowiedziami („Kogo dotyczy?”, „Od kiedy?”, „Co muszę zrobić?”), 5) zapisuje wyniki do `articles`, `article_categories`, `article_qa` kluczem service role z `.env.local`. Loguj postęp i błędy; błąd jednego wpisu nie przerywa całości.
2. Uruchom `npm run fetch` i obejrzyj wyniki w Supabase.
3. Dopracuj prompt, jeśli streszczenia są za długie lub kategorie nietrafione.

✅ **Gotowe, gdy:** drugie uruchomienie nie tworzy duplikatów, a wpisy mają kategorie, streszczenia i Q&A.

---

## Etap 4 — Publiczna strona z wpisami (ok. 1,5 h)

**Cel:** każdy widzi wpisy w internecie.

1. Prompt:
   > Na stronie głównej wyświetl najnowsze wpisy z Supabase (klucz anon): tytuł z linkiem do źródła, data, kategorie jako etykiety, streszczenie, „co to zmienia”, data wejścia w życie. Pod wpisem rozwijane „Pytania i odpowiedzi”. Dodaj filtr po kategorii i wyszukiwarkę po tekście. Strona responsywna, styl spójny z kartą technologii (granat #14213d, akcent #c2410c).
2. Sprawdź lokalnie (`npm run dev`), potem `git push`.

✅ **Gotowe, gdy:** na adresie Vercel widać wpisy, także na telefonie.

---

## Etap 5 — Logowanie użytkowników (ok. 1,5 h)

1. Supabase → Authentication → URL Configuration: **Site URL** = adres Vercel, dodaj też `http://localhost:3000` w Redirect URLs.
2. Prompt:
   > Dodaj logowanie Supabase Auth (`@supabase/ssr`): rejestracja e-mail + hasło, logowanie, wylogowanie, reset hasła. W nagłówku pokaż „Zaloguj” albo e-mail użytkownika i „Wyloguj”. Strony `/moj-feed` i `/ustawienia` dostępne tylko po zalogowaniu.

✅ **Gotowe, gdy:** możesz założyć konto, potwierdzić maila, zalogować się i wylogować — na Vercelu.

---

## Etap 6 — Preferencje i „Mój PrzepisFK” (ok. 1,5 h)

1. Prompt:
   > Strona `/ustawienia`: użytkownik zaznacza kategorie (checkboxy, zapis do `user_categories`), wybiera częstotliwość e-maili (brak / codziennie / co tydzień) i może usunąć konto. Strona `/moj-feed` pokazuje tylko wpisy z wybranych kategorii. Dodaj przycisk „Zapisz na później” (tabela `bookmarks`) i zakładkę z zapisanymi wpisami.
2. Test RLS: zaloguj się na drugie konto i sprawdź, że nie widać cudzych preferencji ani zakładek.

✅ **Gotowe, gdy:** zmiana kategorii od razu zmienia feed.

---

## Etap 7 — Powiadomienia: e-mail i Discord (ok. 1,5 h)

1. Klucz Resend i URL webhooka Discord dopisz **tylko** do `.env.local`.
2. Prompt:
   > Rozszerz `scripts/fetch-news.ts`: po zapisaniu nowych wpisów 1) wyślij na webhook Discord krótką wiadomość dla każdego nowego wpisu (tytuł, kategorie, streszczenie, link), 2) wyślij przez Resend e-mail do użytkowników z częstotliwością „codziennie” z nowymi wpisami z ich kategorii (raz w tygodniu dla „co tydzień”). Każdy e-mail ma link wypisania prowadzący do `/ustawienia`. Zapisuj datę ostatniej wysyłki, żeby nie wysyłać dwa razy.

✅ **Gotowe, gdy:** po `npm run fetch` wiadomość pojawia się na Discordzie, a mail w skrzynce.

---

## Etap 8 — Automatyczne uruchamianie (ok. 20 min)

1. Prompt:
   > Utwórz `scripts/run-fetch.bat`, który przechodzi do folderu projektu, uruchamia `npm run fetch` i dopisuje wynik do `logs/fetch.log`.
2. Windows → **Harmonogram zadań** → Utwórz zadanie podstawowe → codziennie np. 8:00 → akcja: `run-fetch.bat`. Zaznacz „Uruchom zadanie jak najszybciej po pominięciu zaplanowanego uruchomienia”.

✅ **Gotowe, gdy:** następnego dnia rano są nowe wpisy, a w `logs/fetch.log` jest wpis bez błędów.

---

## Etap 9 — Testy końcowe i prezentacja (ok. 1 h)

Lista kontrolna (kryteria akceptacji MVP):

- [ ] Strona na Vercelu działa dla osoby niezalogowanej (sprawdź w oknie prywatnym i na telefonie)
- [ ] Wpisy mają kategorie, streszczenia, „co to zmienia” i Q&A
- [ ] Ponowne `npm run fetch` nie tworzy duplikatów
- [ ] Rejestracja, logowanie, reset hasła działają
- [ ] Zmiana kategorii od razu zmienia „Mój PrzepisFK”
- [ ] Drugi użytkownik nie widzi cudzych danych (RLS)
- [ ] E-mail i wiadomość Discord dochodzą; link wypisania działa
- [ ] W repozytorium GitHub nie ma żadnych kluczy (`git log -p | grep -i key` — pusto)
- [ ] `README.md` opisuje, jak uruchomić projekt (bez kluczy)

---

## Harmonogram (orientacyjnie)

| Dzień | Etapy | Efekt |
|---|---|---|
| 1 | 0, 1, 2 | strona online, baza gotowa |
| 2 | 3, 4 | wpisy z AI widoczne publicznie |
| 3 | 5, 6 | logowanie i preferencje |
| 4 | 7, 8, 9 | powiadomienia, automat, testy — **MVP** |

## Rozwój po MVP (Should / Could)

Rejestracja tylko z domeny firmowej, e-mail z własnej domeny, panel zarządzania źródłami.

## Zasady bezpieczeństwa (cały czas)

- Klucze tylko w `.env.local` (lokalnie) i Environment Variables (Vercel) — **nigdy** w kodzie ani na GitHubie.
- `SUPABASE_SERVICE_ROLE_KEY`, klucz Resend i webhook Discord — **tylko** na Twoim komputerze.
- Repozytorium prywatne; przed każdym `git push` sprawdź `git status`, czy nie ma `.env.local`.
