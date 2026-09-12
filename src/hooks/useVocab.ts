import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { VocabItem } from "@/components/ChipSelector";

export type VocabTable = "neuro_regions" | "suspicion_categories" | "diagnosis_categories";

export function useVocab(table: VocabTable) {
  return useQuery({
    queryKey: ["vocab", table],
    queryFn: async (): Promise<VocabItem[]> => {
      const { data, error } = await supabase.from(table).select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateVocab(table: VocabTable) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string): Promise<VocabItem> => {
      const { data, error } = await supabase
        .from(table)
        .insert({ nome })
        .select("id, nome")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocab", table] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAllVocab() {
  const regioes = useVocab("neuro_regions");
  const suspeitas = useVocab("suspicion_categories");
  const diagnosticos = useVocab("diagnosis_categories");
  return { regioes, suspeitas, diagnosticos };
}
