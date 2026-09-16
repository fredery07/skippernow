-- Approximate, privacy-conscious visitor origin from browser locale/time zone.
-- No GPS coordinates or IP addresses are collected or stored.

alter table public.page_views
  add column if not exists country_code text,
  add column if not exists browser_timezone text,
  add column if not exists browser_language text;

create index if not exists page_views_created_at_country_idx
  on public.page_views (created_at, country_code)
  where country_code is not null;

create index if not exists page_views_created_at_timezone_idx
  on public.page_views (created_at, browser_timezone)
  where browser_timezone is not null;

create or replace function public.record_page_visit_v2(
  p_visitor_id text,
  p_path text,
  p_referrer text default null,
  p_country_code text default null,
  p_timezone text default null,
  p_language text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_visitor_id text := trim(coalesce(p_visitor_id, ''));
  clean_path text := trim(coalesce(p_path, ''));
  clean_referrer text := nullif(trim(coalesce(p_referrer, '')), '');
  clean_country text := upper(nullif(trim(coalesce(p_country_code, '')), ''));
  clean_timezone text := nullif(trim(coalesce(p_timezone, '')), '');
  clean_language text := nullif(trim(coalesce(p_language, '')), '');
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
  if clean_country is not null and clean_country !~ '^[A-Z]{2}$' then
    clean_country := null;
  end if;
  if clean_timezone is not null and (length(clean_timezone) > 80 or clean_timezone !~ '^[A-Za-z0-9_+./-]+$') then
    clean_timezone := null;
  end if;
  if clean_language is not null and (length(clean_language) > 35 or clean_language !~ '^[A-Za-z0-9_-]+$') then
    clean_language := null;
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
    visitor_id, visit_date, path, referrer, created_at, last_seen_at,
    country_code, browser_timezone, browser_language
  ) values (
    clean_visitor_id, (now() at time zone 'Europe/Paris')::date,
    clean_path, clean_referrer, now(), now(),
    clean_country, clean_timezone, clean_language
  )
  on conflict (visitor_id, visit_date, path)
  do update set
    view_count = page_views.view_count + 1,
    last_seen_at = now(),
    referrer = coalesce(excluded.referrer, page_views.referrer),
    country_code = coalesce(excluded.country_code, page_views.country_code),
    browser_timezone = coalesce(excluded.browser_timezone, page_views.browser_timezone),
    browser_language = coalesce(excluded.browser_language, page_views.browser_language)
  where page_views.last_seen_at is null or page_views.last_seen_at <= now() - interval '2 seconds';
end;
$$;

revoke all on function public.record_page_visit_v2(text, text, text, text, text, text) from public;
grant execute on function public.record_page_visit_v2(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.get_traffic_stats()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  result jsonb;
  actual_requests_30d bigint;
  funnel jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select
      (select count(*) from public.missions where created_at >= now() - interval '30 days')
    + (select count(*) from public.provider_requests where created_at >= now() - interval '30 days')
    + (select count(*) from public.bookings where created_at >= now() - interval '30 days')
    + (select count(*) from public.boat_rental_requests where created_at >= now() - interval '30 days')
  into actual_requests_30d;

  select coalesce(jsonb_object_agg(event_name, event_count), '{}'::jsonb)
  from (
    select event_name, count(*) as event_count
    from public.booking_events
    where created_at >= now() - interval '30 days'
    group by event_name
  ) booking_funnel
  into funnel;

  funnel := coalesce(funnel, '{}'::jsonb)
            || jsonb_build_object('booking_created', actual_requests_30d);

  select jsonb_build_object(
    'visitors_today', (select count(distinct visitor_id) from public.page_views where visitor_id is not null and (created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date),
    'visitors_7d', (select count(distinct visitor_id) from public.page_views where visitor_id is not null and created_at >= now() - interval '7 days'),
    'visitors_30d', (select count(distinct visitor_id) from public.page_views where visitor_id is not null and created_at >= now() - interval '30 days'),
    'visitors_year', (select count(distinct visitor_id) from public.page_views where visitor_id is not null and created_at >= now() - interval '365 days'),
    'views_30d', (select coalesce(sum(view_count), 0) from public.page_views where created_at >= now() - interval '30 days'),
    'booking_events_30d', funnel,
    'actual_requests_30d', actual_requests_30d,
    'top_pages_30d', (
      select coalesce(jsonb_agg(row_to_json(top)), '[]'::jsonb)
      from (select path, sum(view_count) as views from public.page_views where created_at >= now() - interval '30 days' group by path order by sum(view_count) desc limit 20) top
    ),
    'top_countries_30d', (
      select coalesce(jsonb_agg(row_to_json(top)), '[]'::jsonb)
      from (
        select country_code, count(distinct visitor_id) as visitors, sum(view_count) as views
        from public.page_views
        where created_at >= now() - interval '30 days' and country_code is not null
        group by country_code order by count(distinct visitor_id) desc, sum(view_count) desc limit 20
      ) top
    ),
    'top_timezones_30d', (
      select coalesce(jsonb_agg(row_to_json(top)), '[]'::jsonb)
      from (
        select browser_timezone as timezone, count(distinct visitor_id) as visitors, sum(view_count) as views
        from public.page_views
        where created_at >= now() - interval '30 days' and browser_timezone is not null
        group by browser_timezone order by count(distinct visitor_id) desc, sum(view_count) desc limit 20
      ) top
    ),
    'tracking_since', (select min(created_at)::date from public.page_views where visitor_id is not null),
    'generated_at', now()
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_traffic_stats() from public;
grant execute on function public.get_traffic_stats() to authenticated;
