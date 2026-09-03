-- SkipperNow - suivi mondial des visiteurs uniques
-- À exécuter une seule fois dans Supabase > SQL Editor.

alter table public.page_views
  add column if not exists visitor_id text,
  add column if not exists visit_date date not null default current_date,
  add column if not exists last_seen_at timestamptz not null default now();

create unique index if not exists page_views_visitor_day_path_key
  on public.page_views (visitor_id, visit_date, path);

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'page_views'
  loop
    execute format('drop policy %I on public.page_views', policy_row.policyname);
  end loop;
end $$;

alter table public.page_views enable row level security;

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
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 then
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
    left(trim(p_visitor_id), 100),
    current_date,
    left(coalesce(nullif(p_path, ''), '/'), 500),
    left(nullif(p_referrer, ''), 500),
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
