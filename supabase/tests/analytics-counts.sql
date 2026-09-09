begin;
select public.record_page_visit('audit-repeat-20260909','/__audit_repeat');
update public.page_views set last_seen_at=now()-interval '3 seconds' where visitor_id='audit-repeat-20260909';
select public.record_page_visit('audit-repeat-20260909','/__audit_repeat');
select public.record_page_visit('audit-repeat-20260909','/__audit_repeat');
select public.record_booking_event('audit-repeat-20260909','booking_created','/');
create temporary table audit_mission (id uuid);
create trigger test_created after insert on audit_mission for each row execute function public.track_created_mission();
insert into audit_mission values ('00000000-0000-4000-8000-000000009909');
do $$
begin
 if (select view_count from public.page_views where visitor_id='audit-repeat-20260909') <> 2 then raise exception 'repeat/dedup failed'; end if;
 if exists(select 1 from booking_events where visitor_id='audit-repeat-20260909') then raise exception 'client spoof accepted'; end if;
 if (select count(*) from booking_events where visitor_id='mission-00000000-0000-4000-8000-000000009909' and metadata->>'source'='database')<>1 then raise exception 'server event missing'; end if;
 if has_function_privilege('anon','public.track_created_mission()','execute') then raise exception 'trigger exposed'; end if;
 begin
 perform set_config('request.jwt.claim.sub','',true);
 perform public.get_traffic_stats();
 raise exception 'stats exposed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;