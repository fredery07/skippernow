create table if not exists public.boat_rental_requests (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  rental_date date not null,
  duration text not null check (duration in ('half','day')),
  amount_cents integer not null default 0,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','refused','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table public.boat_rental_requests enable row level security;

drop policy if exists "rental requests select participants" on public.boat_rental_requests;
create policy "rental requests select participants" on public.boat_rental_requests
for select to authenticated using (auth.uid() = requester_id or auth.uid() = owner_id);

drop policy if exists "rental requests create requester" on public.boat_rental_requests;
create policy "rental requests create requester" on public.boat_rental_requests
for insert to authenticated with check (auth.uid() = requester_id and requester_id <> owner_id);

drop policy if exists "rental requests owner update" on public.boat_rental_requests;
create policy "rental requests owner update" on public.boat_rental_requests
for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists boat_rental_requests_owner_idx on public.boat_rental_requests(owner_id, created_at desc);
create index if not exists boat_rental_requests_requester_idx on public.boat_rental_requests(requester_id, created_at desc);

alter publication supabase_realtime add table public.boat_rental_requests;
