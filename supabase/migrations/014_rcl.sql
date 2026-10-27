-- Nowy rodzaj źródła 'rcl' — projekty rządowe z legislacja.gov.pl (Rządowe Centrum Legislacji):
-- rozporządzenia i projekty ustaw, zanim trafią do Sejmu. Skrypt czyta listę najnowszych projektów
-- (wszyscy wnioskodawcy), filtruje tytuły słowami z LAW_KEYWORDS i zapisuje je jako etap 'draft'.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('rss', 'eli', 'sejm', 'manual', 'page', 'list', 'forms', 'rcl'));

insert into public.sources (name, url, kind) values
  ('Legislacja.gov.pl · Projekty rządowe', 'https://legislacja.gov.pl/lista?pSize=100', 'rcl')
on conflict (url) do nothing;
