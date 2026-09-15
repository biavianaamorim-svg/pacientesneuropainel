import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChipSelector } from "@/components/ChipSelector";
import { useAllVocab, useCreateVocab } from "@/hooks/useVocab";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { idadeParaMeses, mesesParaTexto } from "@/lib/idade";
import type { Database } from "@/integrations/supabase/types";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Exam = Database["public"]["Tables"]["exams"]["Row"];

export const Route = createFileRoute("/pacientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do paciente — NeuroVet Casos" },
      { name: "description", content: "Ficha única com autosave de caso neurológico." },
      { property: "og:title", content: "Ficha do paciente — NeuroVet Casos" },
      { property: "og:description", content: "Ficha única com autosave de caso neurológico." },
    ],
  }),
  component: PacienteDetalhe,
});

const tiposExame = [
  "RM",
  "TC",
  "Radiografia",
  "LCR",
  "Hemograma",
  "Eletroneuromiografia",
  "Outro",
] as const;

function PacienteDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { regioes, suspeitas, diagnosticos } = useAllVocab();
  const criarRegiao = useCreateVocab("neuro_regions");
  const criarSuspeita = useCreateVocab("suspicion_categories");
  const criarDiagnostico = useCreateVocab("diagnosis_categories");
  const [salvo, setSalvo] = useState(false);

  const paciente = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Patient;
    },
  });

  const links = useQuery({
    queryKey: ["patient-links", id],
    queryFn: async () => {
      const [r, s, m, d] = await Promise.all([
        supabase.from("patient_regions").select("region_id").eq("patient_id", id),
        supabase.from("patient_suspicions").select("suspicion_id").eq("patient_id", id),
        supabase.from("patient_main_suspicions").select("diagnosis_id").eq("patient_id", id),
        supabase.from("patient_diagnoses").select("diagnosis_id").eq("patient_id", id),
      ]);
      return {
        regioes: (r.data ?? []).map((x) => x.region_id),
        suspeitas: (s.data ?? []).map((x) => x.suspicion_id),
        suspeitasPrincipais: (m.data ?? []).map((x) => x.diagnosis_id),
        diagnosticos: (d.data ?? []).map((x) => x.diagnosis_id),
      };
    },
  });

  const exames = useQuery({
    queryKey: ["exams", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("patient_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Exam[];
    },
  });

  const abertos = useQuery({
    queryKey: ["patients-abertos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id")
        .eq("status_diagnostico", "aberto")
        .order("codigo_publicacao");
      if (error) throw error;
      return (data ?? []).map((p) => p.id);
    },
  });

  const salvar = useMutation({
    mutationFn: async (patch: Partial<Patient>) => {
      const { error } = await supabase.from("patients").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1200);
      qc.invalidateQueries({ queryKey: ["patient", id] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patients-abertos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleLink = useMutation({
    mutationFn: async (args: {
      tabela: "patient_regions" | "patient_suspicions" | "patient_main_suspicions" | "patient_diagnoses";
      coluna: "region_id" | "suspicion_id" | "diagnosis_id";
      valor: string;
      ativo: boolean;
    }) => {
      if (args.ativo) {
        const { error } =
          args.tabela === "patient_regions"
            ? await supabase
                .from("patient_regions")
                .delete()
                .eq("patient_id", id)
                .eq("region_id", args.valor)
            : args.tabela === "patient_suspicions"
              ? await supabase
                  .from("patient_suspicions")
                  .delete()
                  .eq("patient_id", id)
                  .eq("suspicion_id", args.valor)
              : args.tabela === "patient_main_suspicions"
                ? await supabase
                    .from("patient_main_suspicions")
                    .delete()
                    .eq("patient_id", id)
                    .eq("diagnosis_id", args.valor)
                : await supabase
                    .from("patient_diagnoses")
                    .delete()
                    .eq("patient_id", id)
                    .eq("diagnosis_id", args.valor);
        if (error) throw error;
      } else {
        const { error } =
          args.tabela === "patient_regions"
            ? await supabase
                .from("patient_regions")
                .insert({ patient_id: id, region_id: args.valor })
            : args.tabela === "patient_suspicions"
              ? await supabase
                  .from("patient_suspicions")
                  .insert({ patient_id: id, suspicion_id: args.valor })
              : args.tabela === "patient_main_suspicions"
                ? await supabase
                    .from("patient_main_suspicions")
                    .insert({ patient_id: id, diagnosis_id: args.valor })
                : await supabase
                    .from("patient_diagnoses")
                    .insert({ patient_id: id, diagnosis_id: args.valor });
        if (error) throw error;
      }

      // Regras automáticas de status a partir das categorias de diagnóstico
      if (args.tabela === "patient_diagnoses") {
        const atuais = links.data?.diagnosticos ?? [];
        const novos = args.ativo
          ? atuais.filter((d) => d !== args.valor)
          : [...atuais, args.valor];
        const desfecho = paciente.data?.desfecho;
        const novoStatus: Patient["status_diagnostico"] | null = novos.length
          ? "fechado"
          : desfecho === "obito" || desfecho === "eutanasia"
            ? "sem_seguimento"
            : null;
        if (novoStatus && paciente.data?.status_diagnostico !== novoStatus) {
          await supabase.from("patients").update({ status_diagnostico: novoStatus }).eq("id", id);
        }
      }
    },
    onSuccess: () => {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1200);
      qc.invalidateQueries({ queryKey: ["patient-links", id] });
      qc.invalidateQueries({ queryKey: ["patient", id] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patients-abertos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const idx = abertos.data?.indexOf(id) ?? -1;
  const anterior = idx > 0 ? abertos.data?.[idx - 1] : undefined;
  const proximo =
    idx >= 0 && abertos.data && idx < abertos.data.length - 1 ? abertos.data[idx + 1] : undefined;

  if (paciente.isLoading || !paciente.data) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando ficha…</p>
      </AppShell>
    );
  }

  const p = paciente.data;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/pacientes"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Pacientes
          </Link>
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {salvo && (
              <span className="flex items-center gap-1 text-primary-foreground/80">
                <Check className="size-4" /> salvo
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={!anterior}
              onClick={() => anterior && navigate({ to: "/pacientes/$id", params: { id: anterior } })}
            >
              <ArrowLeft className="size-4" /> Anterior em aberto
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={!proximo}
              onClick={() => proximo && navigate({ to: "/pacientes/$id", params: { id: proximo } })}
            >
              Próximo em aberto <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="surface space-y-8 p-6 sm:p-8">
          <header className="flex flex-wrap items-baseline gap-3">
            <span className="rounded-full bg-dusty px-3 py-1 font-mono text-xs text-dusty-foreground">
              {p.codigo_publicacao}
            </span>
            <h1 className="text-2xl font-semibold">{p.paciente}</h1>
            <span className="text-sm text-muted-foreground">
              {mesesParaTexto(p.idade_meses)} · {p.especie ?? "espécie não informada"}
            </span>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CampoTexto
              label="Paciente"
              value={p.paciente}
              onSave={(v) => salvar.mutate({ paciente: v })}
            />
            <CampoTexto label="Tutor" value={p.tutor} onSave={(v) => salvar.mutate({ tutor: v })} />
            <CampoTexto
              label="Código de origem"
              value={p.codigo}
              onSave={(v) => salvar.mutate({ codigo: v })}
            />
            <CampoTexto
              label="Espécie"
              value={p.especie}
              onSave={(v) => salvar.mutate({ especie: v })}
            />
            <CampoTexto label="Raça" value={p.raca} onSave={(v) => salvar.mutate({ raca: v })} />
            <CampoTexto
              label="Esterilização"
              value={p.esterilizacao}
              onSave={(v) => salvar.mutate({ esterilizacao: v })}
            />
            <CampoTexto
              label={`Idade (${mesesParaTexto(p.idade_meses)})`}
              value={p.idade_texto}
              onSave={(v) => salvar.mutate({ idade_texto: v, idade_meses: idadeParaMeses(v) })}
            />
            <CampoTexto label="Sexo" value={p.sexo} onSave={(v) => salvar.mutate({ sexo: v })} />
            <CampoTexto
              label="Vivo / Morto"
              value={p.vivo_morto}
              onSave={(v) => salvar.mutate({ vivo_morto: v })}
            />
            <CampoData
              label="Data de atendimento"
              value={p.data_atendimento}
              onSave={(v) => salvar.mutate({ data_atendimento: v })}
            />
            <div className="space-y-2">
              <Label>Status do diagnóstico</Label>
              <Select
                value={p.status_diagnostico}
                onValueChange={(v) =>
                  salvar.mutate({ status_diagnostico: v as Patient["status_diagnostico"] })
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="fechado">Fechado</SelectItem>
                  <SelectItem value="sem_seguimento">Sem seguimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Desfecho</Label>
              <Select
                value={p.desfecho ?? ""}
                onValueChange={(v) => salvar.mutate({ desfecho: v as Patient["desfecho"] })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="melhora">Melhora</SelectItem>
                  <SelectItem value="obito">Óbito</SelectItem>
                  <SelectItem value="eutanasia">Eutanásia</SelectItem>
                  <SelectItem value="sem_seguimento">Sem seguimento</SelectItem>
                  <SelectItem value="em_acompanhamento">Em acompanhamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CampoData
              label="Data do desfecho"
              value={p.data_desfecho}
              onSave={(v) => salvar.mutate({ data_desfecho: v })}
            />
          </section>

          <ChipSelector
            label="Região neurológica"
            tone="sage"
            addLabel="Adicionar nova região"
            options={regioes.data ?? []}
            selected={links.data?.regioes ?? []}
            canCreate={isAdmin}
            onToggle={(rid) =>
              toggleLink.mutate({
                tabela: "patient_regions",
                coluna: "region_id",
                valor: rid,
                ativo: (links.data?.regioes ?? []).includes(rid),
              })
            }
            onCreate={async (nome) => criarRegiao.mutateAsync(nome).catch(() => null)}
          />

          <ChipSelector
            label="Categoria de suspeita"
            tone="dusty"
            addLabel="Adicionar nova suspeita"
            options={suspeitas.data ?? []}
            selected={links.data?.suspeitas ?? []}
            canCreate={isAdmin}
            onToggle={(sid) =>
              toggleLink.mutate({
                tabela: "patient_suspicions",
                coluna: "suspicion_id",
                valor: sid,
                ativo: (links.data?.suspeitas ?? []).includes(sid),
              })
            }
            onCreate={async (nome) => criarSuspeita.mutateAsync(nome).catch(() => null)}
          />

          <ChipSelector
            label="Suspeitas principais"
            tone="sage"
            addLabel="Adicionar nova suspeita principal"
            options={diagnosticos.data ?? []}
            selected={links.data?.suspeitasPrincipais ?? []}
            canCreate={isAdmin}
            onToggle={(did) =>
              toggleLink.mutate({
                tabela: "patient_main_suspicions",
                coluna: "diagnosis_id",
                valor: did,
                ativo: (links.data?.suspeitasPrincipais ?? []).includes(did),
              })
            }
            onCreate={async (nome) => criarDiagnostico.mutateAsync(nome).catch(() => null)}
          />

          <ChipSelector
            label="Categoria de diagnóstico"
            tone="blush"
            addLabel="Adicionar novo diagnóstico"
            options={diagnosticos.data ?? []}
            selected={links.data?.diagnosticos ?? []}
            canCreate={isAdmin}
            onToggle={(did) =>
              toggleLink.mutate({
                tabela: "patient_diagnoses",
                coluna: "diagnosis_id",
                valor: did,
                ativo: (links.data?.diagnosticos ?? []).includes(did),
              })
            }
            onCreate={async (nome) => criarDiagnostico.mutateAsync(nome).catch(() => null)}
          />

          <div className="space-y-2">
            <Label>Diagnóstico (texto livre)</Label>
            <CampoArea
              value={p.diagnostico_texto_livre}
              onSave={(v) => salvar.mutate({ diagnostico_texto_livre: v })}
            />
          </div>

          {(p.neurolocalizacao_texto || p.suspeitas_texto || p.diagnostico_importado_texto) && (
            <div className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
              <p className="mb-2 font-medium">Textos originais da planilha</p>
              {p.neurolocalizacao_texto && <p>Neurolocalização: {p.neurolocalizacao_texto}</p>}
              {p.suspeitas_texto && <p>Suspeitas: {p.suspeitas_texto}</p>}
              {p.diagnostico_importado_texto && (
                <p>Diagnóstico: {p.diagnostico_importado_texto}</p>
              )}
            </div>
          )}

          <Exames patientId={id} exames={exames.data ?? []} />
        </div>
      </div>
    </AppShell>
  );
}

function Exames({ patientId, exames }: { patientId: string; exames: Exam[] }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["exams", patientId] });

  const adicionar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("exams")
        .insert({ patient_id: patientId, tipo: "RM", status: "solicitado" });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Exam> }) => {
      const { error } = await supabase.from("exams").update(args.patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (examId: string) => {
      const { error } = await supabase.from("exams").delete().eq("id", examId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Exames</h3>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => adicionar.mutate()}
        >
          <Plus className="size-4" /> Exame
        </Button>
      </div>
      {exames.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum exame registrado.</p>
      )}
      <div className="space-y-3">
        {exames.map((e) => (
          <div key={e.id} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4">
            <Select
              value={e.tipo}
              onValueChange={(v) =>
                atualizar.mutate({ id: e.id, patch: { tipo: v as Exam["tipo"] } })
              }
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposExame.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={e.status}
              onValueChange={(v) =>
                atualizar.mutate({ id: e.id, patch: { status: v as Exam["status"] } })
              }
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solicitado">Solicitado</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="h-11"
              defaultValue={e.data ?? ""}
              onChange={(ev) =>
                atualizar.mutate({ id: e.id, patch: { data: ev.target.value || null } })
              }
            />
            <div className="flex items-start gap-2">
              <Textarea
                className="min-h-11"
                placeholder="Resultado"
                defaultValue={e.resultado ?? ""}
                onBlur={(ev) =>
                  atualizar.mutate({ id: e.id, patch: { resultado: ev.target.value } })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={() => remover.mutate(e.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function useDebouncedSave(value: string | null, onSave: (v: string) => void) {
  const [local, setLocal] = useState(value ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicial = useRef(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
    inicial.current = value ?? "";
  }, [value]);

  const change = (v: string) => {
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (v !== inicial.current) {
        inicial.current = v;
        onSave(v);
      }
    }, 700);
  };

  return { local, change };
}

function CampoTexto({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
}) {
  const { local, change } = useDebouncedSave(value, onSave);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input className="h-11" value={local} onChange={(e) => change(e.target.value)} />
    </div>
  );
}

function CampoArea({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const { local, change } = useDebouncedSave(value, onSave);
  return (
    <Textarea className="min-h-24" value={local} onChange={(e) => change(e.target.value)} />
  );
}

function CampoData({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);
  const memoLabel = useMemo(() => label, [label]);
  return (
    <div className="space-y-2">
      <Label>{memoLabel}</Label>
      <Input
        type="date"
        className="h-11"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onSave(e.target.value || null);
        }}
      />
    </div>
  );
}
