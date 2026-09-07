-- SkipperNow - suivi mondial des visiteurs uniques
-- Migration autonome et réexécutable : peut être lancée plusieurs fois sans erreur
-- et sans perte de données. À exécuter dans Supabase > SQL Editor.

-- 1. Table -------------------------------------------------------------

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null,
  referrer text,
  created_at timestamptz not null default now(),
  visitor_id text,
  visit_date date not null default current_date,
  last_seen_at timestamptz not null default now()
);

alter table public.page_views
  add column if not exists visitor_id text,
  add column if not exists visit_date date not null default current_date,
  add column if not exists last_seen_at timestamptz not null default now();

-- 2. Index utiles --------------------------------------------------------

create unique index if not exists page_views_visitor_day_path_key
  on public.page_views (visitor_id, visit_date, path);

create index if not exists page_views_created_at_idx
  on public.page_views (created_at);

create index if not exists page_views_created_at_path_idx
  on public.page_views (created_at, path);

-- 3. RLS : ne toucher qu'aux policies connues de SkipperNow -------------

alter table public.page_views enable row level security;

drop policy if exists "page_views_admin_read" on public.page_views;

create policy "page_views_admin_read"
on public.page_views
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- 4. Écriture des visites : record_page_visit() --------------------------

create or replace function public.record_page_visit(
  p_visitor_id text,
  p_path text,
  p_referrer text default null
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
    and visit_date = current_date
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
    current_date,
    clean_path,
    clean_referrer,
    now(),
    now()
  )
  on conflict (visitor_id, visit_date, path)
  do update set
    last_seen_at = now(),
    referrer = coalesce(excluded.referrer, page_views.referrer);
end;
$$;

revoke all on public.page_views from anon;
revoke insert, update, delete on public.page_views from authenticated;
grant select on public.page_views to authenticated;

revoke all on function public.record_page_visit(text, text, text) from public;
grant execute on function public.record_page_visit(text, text, text) to anon, authenticated;

-- 5. Événements du tunnel de réservation -------------------------------

create table if not exists public.booking_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  event_name text not null,
  path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint booking_events_name_check check (event_name in (
    'booking_opened',
    'booking_login_required',
    'booking_submitted',
    'booking_created',
    'booking_failed'
  ))
);

create index if not exists booking_events_created_at_idx
  on public.booking_events (created_at);

create index if not exists booking_events_name_created_at_idx
  on public.booking_events (event_name, created_at);

alter table public.booking_events enable row level security;

drop policy if exists "booking_events_admin_read" on public.booking_events;
create policy "booking_events_admin_read"
on public.booking_events
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

create or replace function public.record_booking_event(
  p_visitor_id text,
  p_event_name text,
  p_path text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    'booking_created', 'booking_failed'
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
$$;

revoke all on public.booking_events from anon, authenticated;
grant select on public.booking_events to authenticated;
revoke all on function public.record_booking_event(text, text, text, jsonb) from public;
grant execute on function public.record_booking_event(text, text, text, jsonb) to anon, authenticated;

-- 6. Statistiques agrégées pour le dashboard admin : get_traffic_stats() --

create or replace function public.get_traffic_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      select count(*)
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
        select path, count(*) as views
        from public.page_views
        where created_at >= now() - interval '30 days'
        group by path
        order by count(*) desc
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
$$;

revoke all on function public.get_traffic_stats() from public;
grant execute on function public.get_traffic_stats() to authenticated;
