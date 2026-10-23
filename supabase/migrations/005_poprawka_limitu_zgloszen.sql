-- Poprawka do 004: polityka limitu liczyła wiersze tej samej tabeli → „infinite recursion detected in policy”.
-- Liczenie przenosimy do funkcji security definer (działa z pominięciem RLS, zwraca tylko liczbę).
-- Uruchom w Supabase: SQL Editor → New query → wklej całość → Run.

create or replace function public.my_submissions_last_day()
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::integer from public.submissions
  where user_id = auth.uid() and created_at > now() - interval '1 day';
$$;

revoke execute on function public.my_submissions_last_day() from public, anon;
grant execute on function public.my_submissions_last_day() to authenticated;

drop policy if exists "Własne zgłoszenia — dodanie (limit 5/dobę)" on public.submissions;

create policy "Własne zgłoszenia — dodanie (limit 5/dobę)" on public.submissions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and public.my_submissions_last_day() < 5
  );
