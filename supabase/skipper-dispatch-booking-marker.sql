create or replace function public.extract_skipper_request_marker()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.notes,'') like '%[[SKIPPER_REQUESTED]]%' then
    new.wants_skipper := true;
    new.notes := nullif(trim(replace(new.notes,'[[SKIPPER_REQUESTED]]','')), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aa_extract_skipper_request on public.boat_rental_requests;
create trigger trg_aa_extract_skipper_request
before insert on public.boat_rental_requests
for each row execute function public.extract_skipper_request_marker();
