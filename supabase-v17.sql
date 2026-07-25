-- SkipperNow V17 : autoriser uniquement le compte administrateur à gérer les profils

alter table public.profiles enable row level security;
alter table public.boats enable row level security;

drop policy if exists "skippernow_admin_profiles_v17" on public.profiles;
create policy "skippernow_admin_profiles_v17"
on public.profiles
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'frederytherond@hotmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'frederytherond@hotmail.com');

drop policy if exists "skippernow_admin_boats_v17" on public.boats;
create policy "skippernow_admin_boats_v17"
on public.boats
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'frederytherond@hotmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'frederytherond@hotmail.com');
