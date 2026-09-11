-- Prevent public API callers from invoking this SECURITY DEFINER helper directly.
-- The function remains available to server-side service_role use.
revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;
grant execute on function public.sync_profile_email_from_auth() to service_role;
