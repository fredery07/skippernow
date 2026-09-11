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
  if exists (
    select 1 from public.boat_rental_requests r
    where r.boat_id=new.boat_id
      and r.status in ('accepted','confirmed','in_progress')
      and r.starts_at < new.ends_at and r.ends_at > new.starts_at
      and (tg_op='INSERT' or r.id<>new.id)
  ) then raise exception 'Boat unavailable for these dates'; end if;
  if exists (
    select 1 from public.boat_availability_blocks x
    where x.boat_id=new.boat_id
      and x.starts_at < new.ends_at and x.ends_at > new.starts_at
  ) then raise exception 'Boat unavailable for these dates'; end if;

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

create or replace function public.validate_boat_availability_block()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.boat_rental_requests r
    where r.boat_id = new.boat_id
      and r.status in ('accepted','confirmed','in_progress')
      and r.starts_at < new.ends_at and r.ends_at > new.starts_at
  ) then
    raise exception 'Cannot block dates with an active reservation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_boat_availability_block on public.boat_availability_blocks;
create trigger trg_validate_boat_availability_block
before insert or update on public.boat_availability_blocks
for each row execute function public.validate_boat_availability_block();
