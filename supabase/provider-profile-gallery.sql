alter table public.profiles add column if not exists profile_gallery_urls text[] not null default '{}'::text[];

do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_gallery_limit') then
    alter table public.profiles add constraint profiles_gallery_limit check (coalesce(array_length(profile_gallery_urls,1),0) <= 8);
  end if;
end $$;
