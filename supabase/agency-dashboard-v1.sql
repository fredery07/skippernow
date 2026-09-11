create table if not exists public.boat_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  block_type text not null default 'unavailable' check (block_type in ('unavailable','maintenance','private_use')),
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boat_availability_blocks_dates check (ends_at > starts_at)
);

create index if not exists boat_availability_blocks_owner_dates_idx on public.boat_availability_blocks(owner_id, starts_at, ends_at);
create index if not exists boat_availability_blocks_boat_dates_idx on public.boat_availability_blocks(boat_id, starts_at, ends_at);

alter table public.boat_availability_blocks enable row level security;

drop policy if exists "Owners manage own boat blocks" on public.boat_availability_blocks;
create policy "Owners manage own boat blocks"
on public.boat_availability_blocks
for all to authenticated
using (
  owner_id = auth.uid()
  and exists (select 1 from public.boats b where b.id = boat_id and b.client_id = auth.uid())
)
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.boats b where b.id = boat_id and b.client_id = auth.uid())
);

drop policy if exists "Admin manage boat blocks" on public.boat_availability_blocks;
create policy "Admin manage boat blocks"
on public.boat_availability_blocks
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.set_boat_block_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.owner_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_boat_block_owner on public.boat_availability_blocks;
create trigger trg_set_boat_block_owner
before insert or update on public.boat_availability_blocks
for each row execute function public.set_boat_block_owner();
