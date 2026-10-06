-- Boat sales marketplace schema
-- Applied to the SkipperNow Supabase project on 2026-10-06.

alter table public.boats
  add column if not exists listing_type text not null default 'rental',
  add column if not exists sale_price numeric,
  add column if not exists engine_hours numeric,
  add column if not exists sale_status text not null default 'available';

alter table public.boats
  drop constraint if exists boats_listing_type_check,
  add constraint boats_listing_type_check check (listing_type in ('rental','sale','both'));

alter table public.boats
  drop constraint if exists boats_sale_status_check,
  add constraint boats_sale_status_check check (sale_status in ('available','reserved','sold'));

create table if not exists public.boat_sale_inquiries (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  buyer_email text,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'new' check (status in ('new','read','closed')),
  created_at timestamptz not null default now()
);

alter table public.boat_sale_inquiries enable row level security;

grant select, insert, update on public.boat_sale_inquiries to authenticated;

drop policy if exists "Buyer and seller can view sale inquiries" on public.boat_sale_inquiries;
create policy "Buyer and seller can view sale inquiries"
on public.boat_sale_inquiries for select
to authenticated
using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id or is_admin());

drop policy if exists "Buyer can create sale inquiry" on public.boat_sale_inquiries;
create policy "Buyer can create sale inquiry"
on public.boat_sale_inquiries for insert
to authenticated
with check (
  (select auth.uid()) = buyer_id
  and buyer_id <> seller_id
  and exists (
    select 1 from public.boats b
    where b.id = boat_id
      and b.client_id = seller_id
      and b.listing_type in ('sale','both')
      and b.sale_status = 'available'
  )
);

drop policy if exists "Seller can update sale inquiry" on public.boat_sale_inquiries;
create policy "Seller can update sale inquiry"
on public.boat_sale_inquiries for update
to authenticated
using ((select auth.uid()) = seller_id or is_admin())
with check ((select auth.uid()) = seller_id or is_admin());

create index if not exists boat_sale_inquiries_seller_created_idx on public.boat_sale_inquiries (seller_id, created_at desc);
create index if not exists boat_sale_inquiries_boat_id_idx on public.boat_sale_inquiries (boat_id);
create index if not exists boat_sale_inquiries_buyer_id_idx on public.boat_sale_inquiries (buyer_id);
create index if not exists boats_listing_type_created_idx on public.boats (listing_type, created_at desc);
