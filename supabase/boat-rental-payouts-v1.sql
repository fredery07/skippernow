-- Boat rental payouts: reuse SkipperNow Stripe Connect accounts for boat owners.
-- Commission is calculated server-side from platform_settings.first_commission_percent.

alter table public.boat_rental_requests
  drop constraint if exists boat_rental_fee_valid;

alter table public.boat_rental_requests
  add constraint boat_rental_fee_valid
  check (platform_fee_cents >= 0 and platform_fee_cents < amount_cents);

create table if not exists public.boat_rental_payouts (
  request_id uuid primary key references public.boat_rental_requests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur',
  state text not null default 'pending' check (state in ('pending','processing','transferred','uncertain','held')),
  transfer_id text,
  initiated_by uuid references public.profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

alter table public.boat_rental_payouts enable row level security;
revoke all on public.boat_rental_payouts from anon, authenticated;

create or replace function public.prepare_boat_rental_request()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  b public.boats%rowtype;
  rental_days integer;
  commission numeric := 10;
begin
  if new.renter_id is distinct from auth.uid() then raise exception 'Invalid renter'; end if;
  select * into b from public.boats where id = new.boat_id;
  if not found then raise exception 'Boat not found'; end if;
  if b.client_id = new.renter_id then raise exception 'Cannot book your own boat'; end if;
  if new.ends_at <= new.starts_at then raise exception 'Invalid rental dates'; end if;
  if new.guest_count is not null and b.capacity is not null and new.guest_count > b.capacity then raise exception 'Guest count exceeds boat capacity'; end if;

  new.owner_id := b.client_id;
  new.currency := 'eur';
  new.status := 'pending';
  new.payment_status := 'unpaid';
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

  select coalesce(first_commission_percent, 10) into commission from public.platform_settings order by id limit 1;
  commission := greatest(0, least(50, commission));
  new.platform_fee_cents := greatest(1, round(new.amount_cents * commission / 100.0)::integer);
  if new.platform_fee_cents >= new.amount_cents then raise exception 'Invalid platform fee'; end if;
  return new;
end;
$$;

create or replace function public.claim_boat_rental_payout(p_request uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.boat_rental_requests%rowtype;
  a public.connect_accounts%rowtype;
  p public.boat_rental_payouts%rowtype;
  net integer;
begin
  select * into r from public.boat_rental_requests where id = p_request for update;
  if not found then raise exception 'Rental not found'; end if;
  if r.status <> 'completed' or r.payment_status not in ('paid','payout_ready') then raise exception 'Rental not ready for payout'; end if;
  if r.stripe_payment_intent_id is null then raise exception 'Payment missing'; end if;

  select * into a from public.connect_accounts where professional_id = r.owner_id and ready = true;
  if not found or a.account_id is null then raise exception 'Owner Stripe account not ready'; end if;

  net := r.amount_cents - r.platform_fee_cents;
  if net <= 0 then raise exception 'Invalid payout amount'; end if;

  insert into public.boat_rental_payouts(request_id,owner_id,destination,amount_cents,currency,state,initiated_by,started_at)
  values(r.id,r.owner_id,a.account_id,net,r.currency,'processing',p_actor,now())
  on conflict (request_id) do nothing;

  select * into p from public.boat_rental_payouts where request_id = r.id;
  if p.state = 'transferred' then return jsonb_build_object('claimed',false,'existing',true,'transfer_id',p.transfer_id); end if;
  if p.state <> 'processing' then raise exception 'Payout requires reconciliation'; end if;

  update public.boat_rental_requests set payment_status='payout_ready', updated_at=now() where id=r.id and payment_status='paid';
  return jsonb_build_object('claimed',true,'request_id',r.id,'payment_intent',r.stripe_payment_intent_id,'destination',p.destination,'amount_cents',p.amount_cents,'currency',p.currency,'total',r.amount_cents);
end;
$$;

create or replace function public.finish_boat_rental_payout(p_request uuid, p_transfer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.boat_rental_payouts set state='transferred',transfer_id=p_transfer,finished_at=now(),error=null where request_id=p_request and state='processing';
  if not found then raise exception 'Payout not claimable'; end if;
  update public.boat_rental_requests set payment_status='transferred',stripe_transfer_id=p_transfer,transferred_at=now(),updated_at=now() where id=p_request;
end;
$$;

revoke all on function public.claim_boat_rental_payout(uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_boat_rental_payout(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_boat_rental_payout(uuid,uuid) to service_role;
grant execute on function public.finish_boat_rental_payout(uuid,text) to service_role;
