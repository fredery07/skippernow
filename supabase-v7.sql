-- SkipperNow V7 : tarifs bateau et sécurisation des droits
alter table public.boats add column if not exists price_half_day numeric(10,2) default 0;
alter table public.boats add column if not exists price_per_day numeric(10,2) default 0;

-- Important : vérifiez que RLS est activé sur profiles et boats.
alter table public.profiles enable row level security;
alter table public.boats enable row level security;

-- Un propriétaire peut modifier uniquement ses bateaux.
drop policy if exists "owners update own boats" on public.boats;
create policy "owners update own boats" on public.boats for update to authenticated
using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Lecture des bateaux pour les utilisateurs connectés.
drop policy if exists "authenticated read boats" on public.boats;
create policy "authenticated read boats" on public.boats for select to authenticated using (true);
