-- Keep admin-only predicates out of anonymous public catalog reads.
ALTER POLICY "Admin manages port activities" ON public.port_activities TO authenticated;
ALTER POLICY "Admin manages destination tiles" ON public.destination_tiles TO authenticated;
