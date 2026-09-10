create table if not exists public.boat_rental_skipper_payouts (
  request_id uuid primary key references public.boat_rental_requests(id) on delete cascade,
  skipper_id uuid not null references public.profiles(id),
  destination text not null,
  amount_cents integer not null check (amount_cents>0),
  currency text not null default 'eur',
  state text not null default 'processing' check (state in ('processing','transferred','uncertain','held')),
  transfer_id text,
  initiated_by uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);
alter table public.boat_rental_skipper_payouts enable row level security;
revoke all on public.boat_rental_skipper_payouts from anon,authenticated;

create or replace function public.claim_boat_rental_skipper_payout(p_request uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.boat_rental_requests%rowtype; d public.boat_rental_skipper_dispatches%rowtype; a public.connect_accounts%rowtype; p public.boat_rental_skipper_payouts%rowtype; inserted integer:=0;
begin
 select * into r from public.boat_rental_requests where id=p_request for update;
 if not found or r.status<>'completed' or r.payment_status not in ('paid','payout_ready','transferred') then raise exception 'Rental not ready for skipper payout'; end if;
 if coalesce(r.skipper_net_cents,0)<=0 or r.stripe_payment_intent_id is null then raise exception 'Skipper payment missing'; end if;
 select * into d from public.boat_rental_skipper_dispatches where rental_id=r.id and status='assigned';
 if not found or d.assigned_skipper_id is null then raise exception 'Assigned skipper missing'; end if;
 select * into a from public.connect_accounts where professional_id=d.assigned_skipper_id and ready=true;
 if not found or a.account_id is null then raise exception 'Skipper Stripe account not ready'; end if;
 insert into public.boat_rental_skipper_payouts(request_id,skipper_id,destination,amount_cents,currency,state,initiated_by)
 values(r.id,d.assigned_skipper_id,a.account_id,r.skipper_net_cents,r.currency,'processing',p_actor) on conflict(request_id) do nothing;
 get diagnostics inserted=row_count;
 select * into p from public.boat_rental_skipper_payouts where request_id=r.id;
 if inserted=0 then return jsonb_build_object('claimed',false,'existing',true,'state',p.state,'transfer_id',p.transfer_id); end if;
 update public.boat_rental_requests set payment_status='payout_ready',updated_at=now() where id=r.id and payment_status='paid';
 return jsonb_build_object('claimed',true,'request_id',r.id,'payment_intent',r.stripe_payment_intent_id,'destination',p.destination,'amount_cents',p.amount_cents,'currency',p.currency,'total',r.amount_cents);
end $$;
revoke execute on function public.claim_boat_rental_skipper_payout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_boat_rental_skipper_payout(uuid,uuid) to service_role;

create or replace function public.finish_boat_rental_payout(p_request uuid,p_transfer text)
returns void language plpgsql security definer set search_path=public as $$
declare needs_skipper boolean; skipper_done boolean;
begin
 update public.boat_rental_payouts set state='transferred',transfer_id=p_transfer,finished_at=now(),error=null where request_id=p_request and state='processing';
 if not found then raise exception 'Payout not claimable'; end if;
 select coalesce(skipper_net_cents,0)>0 into needs_skipper from public.boat_rental_requests where id=p_request;
 select exists(select 1 from public.boat_rental_skipper_payouts where request_id=p_request and state='transferred') into skipper_done;
 update public.boat_rental_requests set payment_status=case when not needs_skipper or skipper_done then 'transferred' else 'payout_ready' end,
   stripe_transfer_id=p_transfer,transferred_at=case when not needs_skipper or skipper_done then now() else transferred_at end,updated_at=now() where id=p_request;
end $$;
revoke execute on function public.finish_boat_rental_payout(uuid,text) from public,anon,authenticated;
grant execute on function public.finish_boat_rental_payout(uuid,text) to service_role;

create or replace function public.finish_boat_rental_skipper_payout(p_request uuid,p_transfer text)
returns void language plpgsql security definer set search_path=public as $$
declare owner_done boolean;
begin
 update public.boat_rental_skipper_payouts set state='transferred',transfer_id=p_transfer,finished_at=now(),error=null where request_id=p_request and state='processing';
 if not found then raise exception 'Skipper payout not claimable'; end if;
 select exists(select 1 from public.boat_rental_payouts where request_id=p_request and state='transferred') into owner_done;
 update public.boat_rental_requests set payment_status=case when owner_done then 'transferred' else 'payout_ready' end,
   transferred_at=case when owner_done then now() else transferred_at end,updated_at=now() where id=p_request;
end $$;
revoke execute on function public.finish_boat_rental_skipper_payout(uuid,text) from public,anon,authenticated;
grant execute on function public.finish_boat_rental_skipper_payout(uuid,text) to service_role;
