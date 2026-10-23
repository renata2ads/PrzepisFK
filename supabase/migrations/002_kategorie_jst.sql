-- Zmiana profilu PrzepisFK na JST i jednostki budżetowe: nowy zestaw kategorii
update public.categories set slug = 'rachunkowosc-budzetowa', name = 'Rachunkowość budżetowa',           sort = 1  where slug = 'rachunkowosc';
update public.categories set slug = 'sprawozdawczosc',        name = 'Sprawozdawczość (Rb, bilans)',     sort = 2  where slug = 'finanse-publiczne';
update public.categories set slug = 'budzet-wpf',             name = 'Budżet, WPF i klasyfikacja',       sort = 3  where slug = 'jpk';
update public.categories set                                 name = 'VAT i KSeF w JST',                 sort = 4  where slug = 'vat-ksef';
update public.categories set                                 name = 'Podatki i opłaty lokalne',         sort = 5  where slug = 'podatki-lokalne';
update public.categories set                                 name = 'Płace i ZUS w sferze budżetowej',  sort = 6  where slug = 'place-zus';
update public.categories set                                                                            sort = 10 where slug = 'inne';
insert into public.categories (slug, name, sort) values
  ('oswiata',              'Oświata',               7),
  ('zamowienia-publiczne', 'Zamówienia publiczne',  8),
  ('dotacje-ue',           'Dotacje i środki UE',   9);
