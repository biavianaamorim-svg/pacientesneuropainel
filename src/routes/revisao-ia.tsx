import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAllVocab, useCreateVocab } from "@/hooks/useVocab";
import { useAuth } from "@/hooks/useAuth";
import { sugerirChips } from "@/lib/ai-import.functions";
import { classificarCaso } from "@/lib/regras";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revisao-ia")({
  head: () => ({
    meta: [
      { title: "Revisão assistida por IA — NeuroVet Casos" },
      {
        name: "description",
        content: "Revise em lote as sugestões de região, suspeita e diagnóstico antes de salvar.",
      },
      { property: "og:title", content: "Revisão assistida por IA — NeuroVet Casos" },
      {
        property: "og:description",
        content: "Revise em lote as sugestões de chips antes de salvar nos casos.",
      },
    ],
  }),
  component: RevisaoIA,
});

type Sugestao = {
  id: string;
  regioes: string[];
  suspeitas: string[];
  diagnosticos: string[];
  novas_regioes: string[];
  novas_suspeitas: string[];
  novos_diagnosticos: string[];
};

type Selecao = Record<string, { regioes: string[]; suspeitas: string[]; diagnosticos: string[] }>;

function RevisaoIA() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { regioes, suspeitas, diagnosticos } = useAllVocab();
  const criarRegiao = useCreateVocab("neuro_regions");
  const criarSuspeita = useCreateVocab("suspicion_categories");
  const criarDiagnostico = useCreateVocab("diagnosis_categories");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [sel, setSel] = useState<Selecao>({});
  const [rodando, setRodando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const pendentes = useQuery({
    queryKey: ["pendentes-ia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, codigo_publicacao, paciente, neurolocalizacao_texto, suspeitas_texto, diagnostico_importado_texto",
        )
        .or(
          "neurolocalizacao_texto.not.is.null,suspeitas_texto.not.is.null,diagnostico_importado_texto.not.is.null",
        )
        .order("codigo_publicacao")
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  function reconhecerPorRegras() {
    const linhas = pendentes.data ?? [];
    if (!linhas.length) {
      toast.info("Nenhum texto pendente para reconhecer.");
      return;
    }
    const s: Sugestao[] = linhas.map((p) => {
      const c = classificarCaso({
        neuro: p.neurolocalizacao_texto,
        suspeitas: p.suspeitas_texto,
        diagnostico: p.diagnostico_importado_texto,
      });
      return {
        id: p.id,
        regioes: c.regioes,
        suspeitas: c.suspeitas,
        diagnosticos: c.diagnosticos,
        novas_regioes: [],
        novas_suspeitas: [],
        novos_diagnosticos: [],
      };
    });
    const comResultado = s.filter(
      (x) => x.regioes.length || x.suspeitas.length || x.diagnosticos.length,
    );
    setSugestoes(comResultado);
    const inicial: Selecao = {};
    comResultado.forEach((x) => {
      inicial[x.id] = {
        regioes: x.regioes,
        suspeitas: x.suspeitas,
        diagnosticos: x.diagnosticos,
      };
    });
    setSel(inicial);
    toast.success(`${comResultado.length} casos reconhecidos pelas regras.`);
  }

  async function analisar() {
    const linhas = (pendentes.data ?? []).map((p) => ({
      id: p.id,
      paciente: p.paciente,
      neuro: p.neurolocalizacao_texto ?? "",
      suspeitas: p.suspeitas_texto ?? "",
      diagnostico: p.diagnostico_importado_texto ?? "",
    }));
    if (!linhas.length) {
      toast.info("Nenhum texto pendente para analisar.");
      return;
    }
    setRodando(true);
    try {
      const res = await sugerirChips({
        data: {
          linhas,
          vocab: {
            regioes: (regioes.data ?? []).map((r) => r.nome),
            suspeitas: (suspeitas.data ?? []).map((r) => r.nome),
            diagnosticos: (diagnosticos.data ?? []).map((r) => r.nome),
          },
        },
      });
      const s = (res.sugestoes ?? []) as Sugestao[];
      setSugestoes(s);
      const inicial: Selecao = {};
      s.forEach((x) => {
        inicial[x.id] = {
          regioes: [...(x.regioes ?? []), ...(x.novas_regioes ?? [])],
          suspeitas: [...(x.suspeitas ?? []), ...(x.novas_suspeitas ?? [])],
          diagnosticos: [...(x.diagnosticos ?? []), ...(x.novos_diagnosticos ?? [])],
        };
      });
      setSel(inicial);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRodando(false);
    }
  }

  function alternar(
    pid: string,
    campo: "regioes" | "suspeitas" | "diagnosticos",
    nome: string,
  ) {
    setSel((prev) => {
      const atual = prev[pid] ?? { regioes: [], suspeitas: [], diagnosticos: [] };
      const lista = atual[campo];
      return {
        ...prev,
        [pid]: {
          ...atual,
          [campo]: lista.includes(nome) ? lista.filter((n) => n !== nome) : [...lista, nome],
        },
      };
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const idPorNome = (lista: { id: string; nome: string }[]) =>
        new Map(lista.map((v) => [v.nome.toLowerCase(), v.id]));
      const mapas = {
        regioes: idPorNome(regioes.data ?? []),
        suspeitas: idPorNome(suspeitas.data ?? []),
        diagnosticos: idPorNome(diagnosticos.data ?? []),
      };
      const criadores = {
        regioes: criarRegiao,
        suspeitas: criarSuspeita,
        diagnosticos: criarDiagnostico,
      };

      for (const [pid, grupos] of Object.entries(sel)) {
        for (const campo of ["regioes", "suspeitas", "diagnosticos"] as const) {
          for (const nome of grupos[campo]) {
            let vid = mapas[campo].get(nome.toLowerCase());
            if (!vid) {
              if (!isAdmin) continue;
              const novo = await criadores[campo].mutateAsync(nome).catch(() => null);
              if (!novo) continue;
              vid = novo.id;
              mapas[campo].set(nome.toLowerCase(), novo.id);
            }
            if (campo === "regioes") {
              await supabase
                .from("patient_regions")
                .upsert({ patient_id: pid, region_id: vid }, { ignoreDuplicates: true });
            } else if (campo === "suspeitas") {
              await supabase
                .from("patient_suspicions")
                .upsert({ patient_id: pid, suspicion_id: vid }, { ignoreDuplicates: true });
            } else {
              await supabase
                .from("patient_diagnoses")
                .upsert({ patient_id: pid, diagnosis_id: vid }, { ignoreDuplicates: true });
            }
          }
        }
      }
      toast.success("Sugestões aplicadas aos casos.");
      setSugestoes([]);
      setSel({});
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const porId = new Map((pendentes.data ?? []).map((p) => [p.id, p]));
  const existe = {
    regioes: new Set((regioes.data ?? []).map((r) => r.nome.toLowerCase())),
    suspeitas: new Set((suspeitas.data ?? []).map((r) => r.nome.toLowerCase())),
    diagnosticos: new Set((diagnosticos.data ?? []).map((r) => r.nome.toLowerCase())),
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Revisão assistida por IA</h1>
            <p className="text-sm text-muted-foreground">
              {pendentes.data?.length ?? 0} casos com texto livre importado. Nada é salvo antes da
              sua confirmação.
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="rounded-full" onClick={reconhecerPorRegras} variant="secondary">
              <Wand2 className="size-4" /> Reconhecer automaticamente
            </Button>
            <Button className="rounded-full" onClick={analisar} disabled={rodando}>
              <Sparkles className="size-4" /> {rodando ? "Analisando…" : "Analisar com IA"}
            </Button>
            {sugestoes.length > 0 && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Salvando…" : "Aplicar selecionados"}
              </Button>
            )}
          </div>
        </div>

        {!isAdmin && sugestoes.length > 0 && (
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Itens novos (marcados como “novo”) só podem ser criados por administradores; eles serão
            ignorados ao aplicar.
          </p>
        )}

        <div className="space-y-4">
          {sugestoes.map((s) => {
            const p = porId.get(s.id);
            if (!p) return null;
            return (
              <div key={s.id} className="surface grid gap-6 p-6 lg:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <p className="font-mono text-xs text-muted-foreground">
                    {p.codigo_publicacao} · {p.paciente}
                  </p>
                  <Texto titulo="Neurolocalização" valor={p.neurolocalizacao_texto} />
                  <Texto titulo="Suspeitas" valor={p.suspeitas_texto} />
                  <Texto titulo="Diagnóstico" valor={p.diagnostico_importado_texto} />
                </div>
                <div className="space-y-4">
                  <Grupo
                    titulo="Região"
                    tone="sage"
                    nomes={[...(s.regioes ?? []), ...(s.novas_regioes ?? [])]}
                    existentes={existe.regioes}
                    sel={sel[s.id]?.regioes ?? []}
                    onToggle={(n) => alternar(s.id, "regioes", n)}
                  />
                  <Grupo
                    titulo="Suspeita"
                    tone="dusty"
                    nomes={[...(s.suspeitas ?? []), ...(s.novas_suspeitas ?? [])]}
                    existentes={existe.suspeitas}
                    sel={sel[s.id]?.suspeitas ?? []}
                    onToggle={(n) => alternar(s.id, "suspeitas", n)}
                  />
                  <Grupo
                    titulo="Diagnóstico"
                    tone="blush"
                    nomes={[...(s.diagnosticos ?? []), ...(s.novos_diagnosticos ?? [])]}
                    existentes={existe.diagnosticos}
                    sel={sel[s.id]?.diagnosticos ?? []}
                    onToggle={(n) => alternar(s.id, "diagnosticos", n)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Texto({ titulo, valor }: { titulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase">{titulo}</p>
      <p>{valor}</p>
    </div>
  );
}

function Grupo({
  titulo,
  nomes,
  sel,
  onToggle,
  existentes,
  tone,
}: {
  titulo: string;
  nomes: string[];
  sel: string[];
  onToggle: (n: string) => void;
  existentes: Set<string>;
  tone: "sage" | "dusty" | "blush";
}) {
  const tones = {
    sage: "data-[on=true]:bg-sage data-[on=true]:text-sage-foreground",
    dusty: "data-[on=true]:bg-dusty data-[on=true]:text-dusty-foreground",
    blush: "data-[on=true]:bg-blush data-[on=true]:text-blush-foreground",
  };
  if (!nomes.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase">{titulo}</p>
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set(nomes)).map((n) => (
          <button
            key={n}
            type="button"
            data-on={sel.includes(n)}
            onClick={() => onToggle(n)}
            className={cn("chip-base hover:bg-muted", tones[tone])}
          >
            {n}
            {!existentes.has(n.toLowerCase()) && (
              <span className="ml-1 text-[10px] opacity-70">novo</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
