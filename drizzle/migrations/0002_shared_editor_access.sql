-- Qualquer usuário autenticado passa a ser editor de todos os casos
CREATE OR REPLACE FUNCTION public.can_manage_patient(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = _patient_id)
$function$;

DROP POLICY IF EXISTS "patients update" ON public.patients;
CREATE POLICY "patients update" ON public.patients
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "patients delete" ON public.patients;
CREATE POLICY "patients delete" ON public.patients
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
