-- Keep public professional discovery independent from the administrator check.
-- The previous public policy evaluated is_admin() for anonymous visitors and
-- raised "permission denied for function is_admin" before returning profiles.
DROP POLICY IF EXISTS "Profiles visible to owner self or public" ON public.profiles;

CREATE POLICY "Anonymous reads verified profiles"
ON public.profiles FOR SELECT TO anon
USING (verified = true AND suspended = false);

CREATE POLICY "Authenticated reads visible profiles"
ON public.profiles FOR SELECT TO authenticated
USING (verified = true OR id = (SELECT auth.uid()) OR public.is_admin());

-- This real request was created while providers were stored in skipper_id.
-- Move it to the dedicated provider column without changing its quote or status.
UPDATE public.missions
SET provider_id = skipper_id,
    skipper_id = NULL
WHERE id = '5512b09c-d2e7-4f49-9dfb-66df5f4f67e8'::uuid
  AND skipper_id = 'e1222c09-757b-49ac-bc8e-bfbada0800a7'::uuid
  AND provider_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = missions.skipper_id AND p.role = 'provider'
  );
