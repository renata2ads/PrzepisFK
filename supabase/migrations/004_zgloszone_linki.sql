-- „Zgłoś link”: zalogowany użytkownik zgłasza materiał spoza RSS (RCL, MF, RIO, interpretacje…),
-- lokalny skrypt streszcza go przy najbliższym przebiegu.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

create table public.submissions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url         text not null check (url ~* '^https?://'),
  note        text check (char_length(note) <= 500),
  status      text not null default 'pending'
              check (status in ('pending', 'done', 'rejected', 'error')),
  message     text,                                   -- wyjaśnienie dla użytkownika
  article_id  bigint references public.articles (id) on delete set null,
  created_at  timestamptz not null default now(),
  processed_at timestamptz
);

create index submissions_status_idx on public.submissions (status, created_at);

alter table public.submissions enable row level security;

create policy "Własne zgłoszenia — odczyt" on public.submissions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Dodawanie: tylko jako siebie, ze statusem 'pending', maks. 5 zgłoszeń na dobę
create policy "Własne zgłoszenia — dodanie (limit 5/dobę)" on public.submissions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and (
      select count(*) from public.submissions s
      where s.user_id = (select auth.uid()) and s.created_at > now() - interval '1 day'
    ) < 5
  );

-- Źródło dla wpisów ze zgłoszonych linków
alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check check (kind in ('rss', 'eli', 'sejm', 'manual'));

insert into public.sources (name, url, kind, active)
values ('Zgłoszony link', 'manual://zgloszenia', 'manual', false)
on conflict (url) do nothing;

-- Nazwy źródeł są potrzebne na stronie przy wpisach (bez adresów — te zostają prywatne)
revoke select on public.sources from anon, authenticated;
grant select (id, name) on public.sources to anon, authenticated;
create policy "Nazwy źródeł czyta każdy" on public.sources for select using (true);
