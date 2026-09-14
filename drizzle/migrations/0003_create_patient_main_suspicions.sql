CREATE TABLE public.patient_main_suspicions (
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES public.diagnosis_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (patient_id, diagnosis_id)
);

GRANT SELECT, INSERT, DELETE ON public.patient_main_suspicions TO authenticated;
GRANT ALL ON public.patient_main_suspicions TO service_role;

ALTER TABLE public.patient_main_suspicions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pms select" ON public.patient_main_suspicions FOR SELECT TO authenticated USING (true);
CREATE POLICY "pms insert" ON public.patient_main_suspicions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pms delete" ON public.patient_main_suspicions FOR DELETE TO authenticated USING (true);