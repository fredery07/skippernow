create table if not exists public.profile_bio_ai_usage(
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  count integer not null default 0 check(count between 0 and 5),
  primary key(user_id,usage_date)
);
alter table public.profile_bio_ai_usage enable row level security;
revoke all on public.profile_bio_ai_usage from anon,authenticated;
