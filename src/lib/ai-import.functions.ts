import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Linha = z.object({
  id: z.string(),
  paciente: z.string().optional().default(""),
  neuro: z.string().optional().default(""),
  suspeitas: z.string().optional().default(""),
  diagnostico: z.string().optional().default(""),
});

const Entrada = z.object({
  linhas: z.array(Linha).min(1).max(15),
  vocab: z.object({
    regioes: z.array(z.string()),
    suspeitas: z.array(z.string()),
    diagnosticos: z.array(z.string()),
  }),
});

export type SugestaoLinha = {
  id: string;
  regioes: string[];
  suspeitas: string[];
  diagnosticos: string[];
  novas_regioes: string[];
  novas_suspeitas: string[];
  novos_diagnosticos: string[];
};

export const sugerirChips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Entrada.parse(data))
  .handler(async ({ data }): Promise<{ sugestoes: SugestaoLinha[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A IA não está configurada neste projeto.");

    const prompt = `Você classifica casos neurológicos veterinários.

VOCABULÁRIO EXISTENTE
Regiões neurológicas: ${data.vocab.regioes.join(" | ")}
Categorias de suspeita: ${data.vocab.suspeitas.join(" | ")}
Categorias de diagnóstico: ${data.vocab.diagnosticos.join(" | ")}

Para cada linha abaixo, com base nos textos livres, escolha os itens do vocabulário existente que correspondem (copie o nome EXATAMENTE como está na lista). Se o texto descrever algo que claramente não existe no vocabulário, sugira um nome novo curto nos campos "novas_*". Não invente itens novos quando já houver um equivalente na lista (mesmo com grafia diferente). Se o texto estiver vazio ou não informativo, devolva listas vazias.

LINHAS
${JSON.stringify(data.linhas, null, 1)}

Responda apenas em JSON: {"sugestoes":[{"id":"...","regioes":[],"suspeitas":[],"diagnosticos":[],"novas_regioes":[],"novas_suspeitas":[],"novos_diagnosticos":[]}]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Muitas requisições de IA. Tente de novo em instantes.");
    if (res.status === 402)
      throw new Error("Os créditos de IA do projeto acabaram. Adicione créditos para continuar.");
    if (!res.ok) throw new Error(`A IA respondeu com erro (${res.status}).`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { sugestoes?: SugestaoLinha[] };
    try {
      parsed = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const sugestoes = (parsed.sugestoes ?? []).map((s) => ({
      id: String(s.id),
      regioes: s.regioes ?? [],
      suspeitas: s.suspeitas ?? [],
      diagnosticos: s.diagnosticos ?? [],
      novas_regioes: s.novas_regioes ?? [],
      novas_suspeitas: s.novas_suspeitas ?? [],
      novos_diagnosticos: s.novos_diagnosticos ?? [],
    }));

    return { sugestoes };
  });
