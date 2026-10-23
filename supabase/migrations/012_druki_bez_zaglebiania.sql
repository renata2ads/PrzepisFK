-- Druki: które źródła przeszukiwać w głąb poddziałów.
-- recursive = null → skrypt decyduje sam (dział z menu głównego: tak, poddział: nie).
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

alter table public.sources add column if not exists recursive boolean;

-- Bilans XML jest w menu, ale jego strona pokazuje całe drzewo Rachunkowości — bez zagłębiania
update public.sources set recursive = false
  where url = 'https://druki.gofin.pl/dzial/163/sprawozdania-finansowe-bilans-xml-z-funkcja-generowania-i-wysylki-xml-nowosc';

-- JPK_KR nie ma własnych druków — są w poddziałach JPK_KR_PD i JPK_ST_KR
update public.sources set active = false where url = 'https://druki.gofin.pl/dzial/296/jpk-kr';
insert into public.sources (name, url, kind, category_slug) values
  ('Druki · JPK', 'https://druki.gofin.pl/dzial/302/jpk-kr-pd', 'forms', 'jpk'),
  ('Druki · JPK', 'https://druki.gofin.pl/dzial/303/jpk-st-kr', 'forms', 'jpk')
on conflict (url) do nothing;
