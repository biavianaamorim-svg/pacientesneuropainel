import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { similaridade } from "@/lib/idade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type VocabItem = { id: string; nome: string };

const tones = {
  sage: "data-[on=true]:bg-sage data-[on=true]:text-sage-foreground data-[on=true]:border-sage",
  dusty: "data-[on=true]:bg-dusty data-[on=true]:text-dusty-foreground data-[on=true]:border-dusty",
  blush: "data-[on=true]:bg-blush data-[on=true]:text-blush-foreground data-[on=true]:border-blush",
} as const;

export function ChipSelector({
  label,
  options,
  selected,
  onToggle,
  canCreate,
  onCreate,
  tone = "sage",
  addLabel = "Adicionar novo",
}: {
  label: string;
  options: VocabItem[];
  selected: string[];
  onToggle: (id: string) => void;
  canCreate: boolean;
  onCreate: (nome: string) => Promise<VocabItem | null>;
  tone?: keyof typeof tones;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const parecidos = useMemo(() => {
    if (termo.trim().length < 2) return [];
    return options
      .map((o) => ({ o, s: similaridade(o.nome, termo) }))
      .filter((r) => r.s > 0.32)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6);
  }, [termo, options]);

  const exato = parecidos.some((p) => p.s >= 0.995);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              data-on={on}
              onClick={() => onToggle(o.id)}
              className={cn("chip-base hover:bg-muted", tones[tone])}
            >
              {on && <Check className="size-3.5" />}
              {o.nome}
            </button>
          );
        })}
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setTermo("");
              setOpen(true);
            }}
            className="chip-base border-dashed"
          >
            <Plus className="size-3.5" /> {addLabel}
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{addLabel}</DialogTitle>
            <DialogDescription>
              Digite o nome. Itens parecidos já existentes aparecem abaixo para evitar duplicatas.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Ex.: Lombossacral"
          />
          {parecidos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Já existem itens parecidos:</p>
              <div className="flex flex-wrap gap-2">
                {parecidos.map(({ o }) => (
                  <button
                    key={o.id}
                    type="button"
                    className="chip-base"
                    onClick={() => {
                      if (!selected.includes(o.id)) onToggle(o.id);
                      setOpen(false);
                    }}
                  >
                    Usar “{o.nome}”
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button
            disabled={termo.trim().length < 2 || salvando || exato}
            onClick={async () => {
              setSalvando(true);
              const item = await onCreate(termo.trim());
              setSalvando(false);
              if (item) {
                onToggle(item.id);
                setOpen(false);
              }
            }}
          >
            {exato ? "Esse item já existe" : "Criar e marcar"}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
