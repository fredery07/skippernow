-- Boat rental V1: additive schema, no changes to existing missions flow.
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
  amount_cents integer not null check (amount_cents >= 0),
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
  constraint boat_rental_not_self check (renter_id <> owner_id)
);

create index if not exists boat_rental_requests_renter_idx on public.boat_rental_requests(renter_id, created_at desc);
create index if not exists boat_rental_requests_owner_idx on public.boat_rental_requests(owner_id, created_at desc);
create index if not exists boat_rental_requests_boat_dates_idx on public.boat_rental_requests(boat_id, starts_at, ends_at);

alter table public.boat_rental_requests enable row level security;

drop policy if exists "boat rental participants can read" on public.boat_rental_requests;
create policy "boat rental participants can read"
on public.boat_rental_requests for select
to authenticated
using ((select auth.uid()) = renter_id or (select auth.uid()) = owner_id);

-- Writes go through the authenticated Edge Function so the browser can never choose owner_id,
-- price, status or payment fields by itself.
revoke insert, update, delete on public.boat_rental_requests from anon, authenticated;
grant select on public.boat_rental_requests to authenticated;
