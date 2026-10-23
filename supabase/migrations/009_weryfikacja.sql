-- Obieg weryfikacji: kierownik produktu ocenia, czy zmiana wpływa na system w jego obszarze.
-- Jedna ocena na wpis i obszar, wspólna dla zespołu (widzą ją wszyscy zalogowani).
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

create table public.article_reviews (
  article_id  bigint   references public.articles (id) on delete cascade,
  category_id smallint references public.categories (id) on delete cascade,
  status      text not null check (status in ('affects', 'no_effect')),
  comment     text check (char_length(comment) <= 1000),
  user_id     uuid references auth.users (id) on delete set null,
  reviewer    text,                                   -- e-mail osoby, która oceniła
  updated_at  timestamptz not null default now(),
  primary key (article_id, category_id)
);

alter table public.article_reviews enable row level security;

create policy "Oceny czytają zalogowani" on public.article_reviews
  for select to authenticated using (true);
create policy "Ocena — dodanie we własnym imieniu" on public.article_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Ocena — zmiana przez członka zespołu" on public.article_reviews
  for update to authenticated using (true) with check ((select auth.uid()) = user_id);
create policy "Ocena — cofnięcie" on public.article_reviews
  for delete to authenticated using (true);

-- Własne słowa kluczowe użytkownika (WB-16): wpisy z nimi trafiają do Mojego PrzepisFK i e-maila
alter table public.profiles
  add column if not exists keywords text[] not null default '{}'
  check (cardinality(keywords) <= 20);
