-- Admin-managed boat sales
-- Allows the SkipperNow team to publish a sale listing on behalf of an owner
-- who does not need to create or manage a SkipperNow account.

alter table public.boats
  add column if not exists managed_by_platform boolean not null default false;

create table if not exists public.boat_managed_owners (
  boat_id uuid primary key references public.boats(id) on delete cascade,
  owner_name text not null,
  owner_phone text,
  owner_email text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boat_managed_owners enable row level security;

revoke all on public.boat_managed_owners from anon;
revoke all on public.boat_managed_owners from authenticated;
grant select, insert, update, delete on public.boat_managed_owners to authenticated;

drop policy if exists "Admins manage managed boat owners" on public.boat_managed_owners;
create policy "Admins manage managed boat owners"
on public.boat_managed_owners
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.admin_create_managed_boat(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin uuid := auth.uid();
  v_boat_id uuid;
  v_photo_urls jsonb := '[]'::jsonb;
  v_sale_price numeric;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if coalesce(trim(p_payload->>'owner_name'),'') = '' then
    raise exception 'Owner name required';
  end if;
  if coalesce(trim(p_payload->>'name'),'') = '' then
    raise exception 'Boat name required';
  end if;
  if coalesce(trim(p_payload->>'home_port'),'') = '' then
    raise exception 'Boat location required';
  end if;

  v_sale_price := nullif(p_payload->>'sale_price','')::numeric;
  if coalesce(v_sale_price,0) <= 0 then
    raise exception 'Sale price required';
  end if;

  if jsonb_typeof(p_payload->'photo_urls') = 'array' then
    v_photo_urls := p_payload->'photo_urls';
  end if;

  insert into public.boats (
    client_id,
    name,
    brand,
    model,
    boat_type,
    home_port,
    year_built,
    length_m,
    sale_price,
    engine_hours,
    description,
    photo_url,
    photo_urls,
    listing_type,
    sale_status,
    managed_by_platform
  ) values (
    v_admin,
    trim(p_payload->>'name'),
    nullif(trim(p_payload->>'brand'),''),
    nullif(trim(p_payload->>'model'),''),
    coalesce(nullif(trim(p_payload->>'boat_type'),''),'motorboat'),
    trim(p_payload->>'home_port'),
    nullif(p_payload->>'year_built','')::integer,
    nullif(p_payload->>'length_m','')::numeric,
    v_sale_price,
    nullif(p_payload->>'engine_hours','')::numeric,
    nullif(trim(p_payload->>'description'),''),
    case when jsonb_array_length(v_photo_urls) > 0 then v_photo_urls->>0 else null end,
    v_photo_urls,
    'sale',
    'available',
    true
  )
  returning id into v_boat_id;

  insert into public.boat_managed_owners (
    boat_id,
    owner_name,
    owner_phone,
    owner_email,
    notes,
    created_by
  ) values (
    v_boat_id,
    trim(p_payload->>'owner_name'),
    nullif(trim(p_payload->>'owner_phone'),''),
    nullif(trim(p_payload->>'owner_email'),''),
    nullif(trim(p_payload->>'owner_notes'),''),
    v_admin
  );

  return v_boat_id;
end;
$$;

revoke all on function public.admin_create_managed_boat(jsonb) from public;
revoke execute on function public.admin_create_managed_boat(jsonb) from anon;
grant execute on function public.admin_create_managed_boat(jsonb) to authenticated;

create index if not exists boat_managed_owners_created_by_idx
  on public.boat_managed_owners (created_by);

create index if not exists boats_managed_by_platform_idx
  on public.boats (managed_by_platform)
  where managed_by_platform = true;
