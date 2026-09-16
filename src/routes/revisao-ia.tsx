import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
      { title: "Reconhecimento automático — NeuroVet Casos" },
      {
        name: "description",
        content:
          "Reconheça região, suspeita e diagnóstico de todos os casos já cadastrados e revise antes de salvar.",
      },
      { property: "og:title", content: "Reconhecimento automático — NeuroVet Casos" },
      {
        property: "og:description",
        content: "Aplique as regras de palavras-chave a todos os casos já cadastrados.",
      },
    ],
  }),
  component: RevisaoIA,
});

type CasoTexto = {
  id: string;
  codigo_publicacao: string;
  paciente: string;
  desfecho: string | null;
  status_diagnostico: string;
  neurolocalizacao_texto: string | null;
  suspeitas_texto: string | null;
  diagnostico_importado_texto: string | null;
};

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

async function buscarTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const tudo: T[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await consulta(de, de + passo - 1);
    if (error) throw error as Error;
    const bloco = data ?? [];
    tudo.push(...bloco);
    if (bloco.length < passo) break;
  }
  return tudo;
}

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
  const [previa, setPrevia] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const casos = useQuery({
    queryKey: ["casos-com-texto"],
    queryFn: async (): Promise<CasoTexto[]> =>
      buscarTudo<CasoTexto>((de, ate) =>
        supabase
          .from("patients")
          .select(
            "id, codigo_publicacao, paciente, desfecho, status_diagnostico, neurolocalizacao_texto, suspeitas_texto, diagnostico_importado_texto",
          )
          .or(
            "neurolocalizacao_texto.not.is.null,suspeitas_texto.not.is.null,diagnostico_importado_texto.not.is.null",
          )
          .order("codigo_publicacao")
          .range(de, ate),
      ),
    staleTime: 60_000,
  });

  const analise = useMemo(() => {
    const lista = (casos.data ?? []).map((p) => ({
      caso: p,
      ...classificarCaso({
        neuro: p.neurolocalizacao_texto,
        suspeitas: p.suspeitas_texto,
        diagnostico: p.diagnostico_importado_texto,
      }),
    }));
    return {
      lista,
      comRegiao: lista.filter((x) => x.regioes.length).length,
      comSuspeita: lista.filter((x) => x.suspeitas.length).length,
      comDiagnostico: lista.filter((x) => x.diagnosticos.length).length,
      semNada: lista.filter(
        (x) => !x.regioes.length && !x.suspeitas.length && !x.diagnosticos.length,
      ),
    };
  }, [casos.data]);

  async function aplicarTudo() {
    setAplicando(true);
    setProgresso(0);
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

      const linhasR: { patient_id: string; region_id: string }[] = [];
      const linhasS: { patient_id: string; suspicion_id: string }[] = [];
      const linhasD: { patient_id: string; diagnosis_id: string }[] = [];
      const comDiagnostico = new Set<string>();

      for (const item of analise.lista) {
        for (const campo of ["regioes", "suspeitas", "diagnosticos"] as const) {
          for (const nome of item[campo]) {
            let vid = mapas[campo].get(nome.toLowerCase());
            if (!vid) {
              if (!isAdmin) continue;
              const novo = await criadores[campo].mutateAsync(nome).catch(() => null);
              if (!novo) continue;
              vid = novo.id;
              mapas[campo].set(nome.toLowerCase(), novo.id);
            }
            if (campo === "regioes") linhasR.push({ patient_id: item.caso.id, region_id: vid });
            else if (campo === "suspeitas")
              linhasS.push({ patient_id: item.caso.id, suspicion_id: vid });
            else {
              linhasD.push({ patient_id: item.caso.id, diagnosis_id: vid });
              comDiagnostico.add(item.caso.id);
            }
          }
        }
      }

      const total = linhasR.length + linhasS.length + linhasD.length || 1;
      let feitas = 0;
      const lote = 500;

      for (let i = 0; i < linhasR.length; i += lote) {
        const { error } = await supabase
          .from("patient_regions")
          .upsert(linhasR.slice(i, i + lote), { ignoreDuplicates: true });
        if (error) throw error;
        feitas += Math.min(lote, linhasR.length - i);
        setProgresso(Math.round((feitas / total) * 100));
      }
      for (let i = 0; i < linhasS.length; i += lote) {
        const { error } = await supabase
          .from("patient_suspicions")
          .upsert(linhasS.slice(i, i + lote), { ignoreDuplicates: true });
        if (error) throw error;
        feitas += Math.min(lote, linhasS.length - i);
        setProgresso(Math.round((feitas / total) * 100));
      }
      for (let i = 0; i < linhasD.length; i += lote) {
        const { error } = await supabase
          .from("patient_diagnoses")
          .upsert(linhasD.slice(i, i + lote), { ignoreDuplicates: true });
        if (error) throw error;
        feitas += Math.min(lote, linhasD.length - i);
        setProgresso(Math.round((feitas / total) * 100));
      }

      // Regras de status: com diagnóstico → fechado; óbito/eutanásia sem diagnóstico → sem seguimento
      const jaTinhaDiagnostico = new Set(
        (
          await buscarTudo<{ patient_id: string }>((de, ate) =>
            supabase.from("patient_diagnoses").select("patient_id").range(de, ate),
          )
        ).map((x) => x.patient_id),
      );
      const fechados: string[] = [];
      const semSeguimento: string[] = [];
      for (const item of analise.lista) {
        const temDiag = comDiagnostico.has(item.caso.id) || jaTinhaDiagnostico.has(item.caso.id);
        if (temDiag) {
          if (item.caso.status_diagnostico !== "fechado") fechados.push(item.caso.id);
        } else if (
          (item.caso.desfecho === "obito" || item.caso.desfecho === "eutanasia") &&
          item.caso.status_diagnostico !== "sem_seguimento"
        ) {
          semSeguimento.push(item.caso.id);
        }
      }
      for (let i = 0; i < fechados.length; i += 200) {
        const { error } = await supabase
          .from("patients")
          .update({ status_diagnostico: "fechado" })
          .in("id", fechados.slice(i, i + 200));
        if (error) throw error;
      }
      for (let i = 0; i < semSeguimento.length; i += 200) {
        const { error } = await supabase
          .from("patients")
          .update({ status_diagnostico: "sem_seguimento" })
          .in("id", semSeguimento.slice(i, i + 200));
        if (error) throw error;
      }

      setProgresso(100);
      toast.success(
        `Marcações aplicadas: ${linhasR.length} regiões, ${linhasS.length} suspeitas e ${linhasD.length} diagnósticos.`,
      );
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAplicando(false);
    }
  }

  async function analisarComIA() {
    const linhas = analise.semNada.slice(0, 15).map((x) => ({
      id: x.caso.id,
      paciente: x.caso.paciente,
      neuro: x.caso.neurolocalizacao_texto ?? "",
      suspeitas: x.caso.suspeitas_texto ?? "",
      diagnostico: x.caso.diagnostico_importado_texto ?? "",
    }));
    if (!linhas.length) {
      toast.info("Nenhum caso sem correspondência para analisar.");
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

  function alternar(pid: string, campo: "regioes" | "suspeitas" | "diagnosticos", nome: string) {
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

  async function salvarSugestoesIA() {
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
              await supabase
                .from("patients")
                .update({ status_diagnostico: "fechado" })
                .eq("id", pid);
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

  const porId = new Map((casos.data ?? []).map((p) => [p.id, p]));
  const existe = {
    regioes: new Set((regioes.data ?? []).map((r) => r.nome.toLowerCase())),
    suspeitas: new Set((suspeitas.data ?? []).map((r) => r.nome.toLowerCase())),
    diagnosticos: new Set((diagnosticos.data ?? []).map((r) => r.nome.toLowerCase())),
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Reconhecimento automático</h1>
          <p className="text-sm text-muted-foreground">
            {casos.isLoading
              ? "Carregando casos…"
              : `${casos.data?.length ?? 0} casos já cadastrados têm texto livre da planilha. Nada é apagado: as marcações são somadas às existentes.`}
          </p>
        </div>

        <div className="surface space-y-4 p-6">
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              onClick={() => setPrevia(true)}
              disabled={casos.isLoading || !casos.data?.length}
            >
              <Wand2 className="size-4" /> Reconhecer tudo
            </Button>
            {previa && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={aplicarTudo}
                disabled={aplicando}
              >
                {aplicando ? `Aplicando… ${progresso}%` : "Aplicar aos casos"}
              </Button>
            )}
          </div>

          {previa && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Cartao titulo="Com região" valor={analise.comRegiao} />
              <Cartao titulo="Com suspeita" valor={analise.comSuspeita} />
              <Cartao titulo="Com diagnóstico" valor={analise.comDiagnostico} />
              <Cartao titulo="Sem correspondência" valor={analise.semNada.length} />
            </div>
          )}

          {aplicando && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-sage transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          )}
        </div>

        {previa && analise.semNada.length > 0 && (
          <div className="surface space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Casos sem correspondência ({analise.semNada.length})
              </h2>
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={analisarComIA}
                disabled={rodando}
              >
                <Sparkles className="size-4" />
                {rodando ? "Analisando…" : "Analisar 15 com IA"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {analise.semNada.slice(0, 60).map((x) => (
                <Link
                  key={x.caso.id}
                  to="/pacientes/$id"
                  params={{ id: x.caso.id }}
                  className="chip-base hover:bg-muted"
                >
                  {x.caso.codigo_publicacao} · {x.caso.paciente}
                </Link>
              ))}
            </div>
            {analise.semNada.length > 60 && (
              <p className="text-xs text-muted-foreground">
                Mostrando os 60 primeiros. Os demais aparecem conforme você resolve estes.
              </p>
            )}
          </div>
        )}

        {sugestoes.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={salvarSugestoesIA}
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Aplicar sugestões da IA"}
            </Button>
          </div>
        )}

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

function Cartao({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-muted/60 p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-xl font-semibold">{valor}</p>
    </div>
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
