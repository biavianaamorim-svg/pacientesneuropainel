-- 1) Ownership default for patients
ALTER TABLE public.patients ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Helper: can the current user manage this patient?
CREATE OR REPLACE FUNCTION public.can_manage_patient(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = _patient_id
      AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;

REVOKE ALL ON FUNCTION public.can_manage_patient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_patient(uuid) TO authenticated;

-- 2) patients update scoped to owner or admin
DROP POLICY IF EXISTS "patients update" ON public.patients;
CREATE POLICY "patients update" ON public.patients
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3) exams scoped to patient owner or admin
DROP POLICY IF EXISTS "exams all" ON public.exams;
CREATE POLICY "exams select" ON public.exams
FOR SELECT TO authenticated
USING (public.can_manage_patient(patient_id));
CREATE POLICY "exams insert" ON public.exams
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_patient(patient_id));
CREATE POLICY "exams update" ON public.exams
FOR UPDATE TO authenticated
USING (public.can_manage_patient(patient_id))
WITH CHECK (public.can_manage_patient(patient_id));
CREATE POLICY "exams delete" ON public.exams
FOR DELETE TO authenticated
USING (public.can_manage_patient(patient_id));

-- 4) join tables scoped to patient owner or admin
DROP POLICY IF EXISTS "pr all" ON public.patient_regions;
CREATE POLICY "pr select" ON public.patient_regions FOR SELECT TO authenticated USING (public.can_manage_patient(patient_id));
CREATE POLICY "pr insert" ON public.patient_regions FOR INSERT TO authenticated WITH CHECK (public.can_manage_patient(patient_id));
CREATE POLICY "pr delete" ON public.patient_regions FOR DELETE TO authenticated USING (public.can_manage_patient(patient_id));

DROP POLICY IF EXISTS "ps all" ON public.patient_suspicions;
CREATE POLICY "ps select" ON public.patient_suspicions FOR SELECT TO authenticated USING (public.can_manage_patient(patient_id));
CREATE POLICY "ps insert" ON public.patient_suspicions FOR INSERT TO authenticated WITH CHECK (public.can_manage_patient(patient_id));
CREATE POLICY "ps delete" ON public.patient_suspicions FOR DELETE TO authenticated USING (public.can_manage_patient(patient_id));

DROP POLICY IF EXISTS "pd all" ON public.patient_diagnoses;
CREATE POLICY "pd select" ON public.patient_diagnoses FOR SELECT TO authenticated USING (public.can_manage_patient(patient_id));
CREATE POLICY "pd insert" ON public.patient_diagnoses FOR INSERT TO authenticated WITH CHECK (public.can_manage_patient(patient_id));
CREATE POLICY "pd delete" ON public.patient_diagnoses FOR DELETE TO authenticated USING (public.can_manage_patient(patient_id));

-- 5) profiles: own row or admin
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by owner or admin" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 6) user_roles: own row or admin
DROP POLICY IF EXISTS "roles readable by authenticated" ON public.user_roles;
CREATE POLICY "roles readable by owner or admin" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 7) function hardening: fixed search_path + least-privilege EXECUTE
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ begin new.updated_at = now(); return new; end; $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
