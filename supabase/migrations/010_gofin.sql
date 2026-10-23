-- Nowe rodzaje źródeł bez RSS:
--   'list'  — strona z listą artykułów: skrypt czyta nowe linki „<lista>/<numer>/<tytuł>” i treść artykułu,
--   'forms' — dział Druków Gofin: każda nowa wersja druku (tabela „Wersje druku”, data „Okres od”) to osobny wpis.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('rss', 'eli', 'sejm', 'manual', 'page', 'list', 'forms'));

insert into public.sources (name, url, kind) values
  ('GOFIN · Aktualności i sygnały', 'https://www.gofin.pl/aktualnosci-i-sygnaly', 'list'),
  ('Druki Gofin · Sprawozdawczość budżetowa', 'https://druki.gofin.pl/dzial/46/sprawozdawczosc-budzetowa', 'forms')
on conflict (url) do nothing;
