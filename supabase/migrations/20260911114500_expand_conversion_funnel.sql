alter table public.booking_events drop constraint if exists booking_events_name_check;
alter table public.booking_events add constraint booking_events_name_check check (event_name in (
  'booking_opened','booking_login_required','booking_submitted','booking_created','booking_failed',
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
  clean_metadata jsonb := '{}'::jsonb;
begin
  if clean_visitor_id = ''
     or length(clean_visitor_id) < 8
     or length(clean_visitor_id) > 100
     or clean_visitor_id !~ '^[A-Za-z0-9-]+$' then
    return;
  end if;

  if clean_event_name not in (
    'booking_opened','booking_login_required','booking_submitted','booking_created','booking_failed',
    'cta_clicked','landing_cta_shown','signup_started'
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

revoke all on function public.record_booking_event(text, text, text, jsonb) from public;
grant execute on function public.record_booking_event(text, text, text, jsonb) to anon, authenticated;
