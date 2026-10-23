-- JPK to osobny zespół: wydzielamy obszar JPK z FK i Wydatków.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.
-- Potem: npm run fetch -- --przeocen --fraza JPK  (AI przypisze wpisy o JPK do nowego obszaru)

insert into public.categories (slug, name, sort, description) values
  ('jpk', 'JPK', 6, 'jednolite pliki kontrolne i ich struktury: JPK_V7M/V7K, JPK_MAG, JPK_KR, JPK_FA, JPK_ST, JPK_CIT, JPK_PKPIR, JPK_EWP, JPK_WB — nowe wersje schematów XSD, terminy i zakres przekazywania; FK i Wydatki dają tylko widok danych do JPK')
on conflict (slug) do update set name = excluded.name, sort = excluded.sort, description = excluded.description;

update public.categories set sort = 7 where slug = 'inne';

update public.categories
  set description = 'księgowanie, plan kont, słowniki klasyfikacji budżetowej, sprawozdania Rb (Rb-27S, Rb-28S, Rb-ST, Rb-N, Rb-Z…), bilans, KSeF na przelewach, gospodarka magazynowa, środki trwałe (struktury JPK — obszar JPK)'
  where slug = 'fk';

update public.categories
  set description = 'faktury sprzedażowe i wydatkowe, rejestry VAT, KSeF — wysyłka i pobieranie faktur, wystawianie przelewów, wyciągi MT940, split payment (struktury JPK — obszar JPK)'
  where slug = 'wydatki';
