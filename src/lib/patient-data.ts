import { supabase } from "@/integrations/supabase/client";

export type AnalyticsPatient = {
  id: string;
  codigo_publicacao: string;
  paciente: string;
  tutor: string | null;
  especie: string | null;
  raca: string | null;
  sexo: string | null;
  idade_meses: number | null;
  status_diagnostico: string;
  desfecho: string | null;
  data_atendimento: string | null;
  data_desfecho: string | null;
  diagnostico_texto_livre: string | null;
  suspeitas_texto: string | null;
  neurolocalizacao_texto: string | null;
};

export type PatientRelation = {
  patient_id: string;
  region_id?: string;
  suspicion_id?: string;
  diagnosis_id?: string;
};

async function paginar<T>(
  consulta: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const resultado: T[] = [];
  const tamanho = 1000;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await consulta(inicio, inicio + tamanho - 1);
    if (error) throw error;
    const bloco = data ?? [];
    resultado.push(...bloco);
    if (bloco.length < tamanho) return resultado;
  }
}

export function buscarPacientesParaAnalise() {
  return paginar<AnalyticsPatient>((inicio, fim) =>
    supabase
      .from("patients")
      .select(
        "id, codigo_publicacao, paciente, tutor, especie, raca, sexo, idade_meses, status_diagnostico, desfecho, data_atendimento, data_desfecho, diagnostico_texto_livre, suspeitas_texto, neurolocalizacao_texto",
      )
      .order("codigo_publicacao")
      .range(inicio, fim),
  );
}

export function buscarRelacoesPaciente() {
  return Promise.all([
    paginar<PatientRelation>((inicio, fim) =>
      supabase.from("patient_regions").select("patient_id, region_id").range(inicio, fim),
    ),
    paginar<PatientRelation>((inicio, fim) =>
      supabase.from("patient_suspicions").select("patient_id, suspicion_id").range(inicio, fim),
    ),
    paginar<PatientRelation>((inicio, fim) =>
      supabase.from("patient_diagnoses").select("patient_id, diagnosis_id").range(inicio, fim),
    ),
  ]);
}

export function temTexto(valor: string | null | undefined) {
  return Boolean(valor?.trim());
}
