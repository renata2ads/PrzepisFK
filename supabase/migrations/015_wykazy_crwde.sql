-- Nowe rodzaje źródeł:
--   'wykaz' — wykazy prac legislacyjnych (projekty dopiero planowane): Rada Ministrów (plik CSV rejestru gov.pl)
--             i Minister Finansów (Excel „Akty wpisane do Wykazu…”); pozycje w toku, tytuły filtrowane LAW_KEYWORDS,
--   'crwde' — nowe wzory e-deklaracji MF w CRWDE (ePUAP); nazwa „Druki · …” → wpisy w zakładce Druki.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('rss', 'eli', 'sejm', 'manual', 'page', 'list', 'forms', 'rcl', 'wykaz', 'crwde'));

insert into public.sources (name, url, kind) values
  ('Wykaz prac legislacyjnych Rady Ministrów', 'https://www.gov.pl/web/premier/wplip-rm', 'wykaz'),
  ('Wykaz prac legislacyjnych Ministra Finansów', 'https://www.gov.pl/web/finanse/wykaz-prac-legislacyjnych', 'wykaz'),
  ('Druki · e-Deklaracje MF (CRWDE)', 'https://epuap.gov.pl/wps/portal/strefa-urzednika/inne-systemy/crwde', 'crwde')
on conflict (url) do nothing;
