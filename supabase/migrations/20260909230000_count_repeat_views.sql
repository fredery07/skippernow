-- Historical counts are a lower bound: pre-migration repeat views cannot be recovered.
alter table public.page_views add column view_count bigint not null default 1 check (view_count >= 1);
CREATE OR REPLACE FUNCTION public.record_page_visit(p_visitor_id text, p_path text, p_referrer text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  clean_visitor_id text := trim(coalesce(p_visitor_id, ''));
  clean_path text := trim(coalesce(p_path, ''));
  clean_referrer text := nullif(trim(coalesce(p_referrer, '')), '');
  existing_last_seen timestamptz;
begin
  if clean_visitor_id = ''
     or length(clean_visitor_id) < 8
     or length(clean_visitor_id) > 100
     or clean_visitor_id !~ '^[A-Za-z0-9-]+$' then
    return;
  end if;

  if clean_path = '' or length(clean_path) > 500 or left(clean_path, 1) <> '/' then
    return;
  end if;

  if clean_referrer is not null and length(clean_referrer) > 500 then
    clean_referrer := left(clean_referrer, 500);
  end if;

  select last_seen_at into existing_last_seen
  from public.page_views
  where visitor_id = clean_visitor_id
    and visit_date = (now() at time zone 'Europe/Paris')::date
    and path = clean_path;

  if existing_last_seen is not null and now() - existing_last_seen < interval '2 seconds' then
    return;
  end if;

  insert into public.page_views (
    visitor_id,
    visit_date,
    path,
    referrer,
    created_at,
    last_seen_at
  ) values (
    clean_visitor_id,
    (now() at time zone 'Europe/Paris')::date,
    clean_path,
    clean_referrer,
    now(),
    now()
  )
  on conflict (visitor_id, visit_date, path)
  do update set
    view_count = page_views.view_count + 1,
    last_seen_at = now(),
    referrer = coalesce(excluded.referrer, page_views.referrer)
  where page_views.last_seen_at is null or page_views.last_seen_at <= now() - interval '2 seconds';
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_booking_event(p_visitor_id text, p_event_name text, p_path text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  clean_visitor_id text := trim(coalesce(p_visitor_id, ''));
  clean_event_name text := trim(coalesce(p_event_name, ''));
  clean_path text := trim(coalesce(p_path, ''));
  clean_metadata jsonb := '{}'::jsonb;
begin
  if clean_visitor_id = ''
     or length(clean_visitor_id) < 8
     or length(clean_visitor_id) > 100
     or clean_visitor_id !~ '^[A-Za-z0-9-]+$' then
    return;
  end if;

  if clean_event_name not in (
    'booking_opened', 'booking_login_required', 'booking_submitted',
    'booking_failed'
  ) then
    return;
  end if;

  if clean_path = '' or length(clean_path) > 500 or left(clean_path, 1) <> '/' then
    return;
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then
    clean_metadata := jsonb_strip_nulls(jsonb_build_object(
      'activity', left(coalesce(p_metadata->>'activity', ''), 50),
      'duration', left(coalesce(p_metadata->>'duration', ''), 20),
      'source', left(coalesce(p_metadata->>'source', ''), 30),
      'stage', left(coalesce(p_metadata->>'stage', ''), 30),
      'has_target', lower(coalesce(p_metadata->>'has_target', 'false')) = 'true',
      'has_photos', lower(coalesce(p_metadata->>'has_photos', 'false')) = 'true'
    ));
  end if;

  -- Serialize the existing per-visitor quota to cover concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended('booking-event:' || clean_visitor_id, 0));
  -- Garde-fou contre les robots ou appels abusifs depuis la clé publique.
  if (
    select count(*) from public.booking_events
    where visitor_id = clean_visitor_id
      and created_at >= now() - interval '1 day'
  ) >= 200 then
    return;
  end if;

  insert into public.booking_events(visitor_id, event_name, path, metadata)
  values (clean_visitor_id, clean_event_name, clean_path, clean_metadata);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_traffic_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result jsonb;
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'visitors_today', (
      select count(distinct visitor_id)
      from public.page_views
      where visitor_id is not null
        and (created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
    ),
    'visitors_7d', (
      select count(distinct visitor_id)
      from public.page_views
      where visitor_id is not null
        and created_at >= now() - interval '7 days'
    ),
    'visitors_30d', (
      select count(distinct visitor_id)
      from public.page_views
      where visitor_id is not null
        and created_at >= now() - interval '30 days'
    ),
    'visitors_year', (
      select count(distinct visitor_id)
      from public.page_views
      where visitor_id is not null
        and created_at >= now() - interval '365 days'
    ),
    'views_30d', (
      select coalesce(sum(view_count),0)
      from public.page_views
      where created_at >= now() - interval '30 days'
    ),
    'booking_events_30d', (
      select coalesce(jsonb_object_agg(event_name, event_count), '{}'::jsonb)
      from (
        select event_name, count(*) as event_count
        from public.booking_events
        where created_at >= now() - interval '30 days'
        group by event_name
      ) booking_funnel
    ),
    'top_pages_30d', (
      select coalesce(jsonb_agg(row_to_json(top)), '[]'::jsonb)
      from (
        select path, sum(view_count) as views
        from public.page_views
        where created_at >= now() - interval '30 days'
        group by path
        order by sum(view_count) desc
        limit 20
      ) top
    ),
    'tracking_since', (
      select min(created_at)::date
      from public.page_views
      where visitor_id is not null
    ),
    'generated_at', now()
  ) into result;

  return result;
end;
$function$;

-- Real conversions are recorded in the same transaction as the mission.
-- No browser role can call this trigger function as an RPC.
create or replace function public.track_created_mission()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
 insert into public.booking_events(visitor_id,event_name,path,metadata)
 values ('mission-' || new.id::text,'booking_created','/',jsonb_build_object('source','database'));
 return new;
end;
$$;
revoke all on function public.track_created_mission() from public,anon,authenticated;
create trigger mission_created_analytics after insert on public.missions
for each row execute function public.track_created_mission();
