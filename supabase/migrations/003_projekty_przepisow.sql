-- Zakładka „Projekty przepisów”: rodzaj wpisu + źródło projektów ustaw z API Sejmu
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

-- Rodzaj wpisu: artykuł prasowy, opublikowany akt prawny, projekt przepisu
alter table public.articles
  add column if not exists stage text not null default 'news'
  check (stage in ('news', 'act', 'draft'));

-- Dotychczasowe wpisy z Dziennika Ustaw to akty prawne
update public.articles a
set stage = 'act'
from public.sources s
where a.source_id = s.id and s.kind = 'eli';

create index if not exists articles_stage_idx on public.articles (stage);

-- Nowy rodzaj źródła: druki sejmowe (projekty ustaw)
alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check check (kind in ('rss', 'eli', 'sejm'));

insert into public.sources (name, url, kind)
values ('Sejm · projekty ustaw', 'https://api.sejm.gov.pl/sejm/term10/prints', 'sejm')
on conflict (url) do nothing;
