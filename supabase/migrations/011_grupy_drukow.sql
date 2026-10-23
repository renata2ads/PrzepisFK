-- Druki Gofin w grupach: każda grupa to osobne źródło (kind 'forms') przypisane do obszaru produktowego.
-- Nazwa źródła „Druki · <grupa>” jest nazwą grupy na stronie /druki.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

-- Obszar produktowy, do którego zawsze trafiają wpisy ze źródła (AI może dodać drugi)
alter table public.sources add column if not exists category_slug text;

-- Dotychczasowe źródło sprawozdawczości staje się grupą
update public.sources
  set name = 'Druki · Sprawozdania budżetowe', category_slug = 'fk'
  where url = 'https://druki.gofin.pl/dzial/46/sprawozdawczosc-budzetowa';

-- Kolejność ma znaczenie: przy druku dostępnym w kilku działach wygrywa grupa dodana wcześniej
insert into public.sources (name, url, kind, category_slug) values
  ('Druki · JPK',                         'https://druki.gofin.pl/dzial/316/jpk', 'forms', 'jpk'),
  ('Druki · JPK',                         'https://druki.gofin.pl/dzial/296/jpk-kr', 'forms', 'jpk'),
  ('Druki · Sprawozdania finansowe',      'https://druki.gofin.pl/dzial/140/sprawozdania-finansowe-dla-jednostek-budzetowych-samorzadowych-zakladow-budzetowych-i-jednostek-samorzadu-terytorialnego', 'forms', 'fk'),
  ('Druki · Sprawozdania finansowe',      'https://druki.gofin.pl/dzial/206/sprawozdanie-finansowe-dla-zakladow-budzetowych-w-formacie-xml', 'forms', 'fk'),
  ('Druki · Sprawozdania finansowe',      'https://druki.gofin.pl/dzial/163/sprawozdania-finansowe-bilans-xml-z-funkcja-generowania-i-wysylki-xml-nowosc', 'forms', 'fk'),
  ('Druki · Rachunkowość i dokumenty księgowe', 'https://druki.gofin.pl/dzial/40/rachunkowosc-w-tym-bilans-w-formacie-xml', 'forms', 'fk'),
  ('Druki · VAT i KSeF',                  'https://druki.gofin.pl/dzial/18/podatek-vat-w-tym-faktury-ksef', 'forms', 'wydatki'),
  ('Druki · PIT płatnika',                'https://druki.gofin.pl/dzial/1/podatek-dochodowy', 'forms', 'kp'),
  ('Druki · ZUS, PPK, PFRON',             'https://druki.gofin.pl/dzial/70/skladki-zus', 'forms', 'kp'),
  ('Druki · ZUS, PPK, PFRON',             'https://druki.gofin.pl/dzial/65/zasilki-i-swiadczenia', 'forms', 'kp'),
  ('Druki · ZUS, PPK, PFRON',             'https://druki.gofin.pl/dzial/164/ppk', 'forms', 'kp'),
  ('Druki · ZUS, PPK, PFRON',             'https://druki.gofin.pl/dzial/162/pfron', 'forms', 'kp'),
  ('Druki · Egzekucja i ordynacja podatkowa', 'https://druki.gofin.pl/dzial/127/egzekucja-administracyjna', 'forms', 'wind'),
  ('Druki · Egzekucja i ordynacja podatkowa', 'https://druki.gofin.pl/dzial/38/ordynacja-podatkowa', 'forms', 'wind'),
  ('Druki · Podatki i opłaty lokalne',    'https://druki.gofin.pl/dzial/180/podatki-i-oplaty-lokalne', 'forms', 'inne'),
  ('Druki · Sprawozdawczość GUS',         'https://druki.gofin.pl/dzial/104/sprawozdawczosc-gus', 'forms', 'inne')
on conflict (url) do nothing;
