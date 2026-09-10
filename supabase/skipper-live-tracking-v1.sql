create table if not exists public.skipper_live_tracking (
  dispatch_id uuid primary key references public.boat_rental_skipper_dispatches(id) on delete cascade,
  rental_id uuid not null references public.boat_rental_requests(id) on delete cascade,
  skipper_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'en_route' check (status in ('en_route','arrived','stopped')),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  speed_mps double precision,
  heading_deg double precision,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create index if not exists skipper_live_tracking_rental_idx on public.skipper_live_tracking(rental_id);
create index if not exists skipper_live_tracking_skipper_idx on public.skipper_live_tracking(skipper_id);

alter table public.skipper_live_tracking enable row level security;
revoke all on table public.skipper_live_tracking from anon;
grant select, insert, update on table public.skipper_live_tracking to authenticated;

create policy "assigned skipper reads own tracking" on public.skipper_live_tracking
for select to authenticated using (
  auth.uid() = skipper_id and exists (
    select 1 from public.boat_rental_skipper_dispatches d
    where d.id = dispatch_id and d.assigned_skipper_id = auth.uid() and d.status = 'assigned'
  )
);

create policy "renter owner reads active tracking" on public.skipper_live_tracking
for select to authenticated using (
  expires_at > now() and exists (
    select 1 from public.boat_rental_requests r
    where r.id = rental_id and (r.renter_id = auth.uid() or r.owner_id = auth.uid())
  )
);

create policy "assigned skipper starts tracking" on public.skipper_live_tracking
for insert to authenticated with check (
  auth.uid() = skipper_id and exists (
    select 1 from public.boat_rental_skipper_dispatches d
    join public.boat_rental_requests r on r.id = d.rental_id
    where d.id = dispatch_id and d.rental_id = rental_id and d.assigned_skipper_id = auth.uid()
      and d.status = 'assigned' and r.status in ('confirmed','in_progress')
      and r.payment_status in ('paid','payout_ready','transferred')
  )
);

create policy "assigned skipper updates tracking" on public.skipper_live_tracking
for update to authenticated using (
  auth.uid() = skipper_id and exists (
    select 1 from public.boat_rental_skipper_dispatches d
    where d.id = dispatch_id and d.assigned_skipper_id = auth.uid() and d.status = 'assigned'
  )
) with check (auth.uid() = skipper_id and status in ('en_route','arrived','stopped'));

create or replace function public.guard_skipper_live_tracking_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.dispatch_id is distinct from old.dispatch_id
       or new.rental_id is distinct from old.rental_id
       or new.skipper_id is distinct from old.skipper_id then
      raise exception 'tracking identity is immutable';
    end if;
  end if;
  new.updated_at := now();
  if new.expires_at is null or new.expires_at > now() + interval '12 hours' then
    new.expires_at := now() + interval '12 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_skipper_live_tracking_identity on public.skipper_live_tracking;
create trigger trg_guard_skipper_live_tracking_identity
before insert or update on public.skipper_live_tracking
for each row execute function public.guard_skipper_live_tracking_identity();

revoke all on function public.guard_skipper_live_tracking_identity() from public, anon, authenticated;
