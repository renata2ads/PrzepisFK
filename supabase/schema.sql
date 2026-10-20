-- PrzepisFK — schemat bazy danych
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

-- ============================================================
-- Słowniki i źródła
-- ============================================================

create table public.categories (
  id    smallint generated always as identity primary key,
  slug  text not null unique,
  name  text not null unique,
  sort  smallint not null default 0
);

create table public.sources (
  id         smallint generated always as identity primary key,
  name       text not null,
  url        text not null unique,
  kind       text not null default 'rss' check (kind in ('rss', 'eli')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Wpisy (wypełnia lokalny skrypt kluczem service_role)
-- ============================================================

create table public.articles (
  id               bigint generated always as identity primary key,
  source_id        smallint references public.sources (id) on delete set null,
  url              text not null unique,            -- brak duplikatów
  title            text not null,
  published_at     timestamptz,
  summary          text,                            -- streszczenie AI (2–3 zdania)
  impact           text,                            -- „co to zmienia dla księgowości”
  effective_date   date,                            -- data wejścia w życie
  form_link        text,                            -- link do wzoru druku (np. Druki Gofin)
  status           text not null default 'new'
                   check (status in ('new', 'done', 'skipped', 'error')),
  discord_sent_at  timestamptz,
  created_at       timestamptz not null default now()
);

create index articles_published_idx on public.articles (published_at desc);
create index articles_status_idx    on public.articles (status);

create table public.article_categories (
  article_id  bigint   references public.articles (id) on delete cascade,
  category_id smallint references public.categories (id) on delete cascade,
  primary key (article_id, category_id)
);

create table public.article_qa (
  id         bigint generated always as identity primary key,
  article_id bigint not null references public.articles (id) on delete cascade,
  question   text not null,
  answer     text not null,
  sort       smallint not null default 0
);

-- ============================================================
-- Użytkownicy i preferencje
-- ============================================================

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text,
  email_frequency text not null default 'none'
                  check (email_frequency in ('none', 'daily', 'weekly')),
  last_email_at   timestamptz,
  created_at      timestamptz not null default now()
);

create table public.user_categories (
  user_id     uuid     references auth.users (id) on delete cascade,
  category_id smallint references public.categories (id) on delete cascade,
  primary key (user_id, category_id)
);

create table public.bookmarks (
  user_id    uuid   references auth.users (id) on delete cascade,
  article_id bigint references public.articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- Profil tworzy się automatycznie po rejestracji
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usunięcie własnego konta (RODO) — wywoływane ze strony /ustawienia
create function public.delete_my_account()
returns void
language sql
security definer set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.categories         enable row level security;
alter table public.sources            enable row level security;
alter table public.articles           enable row level security;
alter table public.article_categories enable row level security;
alter table public.article_qa         enable row level security;
alter table public.profiles           enable row level security;
alter table public.user_categories    enable row level security;
alter table public.bookmarks          enable row level security;

-- Treści publiczne: każdy może czytać, nikt (poza service_role) nie może zmieniać
create policy "Kategorie czyta każdy"   on public.categories         for select using (true);
create policy "Wpisy czyta każdy"       on public.articles           for select using (status = 'done');
create policy "Kategorie wpisów — odczyt" on public.article_categories for select using (true);
create policy "Q&A czyta każdy"         on public.article_qa         for select using (true);
-- sources: brak polityk → dostęp tylko dla skryptu (service_role)

-- Dane użytkownika: tylko właściciel
create policy "Własny profil — odczyt" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Własny profil — zmiana" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Własne kategorie" on public.user_categories
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Własne zakładki" on public.bookmarks
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ============================================================
-- Dane startowe
-- ============================================================

insert into public.categories (slug, name, sort) values
  ('rachunkowosc',      'Rachunkowość',            1),
  ('finanse-publiczne', 'Finanse publiczne / Rb',  2),
  ('vat-ksef',          'VAT i KSeF',              3),
  ('jpk',               'JPK',                     4),
  ('podatki-lokalne',   'Podatki lokalne',         5),
  ('place-zus',         'Płace i ZUS',             6),
  ('inne',              'Inne',                    7);

insert into public.sources (name, url, kind) values
  ('Dziennik Ustaw (API Sejmu)',    'https://api.sejm.gov.pl/eli/acts/DU', 'eli'),
  ('Infor · Księgowość',            'https://ksiegowosc.infor.pl/.feed',            'rss'),
  ('Infor · Księgowość budżetowa',  'https://ksiegowosc-budzetowa.infor.pl/.feed',  'rss'),
  ('Infor · Samorząd',              'https://samorzad.infor.pl/.feed',              'rss'),
  ('Infor · Kadry',                 'https://kadry.infor.pl/.feed',                 'rss'),
  ('PIT.pl',                        'https://www.pit.pl/rss/',                      'rss');
