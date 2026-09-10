-- Prevent duplicate payout claims if two completion/transfer requests arrive together.
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
  inserted integer := 0;
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
  get diagnostics inserted = row_count;

  select * into p from public.boat_rental_payouts where request_id = r.id;
  if inserted = 0 then
    return jsonb_build_object('claimed',false,'existing',true,'state',p.state,'transfer_id',p.transfer_id);
  end if;

  update public.boat_rental_requests set payment_status='payout_ready', updated_at=now() where id=r.id and payment_status='paid';
  return jsonb_build_object('claimed',true,'request_id',r.id,'payment_intent',r.stripe_payment_intent_id,'destination',p.destination,'amount_cents',p.amount_cents,'currency',p.currency,'total',r.amount_cents);
end;
$$;

revoke all on function public.claim_boat_rental_payout(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_boat_rental_payout(uuid,uuid) to service_role;
