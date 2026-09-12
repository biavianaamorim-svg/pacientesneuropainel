import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { mesesParaTexto, normalizar } from "@/lib/idade";

export const Route = createFileRoute("/pacientes/")({
  head: () => ({
    meta: [
      { title: "Pacientes — NeuroVet Casos" },
      { name: "description", content: "Lista de pacientes neurológicos com busca rápida." },
      { property: "og:title", content: "Pacientes — NeuroVet Casos" },
      {
        property: "og:description",
        content: "Lista de pacientes neurológicos com busca rápida.",
      },
    ],
  }),
  component: PacientesPage,
});

const statusTone: Record<string, string> = {
  aberto: "bg-blush text-blush-foreground",
  fechado: "bg-sage text-sage-foreground",
  sem_seguimento: "bg-muted text-muted-foreground",
};

function PacientesPage() {
  const [busca, setBusca] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, codigo_publicacao, paciente, tutor, especie, idade_meses, status_diagnostico, data_atendimento",
        )
        .order("codigo_publicacao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const t = normalizar(busca);
    if (!t) return pacientes;
    return pacientes.filter(
      (p) =>
        normalizar(p.paciente ?? "").includes(t) ||
        normalizar(p.tutor ?? "").includes(t) ||
        normalizar(p.codigo_publicacao ?? "").includes(t),
    );
  }, [busca, pacientes]);

  const novo = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .insert({ paciente: "Novo paciente" })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      navigate({ to: "/pacientes/$id", params: { id: d.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Pacientes</h1>
            <p className="text-sm text-muted-foreground">{pacientes.length} casos cadastrados</p>
          </div>
          <Button size="lg" className="rounded-full" onClick={() => novo.mutate()}>
            <Plus className="size-4" /> Novo paciente
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por paciente, tutor ou código"
            className="h-12 rounded-full pl-11"
          />
        </div>

        <div className="surface divide-y divide-border overflow-hidden">
          {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && filtrados.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
          )}
          {filtrados.map((p) => (
            <Link
              key={p.id}
              to="/pacientes/$id"
              params={{ id: p.id }}
              className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/60"
            >
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                {p.codigo_publicacao}
              </span>
              <span className="min-w-40 flex-1 font-medium">{p.paciente}</span>
              <span className="min-w-32 text-sm text-muted-foreground">{p.tutor ?? "—"}</span>
              <span className="text-sm text-muted-foreground">{p.especie ?? "—"}</span>
              <span className="text-sm text-muted-foreground">
                {mesesParaTexto(p.idade_meses)}
              </span>
              <Badge
                className={`rounded-full border-0 ${statusTone[p.status_diagnostico] ?? ""}`}
              >
                {p.status_diagnostico.replace("_", " ")}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
