# PrzepisFK — wymagania biznesowe

> Radar zmian w przepisach dla kierowników produktu u dostawcy oprogramowania dla JST — zebrane z sieci, ocenione przez AI pod kątem wpływu na system i przypisane do obszarów produktowych.

**Strona:** https://przepis-fk.vercel.app · **Kod:** https://github.com/renata2ads/PrzepisFK
Wzorowane na karcie technologii **NewsRadar** — ten sam stos, inna dziedzina. Stan dokumentu: 2026-10-23 (MVP + funkcje dla kierowników produktu).

**Decyzja AI: wariant A — tylko subskrypcja Claude Pro.** Całe przetwarzanie AI odbywa się lokalnie przez `claude -p` (bez płatnego klucza API). Strona na Vercelu tylko wyświetla gotowe wyniki zapisane w Supabase.

## 1. Cel i użytkownicy

- **Cel (doprecyzowany 2026-10-23):** PrzepisFK to **impuls dla kierowników produktu** — szybko pokazuje zmianę w przepisach, mówi, który obszar produktu może dotyczyć i co sprawdzić w systemie. Kierownik weryfikuje, czy zmiana wpływa na jego system („Wpływa / Nie wpływa” + komentarz).
- **Profil przepisów:** wyłącznie zmiany istotne dla **jednostek samorządu terytorialnego i jednostek budżetowych** (urzędy, organy, szkoły, przedszkola, zarządy dróg, MOPS). Tematy wyłącznie firmowe i osobiste są odrzucane; PIT — **po stronie płatnika** (PIT-11, PIT-4R, PIT-8AR, PIT-8C).
- **Użytkownicy:** kierownicy produktu i analitycy dostawcy oprogramowania dla JST; pomocniczo konsultanci i wdrożeniowcy.
- **Obszary produktowe:**

| Obszar | Zakres |
|---|---|
| FK | księgowanie, plan kont, słowniki klasyfikacji budżetowej, sprawozdania Rb (Rb-27S, Rb-ST…), bilans, KSeF na przelewach, gospodarka magazynowa, środki trwałe |
| Wydatki | faktury sprzedażowe i wydatkowe, rejestry VAT, KSeF — wysyłka i pobieranie, przelewy, MT940, split payment |
| Budżetowanie | WPF, planowanie budżetu, uchwała budżetowa, zmiany planu |
| WIND | windykacja, upomnienia, tytuły wykonawcze, egzekucja, odsetki |
| KP | kadry i płace, ZUS, PIT płatnika, PPK, nauczyciele |
| JPK | struktury JPK (V7, MAG, KR, FA, ST, CIT, EWP, WB) — osobny zespół; FK i Wydatki dają tylko widok danych do JPK |
| Inne | pozostałe zmiany istotne dla JST |

- **Tematy śledzone:** JPK_MAG · Klasyfikacja budżetowa 2027 · KSeF w JST · Sprawozdawczość Rb · PIT płatnika.

### Źródła

| Źródło | Rodzaj | Co daje |
|---|---|---|
| Dziennik Ustaw (API ELI Sejmu) | `eli` | opublikowane akty prawne z **datą wejścia w życie z API** — okno 90 dni, uzupełnienie wsteczne `--od` |
| Sejm — druki (API Sejmu) | `sejm` | projekty ustaw → zakładka „Projekty przepisów” |
| Infor: Księgowość, Księgowość budżetowa, Samorząd, Kadry | `rss` | artykuły branżowe (okno 14 dni) |
| PIT.pl | `rss` | podatki, PIT płatnika, ZUS |
| MF — gov.pl/web/kas/struktury-jpk | `page` | nowe broszury i struktury JPK (np. JPK_MAG(2)) — strona bez RSS, wykrywanie nowych PDF |
| Zgłoszone linki | `manual` | materiały spoza źródeł (RCL, MF, RIO, interpretacje) zgłaszane przez użytkowników |
| GOFIN — Aktualności i sygnały | `list` | artykuły Gazety Podatkowej — strona z listą artykułów bez RSS, skrypt czyta treść i datę wydania |
| Druki Gofin — 10 grup | `forms` | **nowe wersje druków** (tabela „Wersje druku”, data „Okres od”) w grupach: sprawozdania budżetowe, sprawozdania finansowe, rachunkowość, JPK, VAT i KSeF, PIT płatnika, ZUS/PPK/PFRON, egzekucja i ordynacja, podatki lokalne, GUS; ok. 1280 druków sprawdzanych codziennie |

Sprawdzone i niedostępne automatycznie: RCL / legislacja.gov.pl, podatki.gov.pl, ZUS, Gazeta Prawna, nowaklasyfikacja.pl, jpk.info.pl (brak RSS/API) — obejście: „Zgłoś link” albo źródło typu `page`.

## 2. Wymagania funkcjonalne

✅ zrobione · ⏳ częściowo · ➖ poza zakresem

| # | Obszar | Wymaganie | Priorytet | Status |
|---|--------|-----------|-----------|--------|
| **Pobieranie danych** |||||
| WB-01 | Źródła | Lokalny skrypt (ręcznie lub z Harmonogramu zadań Windows, codziennie 8:00) pobiera wpisy ze źródeł z tabeli wyżej. | Must | ✅ |
| WB-02 | Źródła | Lista źródeł jest w bazie; można dodać / wyłączyć źródło bez zmiany kodu. | Should | ✅ |
| WB-23 | Projekty przepisów | Projekty ustaw z Sejmu w osobnej zakładce, oznaczone „jeszcze nie obowiązuje”. | Should | ✅ |
| WB-24 | Strony bez RSS | Obserwowanie strony (np. MF — struktury JPK) i wykrywanie nowych plików PDF. | Should | ✅ |
| WB-25 | Zgłoś link | Zalogowany użytkownik zgłasza link (strona lub PDF); skrypt streszcza go przy najbliższym przebiegu; status widoczny na stronie; limit 5/dobę. | Should | ✅ |
| WB-26 | Tematy śledzone | Lista tematów, które zawsze przechodzą filtr, są streszczane jako pierwsze i wyróżnione. | Should | ✅ |
| **AI (lokalnie, subskrypcja Pro)** |||||
| WB-03 | Klasyfikacja AI | Claude jako analityk dostawcy oprogramowania ocenia, czy zmiana dotyczy JST, i przypisuje 1–2 obszary produktowe. | Must | ✅ |
| WB-04 | Streszczenie AI | 2–3 zdania po polsku, „co to zmienia”, data wejścia w życie. | Must | ✅ |
| WB-05 | Pytania i odpowiedzi AI | „Kogo dotyczy?”, „Od kiedy?”, „Co muszę zrobić?” — rozwijane na stronie. | Must | ✅ |
| WB-30 | Ocena wpływu na system | „Wpływ na system” (co sprawdzić w oprogramowaniu) + rodzaj zmiany: struktury danych, wzory/wydruki, słowniki, algorytmy, terminy, raporty, integracje. | Must | ✅ |
| WB-31 | Pilność | **Pilne** = akt lub projekt (albo dokument urzędowy) z wpływem na system i **najwyżej 3 miesiące** do wejścia w życie; przeliczane codziennie bez AI. Artykuły prasowe nie bywają pilne. | Must | ✅ |
| WB-32 | Data z Dziennika Ustaw | Data wejścia w życie aktu pobierana z API ELI (pewniejsza niż ocena AI). | Should | ✅ |
| WB-06 | Tygodniowy przegląd AI | „Najważniejsze zmiany tygodnia” per obszar. | Should | ➖ poza zakresem (decyzja 2026-10-23) — wystarcza e-mail tygodniowy z listą wpisów, pilne na górze |
| WB-07 | Oszczędzanie limitu | Filtr słów kluczowych przed AI, maks. 20 streszczeń na przebieg, model Haiku, brak ponownych streszczeń. | Must | ✅ |
| WB-08 | Pytania własne | Pytanie do wpisu, odpowiedź przy następnym przebiegu. | Could | ⏳ zrealizowane jako „Zgłoś link” z notatką |
| WB-27 | Ponowna ocena | `--przeocen` ocenia opublikowane wpisy nowymi zasadami; zawężenie `--etap act` i `--fraza JPK`. | Could | ✅ |
| **Kierownik produktu** |||||
| WB-33 | Terminarz zmian | `/terminarz` — co wchodzi w życie w 3 / 6 / 12 miesięcy, grupowane po miesiącach, filtr obszaru, kropka pilności. | Must | ✅ |
| WB-34 | Obieg weryfikacji | Przy wpisie, osobno dla każdego obszaru: „Wpływa” / „Nie wpływa” + komentarz; widać, kto i kiedy ocenił; ocenę można cofnąć. Ocena wspólna dla zespołu. | Must | ✅ |
| WB-35 | Do weryfikacji | W „Mój PrzepisFK” zakładki **Do weryfikacji** (wpisy z moich obszarów bez oceny, bez informacyjnych) i **Wpływa** (lista do zaplanowania prac). | Must | ✅ |
| WB-36 | Eksport do Jiry | Z wpisu „Wpływa” zgłoszenie w Jirze. | Could | ➖ poza zakresem (decyzja 2026-10-23) |
| **Baza danych** |||||
| WB-09 | Zapis | Wpisy w Supabase **bez duplikatów** (unikalny link); blokada równoległych przebiegów. | Must | ✅ |
| WB-10 | Wyszukiwanie | Wyszukiwanie tekstu, filtr obszaru, stronicowanie. | Should | ✅ (bez zakresu dat) |
| **Użytkownicy i logowanie** |||||
| WB-11 | Rejestracja i logowanie | E-mail + hasło, potwierdzenie mailem. | Must | ✅ |
| WB-12 | Wylogowanie i reset hasła | Wylogowanie, reset hasła mailem, strona „Nowe hasło”. | Must | ✅ |
| WB-13 | Prywatność | Każdy widzi i edytuje tylko swoje dane (RLS); oceny wpływu widzą tylko zalogowani. | Must | ✅ |
| **Preferencje** |||||
| WB-14 | Obszary | Wybór obszarów produktowych i feed „Mój PrzepisFK”. | Must | ✅ |
| WB-15 | Zmiana preferencji | Zmiana obszarów, słów kluczowych i częstotliwości e-maili działa od razu. | Must | ✅ |
| WB-16 | Słowa kluczowe | Własne słowa kluczowe (do 20, np. „Rb-27S, MT940”) — wpisy z nimi trafiają do feedu i e-maila, oznaczone 🔑. | Could | ✅ |
| WB-17 | Zakładki | „Zapisz na później” i zakładka „Zapisane”. | Could | ✅ |
| WB-28 | Usunięcie konta | Usunięcie konta z danymi (RODO). | Must | ✅ |
| **Element online — powiadomienia** |||||
| WB-18 | E-mail | Codzienne lub cotygodniowe podsumowanie z obszarów i słów kluczowych; pilne na górze z etykietą PILNE i „Wpływem na system” (Resend). | Must | ✅ (tryb testowy: tylko na adres właściciela konta Resend) |
| WB-19 | Discord | Nowe wpisy na kanale Discord (webhook), kolor wg pilności, maks. 10 na przebieg. | Should | ✅ |
| WB-20 | Rezygnacja | Link do ustawień / wypisania w każdym e-mailu. | Must | ✅ |
| **Strona www** |||||
| WB-21 | Strona publiczna | Wpisy i terminarz publicznie; feed, weryfikacja, zakładki, ustawienia, zgłoszenia — po zalogowaniu. | Must | ✅ |
| WB-22 | Responsywność | Telefon i komputer (sprawdzone przy 390 px). | Must | ✅ |
| WB-29 | Link do druku | Link „Sprawdź druk w Druki Gofin” przy wpisach o konkretnym formularzu. | Could | ✅ |
| WB-37 | Nowe wersje druków | Codzienne sprawdzanie Druków Gofin; nowa wersja druku = wpis z datą „obowiązuje od”, oceną wpływu i obszarem grupy. Okno 90 dni wstecz + przyszłe. | Must | ✅ |
| WB-38 | Zakładka „Druki” | Trzecia zakładka obok zmian i projektów przepisów; filtr grup druków. Druki nie mieszają się ze „Zmianami w przepisach”. | Must | ✅ |
| WB-39 | Grupy druków w Ustawieniach | Użytkownik wybiera grupy druków — nowe wersje trafiają do Mojego PrzepisFK i e-maila. | Should | ✅ |

Priorytety: **Must** — MVP na koniec kursu, **Should** — jeśli starczy czasu, **Could** — rozwój.

## 3. Jak płyną dane

```
[Twój komputer, codziennie 8:00 — Harmonogram zadań]
  zgłoszone linki · MF struktury JPK · RSS · GOFIN · Druki Gofin (nowe wersje) · Dziennik Ustaw (+ data z API ELI) · Sejm
        → filtr JST (słowa kluczowe + tematy śledzone)
        → claude -p (Haiku): ocena, obszary produktowe, streszczenie, wpływ na system, Q&A, druk
        → pilność z daty (≤ 3 mies.) → Supabase → Discord (webhook) · e-mail (Resend)
[Vercel]  strona www ← Supabase (RLS) → Zmiany · Projekty · Druki, „Mój PrzepisFK” (Do weryfikacji / Wpływa), Terminarz, „Zgłoś link”
```

## 4. Wymagania techniczne i organizacyjne

| # | Wymaganie | Status |
|---|-----------|--------|
| WT-01 | **Hosting:** strona na **Vercelu** — tylko odczyt z bazy i obsługa użytkowników, bez wywołań AI. | ✅ |
| WT-02 | **Kod:** repozytorium na **GitHubie**; push na `main` automatycznie wdraża aplikację. | ✅ |
| WT-03 | **Stos:** Next.js 16 + React 19 + TypeScript + Tailwind CSS; Supabase Postgres + Auth + RLS. | ✅ |
| WT-04 | **AI — wariant A:** `claude -p` (Haiku) na koncie **Pro**, lokalny skrypt Node/TypeScript. Brak klucza API i kosztów za użycie. | ✅ |
| WT-05 | **Harmonogram:** zadanie Windows codziennie 8:00 (nadrabia po zalogowaniu), log `logs/fetch.log`, blokada równoległych przebiegów. | ✅ |
| WT-06 | **Sekrety** tylko w `.env.local` (lokalnie) i zmiennych Vercela (wyłącznie publiczny klucz `anon`) — nigdy w repozytorium. | ✅ |
| WT-07 | **Bezpieczeństwo:** RLS na wszystkich tabelach; limit zgłoszeń w bazie; `npm audit` — 0 podatności. | ✅ |
| WT-08 | **RODO:** przechowujemy tylko e-mail, preferencje i oceny wpływu; użytkownik może usunąć konto wraz z danymi. | ✅ |

## 5. Model danych

- `sources` — źródła (nazwa, url, rodzaj `rss`/`eli`/`sejm`/`page`/`list`/`forms`/`manual`, aktywne, obszar wymuszony `category_slug`, przeszukiwanie w głąb `recursive`); publicznie tylko nazwa — grupa druku to nazwa „Druki · <grupa>”
- `articles` — wpisy (url unikalny, tytuł, źródło, data, rodzaj `news`/`act`/`draft`, streszczenie, wpływ, **wpływ na system, rodzaje zmian, pilność**, data wejścia w życie, link do druku, status, wysyłka na Discord)
- `article_qa` — pytania i odpowiedzi AI
- `categories`, `article_categories` — 7 obszarów produktowych z opisem zakresu (podpowiedź dla AI) i przypisania
- `article_reviews` — ocena wpływu per wpis i obszar („Wpływa” / „Nie wpływa”, komentarz, kto, kiedy)
- `profiles` — użytkownik (Supabase Auth), częstotliwość e-maili, **słowa kluczowe**, **grupy druków**
- `user_categories`, `bookmarks` — preferencje i zakładki
- `submissions` — zgłoszone linki ze statusem i odpowiedzią dla zgłaszającego

Migracje: `supabase/schema.sql` + `supabase/migrations/002–013`.

## 6. Kryteria akceptacji MVP

| # | Kryterium | Wynik |
|---|---|---|
| 1 | Na publicznym adresie widać wpisy ze streszczeniami, obszarami, wpływem na system i Q&A | ✅ 83 wpisy (artykuły, akty, projekty) |
| 2 | Skrypt dodaje nowe wpisy bez duplikatów i w ramach limitu | ✅ |
| 3 | Rejestracja, logowanie, wybór obszarów, własny feed; zmiana działa od razu | ✅ |
| 4 | E-mail z nowymi wpisami i wpisy na Discordzie | ✅ |
| 5 | Kod na GitHubie, push wdraża aplikację na Vercel | ✅ |
| 6 | Kierownik produktu widzi, co czeka na weryfikację, i oznacza wpływ na system | ✅ |

## 7. Ograniczenia i rozwój

- **E-mail do innych osób:** Resend bez własnej domeny wysyła tylko na adres właściciela konta. Rozwój: własna domena w Resend albo wysyłka z Gmaila (hasło aplikacji tylko w `.env.local`).
- **Oceny wpływu widzi każdy zalogowany** — rejestracja jest otwarta. Przy użyciu w firmie: rejestracja tylko z domeny firmowej.
- **Projekty rozporządzeń (RCL):** brak RSS/API — „Zgłoś link”.
- **Kanały RSS:** tylko ~50 najnowszych artykułów; starszych nie da się pobrać wstecz.
- **Dostępność danych:** nowe wpisy pojawiają się, gdy komputer z Claude Code jest włączony.
- **Rozwój:** kolejne strony typu `page`, filtr zakresu dat, wysyłka e-maili do innych osób.
- **Poza zakresem:** czat z AI na żywo (wymaga klucza API — wariant B), integracja z produkcyjnymi systemami, porady prawne / podatkowe — PrzepisFK informuje, nie zastępuje źródła przepisu.
