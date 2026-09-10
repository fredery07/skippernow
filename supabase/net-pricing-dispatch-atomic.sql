-- Atomically assign the first skipper and lock in the customer-facing price.
create or replace function public.assign_boat_rental_skipper(
  p_dispatch uuid,
  p_skipper uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.boat_rental_skipper_dispatches%rowtype;
  c public.boat_rental_skipper_candidates%rowtype;
  r public.boat_rental_requests%rowtype;
  now_ts timestamptz := now();
  updated_rows integer := 0;
  owner_net integer;
  owner_fee integer;
begin
  select * into d from public.boat_rental_skipper_dispatches where id=p_dispatch for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if d.status <> 'searching' or d.assigned_skipper_id is not null then
    return jsonb_build_object('won', d.assigned_skipper_id=p_skipper, 'assigned_skipper_id', d.assigned_skipper_id);
  end if;

  select * into c from public.boat_rental_skipper_candidates
  where dispatch_id=p_dispatch and skipper_id=p_skipper and status='notified' for update;
  if not found then raise exception 'Candidate not eligible'; end if;
  if c.professional_net_cents is null or c.professional_net_cents <= 0 or c.customer_total_cents is null then
    raise exception 'Candidate price missing';
  end if;

  select * into r from public.boat_rental_requests where id=d.rental_id for update;
  if not found then raise exception 'Rental not found'; end if;
  if r.payment_status <> 'unpaid' then raise exception 'Rental payment already started'; end if;

  update public.boat_rental_skipper_dispatches
  set status='assigned', assigned_skipper_id=p_skipper, assigned_at=now_ts, updated_at=now_ts
  where id=p_dispatch and status='searching' and assigned_skipper_id is null;
  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    select * into d from public.boat_rental_skipper_dispatches where id=p_dispatch;
    return jsonb_build_object('won', d.assigned_skipper_id=p_skipper, 'assigned_skipper_id', d.assigned_skipper_id);
  end if;

  owner_net := coalesce(r.owner_net_cents, r.amount_cents-r.platform_fee_cents);
  owner_fee := coalesce(r.owner_platform_fee_cents, r.platform_fee_cents);
  update public.boat_rental_requests
  set skipper_net_cents=c.professional_net_cents,
      skipper_platform_fee_cents=c.platform_fee_cents,
      platform_fee_cents=owner_fee+c.platform_fee_cents,
      amount_cents=owner_net+owner_fee+c.customer_total_cents,
      updated_at=now_ts
  where id=r.id;

  update public.boat_rental_skipper_candidates
  set status='lost', responded_at=now_ts
  where dispatch_id=p_dispatch and skipper_id<>p_skipper and status='notified';
  update public.boat_rental_skipper_candidates
  set status='accepted', responded_at=now_ts
  where dispatch_id=p_dispatch and skipper_id=p_skipper;

  return jsonb_build_object(
    'won',true,
    'professional_net_cents',c.professional_net_cents,
    'platform_fee_cents',c.platform_fee_cents,
    'customer_total_cents',c.customer_total_cents,
    'rental_total_cents',owner_net+owner_fee+c.customer_total_cents
  );
end;
$$;
revoke execute on function public.assign_boat_rental_skipper(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assign_boat_rental_skipper(uuid,uuid) to service_role;
