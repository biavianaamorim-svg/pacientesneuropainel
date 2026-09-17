import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAllVocab } from "@/hooks/useVocab";
import { buscarPacientesParaAnalise, buscarRelacoesPaciente } from "@/lib/patient-data";

export const Route = createFileRoute("/analises")({
  head: () => ({ meta: [{ title: "Análises — NeuroVet Casos" }] }),
  component: Analises,
});

function Analises() {
  const { regioes, suspeitas, diagnosticos } = useAllVocab();
  const dados = useQuery({
    queryKey: ["analises-completas"],
    queryFn: async () => {
      const [pacientes, [relRegioes, relSuspeitas, relDiagnosticos]] = await Promise.all([
        buscarPacientesParaAnalise(),
        buscarRelacoesPaciente(),
      ]);
      return { pacientes, relRegioes, relSuspeitas, relDiagnosticos };
    },
    staleTime: 60_000,
  });

  const resumo = useMemo(() => {
    const p = dados.data?.pacientes ?? [];
    const por = (valores: string[]) =>
      valores.reduce<Record<string, number>>((acc, valor) => {
        acc[valor] = (acc[valor] ?? 0) + 1;
        return acc;
      }, {});
    const ids = (dados.data?.relSuspeitas ?? []).reduce<Record<string, string[]>>((acc, item) => {
      if (item.suspicion_id)
        acc[item.patient_id] = [...(acc[item.patient_id] ?? []), item.suspicion_id];
      return acc;
    }, {});
    const regioesIds = (dados.data?.relRegioes ?? []).reduce<Record<string, string[]>>(
      (acc, item) => {
        if (item.region_id)
          acc[item.patient_id] = [...(acc[item.patient_id] ?? []), item.region_id];
        return acc;
      },
      {},
    );
    const completos = p
      .filter((x) => (ids[x.id]?.length ?? 0) > 0)
      .filter((x) => (regioesIds[x.id]?.length ?? 0) > 0);
    return {
      total: p.length,
      abertos: p.filter((x) => x.status_diagnostico === "aberto").length,
      fechados: p.filter((x) => x.status_diagnostico === "fechado").length,
      semSeguimento: p.filter((x) => x.status_diagnostico === "sem_seguimento").length,
      semSuspeita: p.filter((x) => !ids[x.id]?.length).length,
      semRegiao: p.filter((x) => !regioesIds[x.id]?.length).length,
      semAmbas: p.filter((x) => !ids[x.id]?.length && !regioesIds[x.id]?.length).length,
      completos: completos.length,
      especies: por(p.map((x) => x.especie?.trim() || "Não informado")),
      desfechos: por(p.map((x) => x.desfecho || "Não informado")),
      suspeitas: por((dados.data?.relSuspeitas ?? []).map((x) => x.suspicion_id ?? "")),
      regioes: por((dados.data?.relRegioes ?? []).map((x) => x.region_id ?? "")),
      diagnosticos: por((dados.data?.relDiagnosticos ?? []).map((x) => x.diagnosis_id ?? "")),
      nomes: {
        suspeitas: Object.fromEntries((suspeitas.data ?? []).map((x) => [x.id, x.nome])),
        regioes: Object.fromEntries((regioes.data ?? []).map((x) => [x.id, x.nome])),
        diagnosticos: Object.fromEntries((diagnosticos.data ?? []).map((x) => [x.id, x.nome])),
      },
    };
  }, [dados.data, diagnosticos.data, regioes.data, suspeitas.data]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Análises</h1>
          <p className="text-sm text-muted-foreground">
            Indicadores calculados sobre todos os pacientes, sem o limite de 1.000 registros.
          </p>
        </div>
        {dados.isLoading && <p className="text-sm text-muted-foreground">Carregando dados…</p>}
        {dados.error && (
          <p className="text-sm text-destructive">Não foi possível carregar as análises.</p>
        )}
        {resumo && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Total", resumo.total],
                ["Em aberto", resumo.abertos],
                ["Fechados", resumo.fechados],
                ["Sem seguimento", resumo.semSeguimento],
                ["Sem suspeita", resumo.semSuspeita],
                ["Sem região", resumo.semRegiao],
                ["Sem as duas", resumo.semAmbas],
                ["Completos", resumo.completos],
              ].map(([label, valor]) => (
                <Card key={String(label)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">{valor}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Tabela titulo="Por espécie" dados={resumo.especies} />
              <Tabela titulo="Por desfecho" dados={resumo.desfechos} />
              <Tabela
                titulo="Por suspeita"
                dados={resumo.suspeitas}
                nomes={resumo.nomes.suspeitas}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Tabela
                titulo="Por região neurológica"
                dados={resumo.regioes}
                nomes={resumo.nomes.regioes}
              />
              <Tabela
                titulo="Por diagnóstico"
                dados={resumo.diagnosticos}
                nomes={resumo.nomes.diagnosticos}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Tabela({
  titulo,
  dados,
  nomes,
}: {
  titulo: string;
  dados: Record<string, number>;
  nomes?: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(dados)
          .filter(([k]) => k)
          .sort((a, b) => b[1] - a[1])
          .map(([id, total]) => (
            <div key={id} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm">{nomes?.[id] ?? id}</span>
              <Badge variant="secondary">{total}</Badge>
            </div>
          ))}
        {!Object.keys(dados).length && (
          <p className="text-sm text-muted-foreground">Nenhum dado.</p>
        )}
      </CardContent>
    </Card>
  );
}
