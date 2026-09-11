create table if not exists public.home_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text,
  image_url text not null,
  link_url text,
  badge text default 'Partenaire',
  sponsored boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_partners enable row level security;

drop policy if exists "Public reads active home partners" on public.home_partners;
drop policy if exists "Anon reads active home partners" on public.home_partners;
drop policy if exists "Authenticated reads home partners" on public.home_partners;
drop policy if exists "Admins insert home partners" on public.home_partners;
drop policy if exists "Admins update home partners" on public.home_partners;
drop policy if exists "Admins delete home partners" on public.home_partners;

create policy "Anon reads active home partners"
on public.home_partners for select
to anon
using (is_active = true);

create policy "Authenticated reads home partners"
on public.home_partners for select
to authenticated
using (is_active = true or public.is_admin());

create policy "Admins insert home partners"
on public.home_partners for insert
to authenticated
with check (public.is_admin());

create policy "Admins update home partners"
on public.home_partners for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete home partners"
on public.home_partners for delete
to authenticated
using (public.is_admin());

create index if not exists home_partners_active_order_idx
on public.home_partners (is_active, sort_order, created_at);

grant select on public.home_partners to anon, authenticated;
grant insert, update, delete on public.home_partners to authenticated;

create or replace function public.touch_home_partners_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_home_partners_updated_at() from public, anon, authenticated;

drop trigger if exists home_partners_touch_updated_at on public.home_partners;
create trigger home_partners_touch_updated_at
before update on public.home_partners
for each row execute function public.touch_home_partners_updated_at();
