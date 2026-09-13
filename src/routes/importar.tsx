import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { idadeParaMeses, normalizar } from "@/lib/idade";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar planilha — NeuroVet Casos" },
      {
        name: "description",
        content: "Importe casos em CSV ou XLSX com cálculo automático de idade em meses.",
      },
      { property: "og:title", content: "Importar planilha — NeuroVet Casos" },
      {
        property: "og:description",
        content: "Importe casos em CSV ou XLSX com cálculo automático de idade em meses.",
      },
    ],
  }),
  component: Importar,
});

type Linha = Record<string, string>;

const mapa: Record<string, string> = {
  codigo: "codigo",
  paciente: "paciente",
  tutor: "tutor",
  especie: "especie",
  raca: "raca",
  esterilizacao: "esterilizacao",
  idade: "idade_texto",
  sexo: "sexo",
  vivomorto: "vivo_morto",
  vivo: "vivo_morto",
  neurolocalizacao: "neurolocalizacao_texto",
  suspeitas: "suspeitas_texto",
  suspeita: "suspeitas_texto",
  diagnostico: "diagnostico_importado_texto",
  dataatendimento: "data_atendimento",
};

function chave(h: string) {
  return normalizar(h).replace(/[^a-z]/g, "");
}

function Importar() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [colunas, setColunas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function onFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return toast.error("Planilha vazia.");
    const rows = XLSX.utils.sheet_to_json<Linha>(wb.Sheets[sheetName]!, { defval: "", raw: false });
    if (!rows.length) return toast.error("Nenhuma linha encontrada.");
    setColunas(Object.keys(rows[0]!));
    setLinhas(rows);
  }

  async function importar() {
    setSalvando(true);
    try {
      const registros = linhas.map((l) => {
        const r: Record<string, string | number | null> = {};
        for (const [h, v] of Object.entries(l)) {
          const campo = mapa[chave(h)];
          if (campo && String(v).trim()) r[campo] = String(v).trim();
        }
        if (typeof r["idade_texto"] === "string") {
          r["idade_meses"] = idadeParaMeses(r["idade_texto"]);
        }
        if (!r["paciente"]) r["paciente"] = "Sem nome";
        return r;
      });

      for (let i = 0; i < registros.length; i += 200) {
        const { error } = await supabase.from("patients").insert(registros.slice(i, i + 200));
        if (error) throw error;
      }
      qc.invalidateQueries();
      toast.success(`${registros.length} pacientes importados.`);
      navigate({ to: "/revisao-ia" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Importar planilha</h1>
          <p className="text-sm text-muted-foreground">
            Aceita CSV e XLSX. Idade é convertida em meses automaticamente e cada caso recebe um
            código sequencial.
          </p>
        </div>

        <label className="surface flex cursor-pointer flex-col items-center gap-3 p-10 text-center">
          <Upload className="size-6 text-muted-foreground" />
          <span className="font-medium">Escolher arquivo</span>
          <span className="text-sm text-muted-foreground">
            Colunas reconhecidas: Código, Paciente, Tutor, Espécie, Raça, Esterilização, Idade,
            Sexo, Vivo/Morto, Neurolocalização, Suspeitas, Diagnóstico
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>

        {linhas.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Pré-visualização de {Math.min(linhas.length, 20)} de {linhas.length} linhas
              </p>
              <Button className="rounded-full" disabled={salvando} onClick={importar}>
                {salvando ? "Importando…" : `Importar ${linhas.length} pacientes`}
              </Button>
            </div>
            <div className="surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {colunas.map((c) => (
                      <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">
                        {c}
                        {mapa[chave(c)] ? "" : " (ignorada)"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, 20).map((l, i) => (
                    <tr key={i} className="border-b border-border/60">
                      {colunas.map((c) => (
                        <td key={c} className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {l[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
