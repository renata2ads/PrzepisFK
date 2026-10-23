-- Radar dla kierowników produktu: obszary produktowe zamiast kategorii księgowych + ocena wpływu na system.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.
-- UWAGA: usuwa dotychczasowe kategorie wraz z przypisaniami wpisów i wyborami użytkowników
-- (wpisy zostają; skrypt `npm run fetch -- --przeocen` przypisze je do nowych obszarów).

-- Ocena wpływu na oprogramowanie
alter table public.articles
  add column if not exists system_impact text,                          -- co sprawdzić / zmienić w systemie
  add column if not exists impact_types text[] not null default '{}',   -- rodzaje zmian w systemie
  add column if not exists priority text
    check (priority in ('high', 'medium', 'info'));

create index if not exists articles_effective_idx on public.articles (effective_date);

-- Opis zakresu obszaru (podpowiedź dla AI i użytkownika)
alter table public.categories add column if not exists description text;

delete from public.categories;  -- kaskadowo: article_categories, user_categories

insert into public.categories (slug, name, sort, description) values
  ('fk',        'FK',           1, 'księgowanie, plan kont, słowniki klasyfikacji budżetowej, sprawozdania Rb (Rb-27S, Rb-28S, Rb-ST, Rb-N, Rb-Z…), bilans, KSeF na przelewach, gospodarka magazynowa (JPK_MAG), środki trwałe'),
  ('wydatki',   'Wydatki',      2, 'faktury sprzedażowe i wydatkowe, rejestry VAT, JPK_V7, KSeF — wysyłka i pobieranie faktur, wystawianie przelewów, wyciągi MT940, split payment'),
  ('budzet',    'Budżetowanie', 3, 'wieloletnia prognoza finansowa (WPF), planowanie budżetu, uchwała budżetowa, zmiany planu, limity wydatków'),
  ('wind',      'WIND',         4, 'windykacja należności, upomnienia, tytuły wykonawcze, egzekucja administracyjna, odsetki, przedawnienie'),
  ('kp',        'KP',           5, 'kadry i płace, wynagrodzenia, ZUS, PIT płatnika (PIT-11, PIT-4R, PIT-8AR), PPK, urlopy, czas pracy, nauczyciele'),
  ('inne',      'Inne',         6, 'pozostałe zmiany istotne dla JST, które nie dotyczą powyższych obszarów');
