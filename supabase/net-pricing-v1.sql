-- Net pricing V1: professionals set what they want to receive; SkipperNow adds the customer-facing fee.

alter table public.missions
  add column if not exists professional_net_cents integer,
  add constraint missions_professional_net_positive check (professional_net_cents is null or professional_net_cents > 0);

alter table public.provider_quotes
  add column if not exists professional_net_cents integer,
  add column if not exists platform_fee_cents integer not null default 0,
  add constraint provider_quotes_professional_net_positive check (professional_net_cents is null or professional_net_cents > 0),
  add constraint provider_quotes_platform_fee_nonnegative check (platform_fee_cents >= 0);

alter table public.boat_rental_requests
  add column if not exists owner_net_cents integer,
  add column if not exists owner_platform_fee_cents integer not null default 0,
  add column if not exists skipper_net_cents integer,
  add column if not exists skipper_platform_fee_cents integer not null default 0,
  add constraint boat_rental_owner_net_positive check (owner_net_cents is null or owner_net_cents > 0),
  add constraint boat_rental_skipper_net_positive check (skipper_net_cents is null or skipper_net_cents > 0),
  add constraint boat_rental_owner_fee_nonnegative check (owner_platform_fee_cents >= 0),
  add constraint boat_rental_skipper_fee_nonnegative check (skipper_platform_fee_cents >= 0);

alter table public.boat_rental_skipper_candidates
  add column if not exists professional_net_cents integer,
  add column if not exists platform_fee_cents integer not null default 0,
  add column if not exists customer_total_cents integer,
  add constraint boat_dispatch_candidate_net_positive check (professional_net_cents is null or professional_net_cents > 0),
  add constraint boat_dispatch_candidate_fee_nonnegative check (platform_fee_cents >= 0),
  add constraint boat_dispatch_candidate_total_positive check (customer_total_cents is null or customer_total_cents > 0);

-- Preserve historical economics: old rows keep the amount actually charged and infer what the pro received.
update public.missions
set professional_net_cents = greatest(1, coalesce(amount_cents,0) - coalesce(platform_fee_cents,0))
where professional_net_cents is null and coalesce(amount_cents,0) > 0;

update public.boat_rental_requests
set owner_net_cents = greatest(1, coalesce(amount_cents,0) - coalesce(platform_fee_cents,0)),
    owner_platform_fee_cents = coalesce(platform_fee_cents,0)
where owner_net_cents is null and coalesce(amount_cents,0) > 0;

-- For provider quotes, the entered amount is now treated as the provider's desired net.
create or replace function public.apply_provider_quote_net_pricing()
returns trigger
language plpgsql
set search_path = public
as $$
declare commission numeric := 10; desired_net integer;
begin
  if new.provider_id = auth.uid() and (tg_op = 'INSERT' or new.amount_cents is distinct from old.amount_cents) then
    desired_net := new.amount_cents;
    if desired_net is null or desired_net <= 0 then raise exception 'Invalid professional net amount'; end if;
    select coalesce(first_commission_percent,10) into commission from public.platform_settings order by id limit 1;
    commission := greatest(0, least(50, commission));
    new.professional_net_cents := desired_net;
    new.platform_fee_cents := round(desired_net * commission / 100.0)::integer;
    new.amount_cents := desired_net + new.platform_fee_cents;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_provider_quote_net_pricing on public.provider_quotes;
create trigger apply_provider_quote_net_pricing
before insert or update of amount_cents on public.provider_quotes
for each row execute function public.apply_provider_quote_net_pricing();

-- Existing mission quote UI writes amount_cents directly. When the assigned pro changes it,
-- interpret that input as net and convert it server-side to the customer total.
create or replace function public.apply_mission_net_pricing()
returns trigger
language plpgsql
set search_path = public
as $$
declare commission numeric := 10; desired_net integer; actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE'
     and new.amount_cents is distinct from old.amount_cents
     and actor is not null
     and (new.provider_id = actor or new.skipper_id = actor)
     and old.status in ('pending','searching','quoted') then
    desired_net := new.amount_cents;
    if desired_net is null or desired_net <= 0 then raise exception 'Invalid professional net amount'; end if;
    select coalesce(first_commission_percent,10) into commission from public.platform_settings order by id limit 1;
    commission := greatest(0, least(50, commission));
    new.professional_net_cents := desired_net;
    new.platform_fee_cents := round(desired_net * commission / 100.0)::integer;
    new.amount_cents := desired_net + new.platform_fee_cents;
  end if;
  return new;
end;
$$;

drop trigger if exists a_apply_mission_net_pricing on public.missions;
create trigger a_apply_mission_net_pricing
before update of amount_cents on public.missions
for each row execute function public.apply_mission_net_pricing();

-- Boat listing prices are owner net prices. Customer total = owner net + SkipperNow fee.
create or replace function public.prepare_boat_rental_request()
returns trigger
language plpgsql
set search_path = public
as $$
declare b public.boats%rowtype; rental_days integer; commission numeric := 10; owner_net integer;
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
  new.skipper_net_cents := null;
  new.skipper_platform_fee_cents := 0;

  if new.duration_type = 'half' then
    if coalesce(b.price_half_day,0) <= 0 then raise exception 'Half-day price missing'; end if;
    owner_net := round(b.price_half_day * 100)::integer;
  elsif new.duration_type = 'day' then
    if coalesce(b.price_per_day,0) <= 0 then raise exception 'Daily price missing'; end if;
    owner_net := round(b.price_per_day * 100)::integer;
  elsif new.duration_type = 'multi' then
    if coalesce(b.price_per_day,0) <= 0 then raise exception 'Daily price missing'; end if;
    rental_days := greatest(2, ceil(extract(epoch from (new.ends_at - new.starts_at)) / 86400.0)::integer);
    owner_net := round(b.price_per_day * 100 * rental_days)::integer;
  else raise exception 'Invalid duration'; end if;

  select coalesce(first_commission_percent,10) into commission from public.platform_settings order by id limit 1;
  commission := greatest(0, least(50, commission));
  new.owner_net_cents := owner_net;
  new.owner_platform_fee_cents := round(owner_net * commission / 100.0)::integer;
  new.platform_fee_cents := new.owner_platform_fee_cents;
  new.amount_cents := owner_net + new.owner_platform_fee_cents;
  return new;
end;
$$;

-- Owner payout must only pay the owner's net, especially when a skipper is bundled in the same charge.
create or replace function public.claim_boat_rental_payout(p_request uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.boat_rental_requests%rowtype; a public.connect_accounts%rowtype; p public.boat_rental_payouts%rowtype; net integer; inserted integer := 0;
begin
  select * into r from public.boat_rental_requests where id = p_request for update;
  if not found then raise exception 'Rental not found'; end if;
  if r.status <> 'completed' or r.payment_status not in ('paid','payout_ready') then raise exception 'Rental not ready for payout'; end if;
  if r.stripe_payment_intent_id is null then raise exception 'Payment missing'; end if;
  select * into a from public.connect_accounts where professional_id = r.owner_id and ready = true;
  if not found or a.account_id is null then raise exception 'Owner Stripe account not ready'; end if;
  net := coalesce(r.owner_net_cents, r.amount_cents - r.platform_fee_cents);
  if net <= 0 then raise exception 'Invalid payout amount'; end if;
  insert into public.boat_rental_payouts(request_id,owner_id,destination,amount_cents,currency,state,initiated_by,started_at)
  values(r.id,r.owner_id,a.account_id,net,r.currency,'processing',p_actor,now()) on conflict (request_id) do nothing;
  get diagnostics inserted = row_count;
  select * into p from public.boat_rental_payouts where request_id = r.id;
  if inserted = 0 then return jsonb_build_object('claimed',false,'existing',true,'state',p.state,'transfer_id',p.transfer_id); end if;
  update public.boat_rental_requests set payment_status='payout_ready', updated_at=now() where id=r.id and payment_status='paid';
  return jsonb_build_object('claimed',true,'request_id',r.id,'payment_intent',r.stripe_payment_intent_id,'destination',p.destination,'amount_cents',p.amount_cents,'currency',p.currency,'total',r.amount_cents);
end;
$$;
revoke execute on function public.claim_boat_rental_payout(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_boat_rental_payout(uuid,uuid) to service_role;
