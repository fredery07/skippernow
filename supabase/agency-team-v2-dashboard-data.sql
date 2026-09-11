-- Role-filtered dashboard snapshot. Team members never receive columns outside their role through this RPC.
drop policy if exists "agency team reads rentals" on public.boat_rental_requests;
drop policy if exists "agency team reads blocks" on public.boat_availability_blocks;
drop policy if exists "agency teammates read basic profiles" on public.profiles;

create or replace function public.agency_dashboard_data() returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare u uuid:=auth.uid(); o uuid; r text; aid uuid; result jsonb;
begin
  select owner_id,id into o,aid from public.agency_accounts where owner_id=u limit 1;
  if found then r:='owner';
  else
    select a.owner_id,a.id,m.role::text into o,aid,r from public.agency_members m join public.agency_accounts a on a.id=m.agency_id where m.user_id=u and m.status='active' order by m.joined_at limit 1;
  end if;
  if o is null then return '{}'::jsonb; end if;
  result:=jsonb_build_object(
    'context',jsonb_build_object('agency_id',aid,'owner_id',o,'role',r),
    'boats',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'brand',b.brand,'model',b.model,'home_port',b.home_port,'photo_url',b.photo_url,'price_half_day',case when r in('owner','admin','finance') then b.price_half_day else null end,'price_per_day',case when r in('owner','admin','finance') then b.price_per_day else null end,'capacity',b.capacity,'verified',b.verified,'featured',b.featured) order by b.created_at) from public.boats b where b.client_id=o),'[]'::jsonb),
    'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'boat_id',x.boat_id,'starts_at',x.starts_at,'ends_at',x.ends_at,'block_type',x.block_type,'title',x.title,'notes',x.notes) order by x.starts_at) from public.boat_availability_blocks x where x.owner_id=o),'[]'::jsonb),
    'rentals',coalesce((select jsonb_agg(case
      when r in('owner','admin') then to_jsonb(q)-'stripe_payment_intent_id'-'stripe_transfer_id'
      when r='finance' then jsonb_build_object('id',q.id,'boat_id',q.boat_id,'starts_at',q.starts_at,'ends_at',q.ends_at,'status',q.status,'payment_status',q.payment_status,'amount_cents',q.amount_cents,'owner_net_cents',q.owner_net_cents,'owner_platform_fee_cents',q.owner_platform_fee_cents,'created_at',q.created_at)
      when r='reservations' then jsonb_build_object('id',q.id,'boat_id',q.boat_id,'renter_id',q.renter_id,'starts_at',q.starts_at,'ends_at',q.ends_at,'duration_type',q.duration_type,'guest_count',q.guest_count,'wants_skipper',q.wants_skipper,'status',q.status,'payment_status',q.payment_status,'amount_cents',q.amount_cents,'created_at',q.created_at)
      else jsonb_build_object('id',q.id,'boat_id',q.boat_id,'starts_at',q.starts_at,'ends_at',q.ends_at,'duration_type',q.duration_type,'guest_count',q.guest_count,'wants_skipper',q.wants_skipper,'status',q.status,'payment_status',q.payment_status,'created_at',q.created_at) end order by q.starts_at) from public.boat_rental_requests q where q.owner_id=o),'[]'::jsonb)
  );
  if r in('owner','admin') then result:=result||jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'status',m.status,'joined_at',m.joined_at,'full_name',p.full_name,'avatar_url',coalesce(p.profile_photo_url,p.avatar_url)) order by m.joined_at) from public.agency_members m left join public.profiles p on p.id=m.user_id where m.agency_id=aid),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'token',i.token,'email',i.email,'role',i.role,'status',i.status,'expires_at',i.expires_at,'created_at',i.created_at) order by i.created_at desc) from public.agency_invites i where i.agency_id=aid),'[]'::jsonb),
    'logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'actor_id',l.actor_id,'actor_name',p.full_name,'action',l.action,'entity_type',l.entity_type,'entity_id',l.entity_id,'metadata',l.metadata,'created_at',l.created_at) order by l.created_at desc) from (select * from public.agency_audit_logs where agency_id=aid order by created_at desc limit 100) l left join public.profiles p on p.id=l.actor_id),'[]'::jsonb)); end if;
  return result;
end $$;
revoke all on function public.agency_dashboard_data() from public,anon;
grant execute on function public.agency_dashboard_data() to authenticated;
