# PrzepisFK — scenariusz prezentacji (ok. 11 minut)

**Cel pokazu:** pokazać, że aplikacja rozwiązuje prawdziwy problem kierownika produktu, działa w internecie i powstała z Claude Code.

## Przygotowanie (dzień wcześniej)

- [ ] Rano przebieg skryptu zakończony bez błędów (`logs/fetch.log`) — są świeże wpisy.
- [ ] Zalogowana w przeglądarce na swoje konto; w Ustawieniach zaznaczone obszary **FK** i **JPK**, grupy druków (np. Sprawozdania budżetowe) oraz słowa kluczowe, np. `Rb-27S, MT940`.
- [ ] Jeden wpis oceniony jako „Wpływa” z komentarzem, kilka wpisów czeka w „Do weryfikacji”.
- [ ] Otwarte karty przeglądarki: strona główna, `/terminarz`, „Mój PrzepisFK”, kanał Discord, skrzynka z e-mailem PrzepisFK, karta produktu (`docs/przepisfk-karta-produktu.html`).
- [ ] Terminal w folderze `przepisfk` (do pokazania skryptu).
- [ ] Plan B: zrzuty ekranu każdego kroku na wypadek braku internetu.

---

## 1. Problem (1 min) — karta produktu

> „Pracuję u dostawcy oprogramowania dla samorządów. Każda zmiana w przepisach — sprawozdania Rb, KSeF, JPK, płace — może oznaczać zmianę w naszym systemie. Kierownicy produktu przeglądają Dziennik Ustaw i serwisy branżowe ręcznie i łatwo coś przegapić. PrzepisFK ma być **impulsem**: pokazuje zmianę, mówi, którego obszaru produktu dotyczy i co sprawdzić w systemie.”

## 2. Strona publiczna (1,5 min) — przepis-fk.vercel.app

- Przewiń kilka wpisów: **obszar produktu** (FK, Wydatki, KP, JPK…), **streszczenie**, ramka **„Wpływ na system”** z rodzajem zmiany (struktury, wzory, słowniki…), etykieta **PILNE**.
- Rozwiń **„Pytania i odpowiedzi”** przy jednym wpisie.
- Kliknij zakładkę **„Projekty przepisów”** — „widzimy zmiany, zanim zaczną obowiązywać”.
- Wyszukaj frazę, np. `KSeF`.

> „Pilność nie jest zgadywana przez AI — liczy ją kod: zmiana w akcie prawnym, z wpływem na system i najwyżej 3 miesiące do wejścia w życie. Tyle co najmniej trwa dostosowanie systemu.”

## 2a. Druki (1 min) — zakładka „Druki”

- Pokaż grupy: Sprawozdania budżetowe, Sprawozdania finansowe, JPK, VAT i KSeF…
- Otwórz nową wersję druku: data „obowiązuje od”, wpływ na system, link prosto do druku.

> „Druki Gofin nie mają RSS. Skrypt codziennie sprawdza ok. 1280 druków i wyłapuje nową wersję — np. nowy wzór Rb-27S — zanim klient zapyta, czy system go obsługuje.”

## 3. Terminarz (1 min) — /terminarz

- Przełącz horyzont **3 / 6 / 12 miesięcy**, wybierz obszar **JPK**.
- Pokaż 1 stycznia 2027 — kilka zmian naraz, w tym JPK_MAG(2).

> „To widok do planowania: co i kiedy musimy mieć gotowe.”

## 4. Kierownik produktu w akcji (2,5 min) — Mój PrzepisFK

- Pokaż swoje obszary i słowa kluczowe (wpis ze znaczkiem 🔑).
- Zakładka **„Do weryfikacji”** — wpisy z moich obszarów, których nikt jeszcze nie ocenił.
- Na jednym wpisie: wpisz komentarz („Nowa wersja struktury — zadanie dla zespołu JPK”) i kliknij **„Wpływa”**.
- Przejdź do zakładki **„Wpływa”** — wpis jest na liście do zaplanowania; widać, kto i kiedy ocenił.

> „AI daje impuls, decyzję podejmuje człowiek. Ocena jest wspólna dla zespołu i osobna dla każdego obszaru — ta sama ustawa może wpływać na KP, a na FK nie.”

## 5. Powiadomienia (1 min)

- **Discord** — nowe wpisy z kolorem wg pilności.
- **E-mail** — podsumowanie z moich obszarów, pilne na górze, link do ustawień i wypisania.
- **Zgłoś link** (krótko) — „gdy znajdę coś poza źródłami, np. projekt rozporządzenia z RCL, wklejam link, a skrypt go oceni”.

## 6. Jak to działa w środku (2 min) — karta technologii + terminal

- Karta technologii: **Next.js na Vercelu → Supabase (baza, logowanie, RLS) ← lokalny skrypt z Claude**.
- Źródła: Dziennik Ustaw (API ELI — z datą wejścia w życie), projekty ustaw z API Sejmu, RSS Infor i PIT.pl, GOFIN i Druki Gofin (strony bez RSS), strona MF ze strukturami JPK.
- W terminalu pokaż (bez uruchamiania pełnego przebiegu): `npm run fetch -- --pilnosc` — trwa kilka sekund.

> „AI działa lokalnie przez `claude -p` w ramach mojej subskrypcji Pro — bez klucza API i bez haseł na GitHubie. Harmonogram zadań uruchamia skrypt codziennie o 8:00. Vercel tylko czyta gotowe wyniki.”

## 7. Czego się nauczyłam (1 min)

1. Sam RSS nie wystarczy dla przepisów — trzeba łączyć API, obserwowanie stron i zgłoszenia.
2. To, co da się policzyć (daty, pilność), liczy kod, nie AI — wynik jest powtarzalny i nie zużywa limitu.
3. Cel produktu się zmieniał (z księgowej na kierownika produktu) — Claude Code pozwolił szybko przebudować kategorie, prompt i bazę.
4. Bezpieczeństwo od początku: RLS na każdej tabeli, klucze tylko lokalnie.

## Pytania, które mogą paść

| Pytanie | Odpowiedź |
|---|---|
| Ile to kosztuje? | 0 zł poza subskrypcją Claude Pro — Vercel, Supabase, Resend i Discord na darmowych planach. |
| Czy AI się nie myli? | Może — dlatego każdy wpis ma link do źródła, a o wpływie decyduje kierownik produktu. |
| Co, gdy komputer jest wyłączony? | Zadanie nadrabia przebieg po zalogowaniu; strona działa cały czas, tylko nowe wpisy pojawią się później. |
| Czemu e-mail przychodzi tylko do Ciebie? | Resend bez własnej domeny wysyła tylko do właściciela konta — w firmie wysyłka szłaby z firmowej domeny. |
| Kto widzi oceny wpływu? | Tylko zalogowani; w firmie rejestracja byłaby ograniczona do domeny firmowej. |
