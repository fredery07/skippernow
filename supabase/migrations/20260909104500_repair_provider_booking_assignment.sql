-- Repair provider missions created by the generic profile booking form before
-- that form preserved the selected professional's role.
UPDATE public.missions AS m
SET provider_id = m.skipper_id,
    skipper_id = NULL
WHERE m.provider_id IS NULL
  AND m.skipper_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = m.skipper_id
      AND p.role = 'provider'
  );
