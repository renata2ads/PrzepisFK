-- Obserwowane strony bez RSS (np. gov.pl/web/kas/struktury-jpk): skrypt wykrywa nowe pliki PDF na stronie.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('rss', 'eli', 'sejm', 'manual', 'page'));

insert into public.sources (name, url, kind)
values ('MF · Struktury JPK', 'https://www.gov.pl/web/kas/struktury-jpk', 'page')
on conflict (url) do nothing;
