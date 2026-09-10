-- Skipper dispatch V1 for boat rentals. First eligible skipper to accept wins.

create table if not exists public.boat_rental_skipper_dispatches (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null unique references public.boat_rental_requests(id) on delete cascade,
  status text not null default 'searching' check (status in ('searching','assigned','cancelled','expired')),
  assigned_skipper_id uuid references public.profiles(id) on delete set null,
  dispatched_at timestamptz not null default now(),
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boat_rental_skipper_candidates (
  dispatch_id uuid not null references public.boat_rental_skipper_dispatches(id) on delete cascade,
  skipper_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'notified' check (status in ('notified','accepted','lost','declined')),
  notified_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (dispatch_id, skipper_id)
);

create index if not exists boat_rental_skipper_candidates_skipper_idx on public.boat_rental_skipper_candidates(skipper_id, notified_at desc);
create index if not exists boat_rental_skipper_dispatches_assigned_idx on public.boat_rental_skipper_dispatches(assigned_skipper_id) where assigned_skipper_id is not null;

alter table public.boat_rental_skipper_dispatches enable row level security;
alter table public.boat_rental_skipper_candidates enable row level security;

revoke all on public.boat_rental_skipper_dispatches from anon, authenticated;
revoke all on public.boat_rental_skipper_candidates from anon, authenticated;
grant select on public.boat_rental_skipper_dispatches to authenticated;
grant select on public.boat_rental_skipper_candidates to authenticated;

create policy "rental parties and assigned skipper read dispatch"
on public.boat_rental_skipper_dispatches for select to authenticated
using (
  assigned_skipper_id = (select auth.uid())
  or exists (
    select 1 from public.boat_rental_requests r
    where r.id = rental_id and ((select auth.uid()) = r.renter_id or (select auth.uid()) = r.owner_id)
  )
);

create policy "skippers read own dispatch candidate"
on public.boat_rental_skipper_candidates for select to authenticated
using (skipper_id = (select auth.uid()));

create policy "rental parties read dispatch candidates"
on public.boat_rental_skipper_candidates for select to authenticated
using (
  exists (
    select 1
    from public.boat_rental_skipper_dispatches d
    join public.boat_rental_requests r on r.id = d.rental_id
    where d.id = dispatch_id and ((select auth.uid()) = r.renter_id or (select auth.uid()) = r.owner_id)
  )
);
