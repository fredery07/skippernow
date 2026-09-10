-- Boat rental V1: additive schema. Existing skipper/service missions remain unchanged.
-- The browser may only submit user choices. owner_id and price are derived server-side.

create table if not exists public.boat_rental_requests (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_type text not null check (duration_type in ('half','day','multi')),
  guest_count integer,
  wants_skipper boolean not null default false,
  notes text,
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  currency text not null default 'eur',
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','confirmed','in_progress','completed')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','processing','paid','refund_requested','refunded','payout_ready','transferred')),
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  paid_at timestamptz,
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boat_rental_dates_valid check (ends_at > starts_at),
  constraint boat_rental_not_self check (renter_id <> owner_id),
  constraint boat_rental_guest_count_valid check (guest_count is null or guest_count > 0)
);

create index if not exists boat_rental_requests_renter_idx on public.boat_rental_requests(renter_id, created_at desc);
create index if not exists boat_rental_requests_owner_idx on public.boat_rental_requests(owner_id, created_at desc);
create index if not exists boat_rental_requests_boat_dates_idx on public.boat_rental_requests(boat_id, starts_at, ends_at);

create or replace function public.prepare_boat_rental_request()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  b public.boats%rowtype;
  rental_days integer;
begin
  if new.renter_id is distinct from auth.uid() then
    raise exception 'Invalid renter';
  end if;

  select * into b from public.boats where id = new.boat_id;
  if not found then raise exception 'Boat not found'; end if;
  if b.client_id = new.renter_id then raise exception 'Cannot book your own boat'; end if;
  if new.ends_at <= new.starts_at then raise exception 'Invalid rental dates'; end if;
  if new.guest_count is not null and b.capacity is not null and new.guest_count > b.capacity then
    raise exception 'Guest count exceeds boat capacity';
  end if;

  new.owner_id := b.client_id;
  new.currency := 'eur';
  new.status := 'pending';
  new.payment_status := 'unpaid';
  new.platform_fee_cents := 0;
  new.stripe_payment_intent_id := null;
  new.stripe_transfer_id := null;
  new.paid_at := null;
  new.transferred_at := null;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();

  if new.duration_type = 'half' then
    if coalesce(b.price_half_day, 0) <= 0 then raise exception 'Half-day price missing'; end if;
    new.amount_cents := round(b.price_half_day * 100)::integer;
  elsif new.duration_type = 'day' then
    if coalesce(b.price_per_day, 0) <= 0 then raise exception 'Daily price missing'; end if;
    new.amount_cents := round(b.price_per_day * 100)::integer;
  elsif new.duration_type = 'multi' then
    if coalesce(b.price_per_day, 0) <= 0 then raise exception 'Daily price missing'; end if;
    rental_days := greatest(2, ceil(extract(epoch from (new.ends_at - new.starts_at)) / 86400.0)::integer);
    new.amount_cents := round(b.price_per_day * 100 * rental_days)::integer;
  else
    raise exception 'Invalid duration';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prepare_boat_rental_request on public.boat_rental_requests;
create trigger trg_prepare_boat_rental_request
before insert on public.boat_rental_requests
for each row execute function public.prepare_boat_rental_request();

create or replace function public.guard_boat_rental_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' and exists (
    select 1 from public.boat_rental_requests r
    where r.boat_id = old.boat_id
      and r.id <> old.id
      and r.status in ('accepted','confirmed','in_progress')
      and r.starts_at < old.ends_at
      and r.ends_at > old.starts_at
  ) then
    raise exception 'Boat already booked for this period';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_boat_rental_status_change on public.boat_rental_requests;
create trigger trg_guard_boat_rental_status_change
before update of status on public.boat_rental_requests
for each row execute function public.guard_boat_rental_status_change();

alter table public.boat_rental_requests enable row level security;

drop policy if exists "boat rental participants can read" on public.boat_rental_requests;
create policy "boat rental participants can read"
on public.boat_rental_requests for select
to authenticated
using ((select auth.uid()) = renter_id or (select auth.uid()) = owner_id);

drop policy if exists "clients can create boat rental requests" on public.boat_rental_requests;
create policy "clients can create boat rental requests"
on public.boat_rental_requests for insert
to authenticated
with check ((select auth.uid()) = renter_id);

drop policy if exists "owners can accept or decline pending rental" on public.boat_rental_requests;
create policy "owners can accept or decline pending rental"
on public.boat_rental_requests for update
to authenticated
using ((select auth.uid()) = owner_id and status = 'pending' and payment_status = 'unpaid')
with check ((select auth.uid()) = owner_id and status in ('accepted','declined') and payment_status = 'unpaid');

drop policy if exists "renters can cancel unpaid rental" on public.boat_rental_requests;
create policy "renters can cancel unpaid rental"
on public.boat_rental_requests for update
to authenticated
using ((select auth.uid()) = renter_id and status in ('pending','accepted') and payment_status = 'unpaid')
with check ((select auth.uid()) = renter_id and status = 'cancelled' and payment_status = 'unpaid');

revoke all on public.boat_rental_requests from anon, authenticated;
grant select on public.boat_rental_requests to authenticated;
grant insert (boat_id, renter_id, starts_at, ends_at, duration_type, guest_count, wants_skipper, notes) on public.boat_rental_requests to authenticated;
grant update (status) on public.boat_rental_requests to authenticated;
