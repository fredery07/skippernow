-- Detailed booking-form sessions for the admin dashboard.
-- Keeps public writes behind the existing RPC and exposes rows only through
-- the existing admin-only RLS policy on booking_events.

alter table public.booking_events
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists form_session_id text;

create index if not exists booking_events_form_session_created_idx
  on public.booking_events (form_session_id, created_at desc);

create index if not exists booking_events_profile_created_idx
  on public.booking_events (profile_id, created_at desc);

create index if not exists booking_events_visitor_created_idx
  on public.booking_events (visitor_id, created_at desc);

alter table public.booking_events drop constraint if exists booking_events_name_check;
alter table public.booking_events add constraint booking_events_name_check check (event_name in (
  'booking_opened','booking_progress','booking_abandoned','booking_login_required',
  'booking_submitted','booking_created','booking_failed',
  'cta_clicked','landing_cta_shown','signup_started'
));

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
  incoming jsonb := case when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then p_metadata else '{}'::jsonb end;
  clean_metadata jsonb := '{}'::jsonb;
  clean_session_id text := left(trim(coalesce(p_metadata->>'session_id', '')), 100);
begin
  if clean_visitor_id = ''
     or length(clean_visitor_id) < 8
     or length(clean_visitor_id) > 100
     or clean_visitor_id !~ '^[A-Za-z0-9-]+$' then
    return;
  end if;

  if clean_event_name not in (
    'booking_opened','booking_progress','booking_abandoned','booking_login_required',
    'booking_submitted','booking_created','booking_failed',
    'cta_clicked','landing_cta_shown','signup_started'
  ) then
    return;
  end if;

  if clean_path = '' or length(clean_path) > 500 or left(clean_path, 1) <> '/' then
    return;
  end if;

  if clean_session_id <> '' and clean_session_id !~ '^[A-Za-z0-9-]+$' then
    clean_session_id := '';
  end if;

  clean_metadata := jsonb_strip_nulls(jsonb_build_object(
    'session_id', nullif(clean_session_id, ''),
    'activity', left(coalesce(incoming->>'activity', ''), 50),
    'subcategory', left(coalesce(incoming->>'subcategory', ''), 80),
    'source', left(coalesce(incoming->>'source', ''), 30),
    'stage', left(coalesce(incoming->>'stage', ''), 50),
    'port', left(coalesce(incoming->>'port', ''), 160),
    'date', left(coalesce(incoming->>'date', ''), 20),
    'duration', left(coalesce(incoming->>'duration', ''), 20),
    'days', left(coalesce(incoming->>'days', ''), 10),
    'boat_type', left(coalesce(incoming->>'boat_type', ''), 160),
    'details', left(coalesce(incoming->>'details', ''), 1200),
    'target_id', left(coalesce(incoming->>'target_id', ''), 80),
    'target_name', left(coalesce(incoming->>'target_name', ''), 160),
    'mission_id', left(coalesce(incoming->>'mission_id', ''), 80),
    'has_target', lower(coalesce(incoming->>'has_target', 'false')) = 'true',
    'has_photos', lower(coalesce(incoming->>'has_photos', 'false')) = 'true',
    'photo_count', case
      when coalesce(incoming->>'photo_count','') ~ '^[0-9]+$'
        then greatest(0, least(4, left(incoming->>'photo_count', 3)::integer))
      else 0
    end
  ));

  -- Prevent noisy progress events generated with no usable session.
  if clean_event_name in ('booking_progress','booking_abandoned') and clean_session_id = '' then
    return;
  end if;

  if (
    select count(*) from public.booking_events
    where visitor_id = clean_visitor_id
      and created_at >= now() - interval '1 day'
  ) >= 300 then
    return;
  end if;

  insert into public.booking_events(
    visitor_id, profile_id, form_session_id, event_name, path, metadata
  ) values (
    clean_visitor_id,
    case when exists(select 1 from public.profiles where id = (select auth.uid())) then (select auth.uid()) else null end,
    nullif(clean_session_id, ''), clean_event_name, clean_path, clean_metadata
  );
end;
$$;

revoke all on function public.record_booking_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_booking_event(text, text, text, jsonb) to anon, authenticated;
