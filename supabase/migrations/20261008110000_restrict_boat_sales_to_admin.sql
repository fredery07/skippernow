-- Restrict boat sales to exceptional listings created and maintained by SkipperNow administrators.
-- Apply in the SkipperNow Supabase SQL editor / migration pipeline.
-- Existing non-admin sale listings are preserved for review; they cannot be edited
-- or re-published by owners after this trigger is applied.
create or replace function public.restrict_boat_sales_to_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_admin boolean;
begin
  v_is_admin := coalesce(public.is_admin(), false);

  if tg_op = 'INSERT' then
    if (new.listing_type in ('sale','both') or new.managed_by_platform)
       and not v_is_admin then
      raise exception 'Only SkipperNow administrators may publish boat sales';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.listing_type in ('sale','both')
        or new.managed_by_platform
        or old.listing_type in ('sale','both')
        or old.managed_by_platform)
       and not v_is_admin then
      raise exception 'Only SkipperNow administrators may manage boat sales';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists boats_admin_only_sales on public.boats;
create trigger boats_admin_only_sales
before insert or update on public.boats
for each row execute function public.restrict_boat_sales_to_admin();

revoke all on function public.restrict_boat_sales_to_admin() from public;
