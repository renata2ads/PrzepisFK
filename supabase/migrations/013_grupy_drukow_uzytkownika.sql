-- Grupy druków wybrane przez użytkownika (np. „Sprawozdania budżetowe”, „JPK”):
-- nowe wersje druków z tych grup trafiają do Mojego PrzepisFK i e-maila.
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

alter table public.profiles
  add column if not exists form_groups text[] not null default '{}'
  check (cardinality(form_groups) <= 30);
