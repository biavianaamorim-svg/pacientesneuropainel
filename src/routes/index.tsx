import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllVocab } from "@/hooks/useVocab";
import { mesesParaTexto } from "@/lib/idade";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de casos — NeuroVet Casos" },
      {
        name: "description",
        content:
          "Painel com filtros combináveis por região neurológica, suspeita, diagnóstico e desfecho.",
      },
      { property: "og:title", content: "Painel de casos — NeuroVet Casos" },
      {
        property: "og:description",
        content: "Filtros combináveis e exportação em CSV dos casos neurológicos.",
      },
    ],
  }),
  component: Painel,
});

type Filtro = {
  regioes: string[];
  suspeitas: string[];
  diagnosticos: string[];
  status: string[];
  desfecho: string[];
  especie: string[];
  raca: string;
  idadeMin: string;
  idadeMax: string;
  dataDe: string;
  dataAte: string;
};

const filtroVazio: Filtro = {
  regioes: [],
  suspeitas: [],
  diagnosticos: [],
  status: [],
  desfecho: [],
  especie: [],
  raca: "",
  idadeMin: "",
  idadeMax: "",
  dataDe: "",
  dataAte: "",
};

const PATIENT_COLS =
  "id, codigo_publicacao, paciente, tutor, especie, raca, sexo, idade_meses, status_diagnostico, desfecho, data_atendimento, data_desfecho, diagnostico_texto_livre";

type PacienteLinha = {
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
};

const BLOCO = 1000;

// PostgREST devolve no máximo 1.000 linhas por requisição: percorre em blocos.
async function buscarTudo<T>(
  tabela: "patients" | "patient_regions" | "patient_suspicions" | "patient_diagnoses",
  colunas: string,
  ordem: string,
): Promise<T[]> {
  const todos: T[] = [];
  for (let inicio = 0; ; inicio += BLOCO) {
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .order(ordem)
      .range(inicio, inicio + BLOCO - 1);
    if (error) throw error;
    const lote = (data ?? []) as unknown as T[];
    todos.push(...lote);
    if (lote.length < BLOCO) break;
  }
  return todos;
}


  const [f, setF] = useState<Filtro>(filtroVazio);
  const { regioes, suspeitas, diagnosticos } = useAllVocab();

  const dados = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [pacientes, regioesLink, suspeitasLink, diagnosticosLink] = await Promise.all([
        buscarTudo<PacienteLinha>("patients", PATIENT_COLS, "codigo_publicacao"),
        buscarTudo<{ patient_id: string; region_id: string }>(
          "patient_regions",
          "patient_id, region_id",
          "patient_id",
        ),
        buscarTudo<{ patient_id: string; suspicion_id: string }>(
          "patient_suspicions",
          "patient_id, suspicion_id",
          "patient_id",
        ),
        buscarTudo<{ patient_id: string; diagnosis_id: string }>(
          "patient_diagnoses",
          "patient_id, diagnosis_id",
          "patient_id",
        ),
      ]);
      return {
        pacientes,
        regioes: regioesLink,
        suspeitas: suspeitasLink,
        diagnosticos: diagnosticosLink,
      };
    },
  });


  const nomePorId = useMemo(() => {
    const m = new Map<string, string>();
    [...(regioes.data ?? []), ...(suspeitas.data ?? []), ...(diagnosticos.data ?? [])].forEach(
      (v) => m.set(v.id, v.nome),
    );
    return m;
  }, [regioes.data, suspeitas.data, diagnosticos.data]);

  const especies = useMemo(
    () =>
      Array.from(
        new Set((dados.data?.pacientes ?? []).map((p) => p.especie).filter(Boolean) as string[]),
      ).sort(),
    [dados.data],
  );

  const racas = useMemo(
    () =>
      Array.from(
        new Set(
          (dados.data?.pacientes ?? [])
            .map((p) => (p.raca ?? "").trim())
            .filter((r) => r.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [dados.data],
  );

  const filtrados = useMemo(() => {
    const d = dados.data;
    if (!d) return [];
    const regPorPac = new Map<string, string[]>();
    d.regioes.forEach((r) =>
      regPorPac.set(r.patient_id, [...(regPorPac.get(r.patient_id) ?? []), r.region_id]),
    );
    const susPorPac = new Map<string, string[]>();
    d.suspeitas.forEach((r) =>
      susPorPac.set(r.patient_id, [...(susPorPac.get(r.patient_id) ?? []), r.suspicion_id]),
    );
    const diaPorPac = new Map<string, string[]>();
    d.diagnosticos.forEach((r) =>
      diaPorPac.set(r.patient_id, [...(diaPorPac.get(r.patient_id) ?? []), r.diagnosis_id]),
    );

    return d.pacientes
      .map((p) => ({
        ...p,
        _regioes: regPorPac.get(p.id) ?? [],
        _suspeitas: susPorPac.get(p.id) ?? [],
        _diagnosticos: diaPorPac.get(p.id) ?? [],
      }))
      .filter((p) => {
        const inc = (sel: string[], vals: string[]) =>
          sel.length === 0 || sel.some((s) => vals.includes(s));
        if (!inc(f.regioes, p._regioes)) return false;
        if (!inc(f.suspeitas, p._suspeitas)) return false;
        if (!inc(f.diagnosticos, p._diagnosticos)) return false;
        if (f.status.length && !f.status.includes(p.status_diagnostico)) return false;
        if (f.desfecho.length && !f.desfecho.includes(p.desfecho ?? "")) return false;
        if (f.especie.length && !f.especie.includes(p.especie ?? "")) return false;
        if (f.raca && (p.raca ?? "").trim() !== f.raca) return false;
        if (f.idadeMin && (p.idade_meses ?? -1) < Number(f.idadeMin)) return false;
        if (f.idadeMax && (p.idade_meses ?? 1e9) > Number(f.idadeMax)) return false;
        if (f.dataDe && (p.data_atendimento ?? "") < f.dataDe) return false;
        if (f.dataAte && (p.data_atendimento ?? "9999") > f.dataAte) return false;
        return true;
      });
  }, [dados.data, f]);

  function toggle(campo: keyof Filtro, valor: string) {
    setF((prev) => {
      const atual = prev[campo] as string[];
      return {
        ...prev,
        [campo]: atual.includes(valor) ? atual.filter((x) => x !== valor) : [...atual, valor],
      };
    });
  }

  function exportarCSV() {
    const cab = [
      "codigo_publicacao",
      "paciente",
      "tutor",
      "especie",
      "raca",
      "sexo",
      "idade_meses",
      "status_diagnostico",
      "desfecho",
      "data_atendimento",
      "data_desfecho",
      "regioes",
      "suspeitas",
      "diagnosticos",
      "diagnostico_texto_livre",
    ];
    const linhas = filtrados.map((p) =>
      [
        p.codigo_publicacao,
        p.paciente,
        p.tutor ?? "",
        p.especie ?? "",
        p.raca ?? "",
        p.sexo ?? "",
        p.idade_meses ?? "",
        p.status_diagnostico,
        p.desfecho ?? "",
        p.data_atendimento ?? "",
        p.data_desfecho ?? "",
        p._regioes.map((id) => nomePorId.get(id) ?? "").join("; "),
        p._suspeitas.map((id) => nomePorId.get(id) ?? "").join("; "),
        p._diagnosticos.map((id) => nomePorId.get(id) ?? "").join("; "),
        (p.diagnostico_texto_livre ?? "").replace(/\s+/g, " "),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [cab.join(","), ...linhas].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "casos-neurologicos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const abertos = filtrados.filter((p) => p.status_diagnostico === "aberto").length;

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Painel de casos</h1>
            <p className="text-sm text-muted-foreground">
              {filtrados.length} casos na visualização · {abertos} em aberto
            </p>
          </div>
          <Button className="rounded-full" onClick={exportarCSV} disabled={!filtrados.length}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        </div>

        <div className="surface space-y-6 p-6">
          <GrupoChips
            titulo="Região neurológica"
            tone="sage"
            itens={(regioes.data ?? []).map((r) => ({ v: r.id, label: r.nome }))}
            sel={f.regioes}
            onToggle={(v) => toggle("regioes", v)}
          />
          <GrupoChips
            titulo="Categoria de suspeita"
            tone="dusty"
            itens={(suspeitas.data ?? []).map((r) => ({ v: r.id, label: r.nome }))}
            sel={f.suspeitas}
            onToggle={(v) => toggle("suspeitas", v)}
          />
          <GrupoChips
            titulo="Categoria de diagnóstico"
            tone="blush"
            itens={(diagnosticos.data ?? []).map((r) => ({ v: r.id, label: r.nome }))}
            sel={f.diagnosticos}
            onToggle={(v) => toggle("diagnosticos", v)}
          />
          <div className="grid gap-6 md:grid-cols-3">
            <GrupoChips
              titulo="Status"
              tone="sage"
              itens={[
                { v: "aberto", label: "Aberto" },
                { v: "fechado", label: "Fechado" },
                { v: "sem_seguimento", label: "Sem seguimento" },
              ]}
              sel={f.status}
              onToggle={(v) => toggle("status", v)}
            />
            <GrupoChips
              titulo="Desfecho"
              tone="dusty"
              itens={[
                { v: "melhora", label: "Melhora" },
                { v: "obito", label: "Óbito" },
                { v: "eutanasia", label: "Eutanásia" },
                { v: "sem_seguimento", label: "Sem seguimento" },
                { v: "em_acompanhamento", label: "Em acompanhamento" },
              ]}
              sel={f.desfecho}
              onToggle={(v) => toggle("desfecho", v)}
            />
            <GrupoChips
              titulo="Espécie"
              tone="blush"
              itens={especies.map((e) => ({ v: e, label: e }))}
              sel={f.especie}
              onToggle={(v) => toggle("especie", v)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Raça</Label>
              <Select
                value={f.raca === "" ? "__todas" : f.raca}
                onValueChange={(v) => setF({ ...f, raca: v === "__todas" ? "" : v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Todas as raças" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas">Todas as raças</SelectItem>
                  {racas.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idade mínima (meses)</Label>
              <Input
                type="number"
                className="h-11"
                value={f.idadeMin}
                onChange={(e) => setF({ ...f, idadeMin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Idade máxima (meses)</Label>
              <Input
                type="number"
                className="h-11"
                value={f.idadeMax}
                onChange={(e) => setF({ ...f, idadeMax: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Atendimento de</Label>
              <Input
                type="date"
                className="h-11"
                value={f.dataDe}
                onChange={(e) => setF({ ...f, dataDe: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Atendimento até</Label>
              <Input
                type="date"
                className="h-11"
                value={f.dataAte}
                onChange={(e) => setF({ ...f, dataAte: e.target.value })}
              />
            </div>
          </div>
          <Button variant="ghost" className="rounded-full" onClick={() => setF(filtroVazio)}>
            Limpar filtros
          </Button>
        </div>

        <div className="surface divide-y divide-border overflow-hidden">
          {dados.isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando…</p>}
          {!dados.isLoading && filtrados.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum caso nesta combinação.</p>
          )}
          {filtrados.map((p) => (
            <Link
              key={p.id}
              to="/pacientes/$id"
              params={{ id: p.id }}
              className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/60"
            >
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                {p.codigo_publicacao}
              </span>
              <span className="min-w-36 flex-1 font-medium">{p.paciente}</span>
              <span className="text-sm text-muted-foreground">{p.especie ?? "—"}</span>
              <span className="text-sm text-muted-foreground">
                {mesesParaTexto(p.idade_meses)}
              </span>
              <span className="text-sm text-muted-foreground">
                {p._diagnosticos.map((id) => nomePorId.get(id)).join(", ") || "sem diagnóstico"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function GrupoChips({
  titulo,
  itens,
  sel,
  onToggle,
  tone,
}: {
  titulo: string;
  itens: { v: string; label: string }[];
  sel: string[];
  onToggle: (v: string) => void;
  tone: "sage" | "dusty" | "blush";
}) {
  const tones = {
    sage: "data-[on=true]:bg-sage data-[on=true]:text-sage-foreground",
    dusty: "data-[on=true]:bg-dusty data-[on=true]:text-dusty-foreground",
    blush: "data-[on=true]:bg-blush data-[on=true]:text-blush-foreground",
  };
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{titulo}</h3>
      <div className="flex flex-wrap gap-2">
        {itens.map((i) => (
          <button
            key={i.v}
            type="button"
            data-on={sel.includes(i.v)}
            onClick={() => onToggle(i.v)}
            className={cn("chip-base hover:bg-muted", tones[tone])}
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}
