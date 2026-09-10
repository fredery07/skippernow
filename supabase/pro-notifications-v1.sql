-- Professional push notifications hardening.
-- Existing browser code uses UPSERT on endpoint, so authenticated users need UPDATE on their own rows.

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions update" on public.push_subscriptions;
create policy "own push subscriptions update"
on public.push_subscriptions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);
