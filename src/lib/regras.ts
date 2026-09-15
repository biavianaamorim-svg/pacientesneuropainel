import { normalizar } from "@/lib/idade";

export type Regra = { nome: string; termos: string[] };

/** Região neurológica, a partir do texto de neurolocalização. */
export const regrasRegiao: Regra[] = [
  {
    nome: "Encéfalo - prosencéfalo e córtex",
    termos: ["prosencefalo", "talamo cortical", "talamocortical", "cortex cerebral"],
  },
  { nome: "Encéfalo - tronco encefálico", termos: ["vestibular central", "tronco encefalico"] },
  { nome: "Encéfalo - núcleos da base", termos: ["nucleos da base", "nucleo da base"] },
  { nome: "Encéfalo - cerebelo", termos: ["cerebelo"] },
  {
    nome: "Vestibular periférico",
    termos: ["nervo vestibulo coclear", "vestibulococlear", "vestibular periferico"],
  },
  { nome: "Junção Neuromuscular", termos: ["neuromuscular"] },
  { nome: "Medula C1-C5", termos: ["cervical"] },
  {
    nome: "Medula C6-T2",
    termos: ["cervico toracico", "cervico toracica", "cervicotoracica", "cervico toracic"],
  },
  { nome: "Medula T3-L3", termos: ["toracica", "toracico", "toracolombar", "lombar"] },
  {
    nome: "Medula L4-S3",
    termos: ["cauda equina", "causa equina", "lombossacral", "sacral", "sacrococcigea"],
  },
  { nome: "Multifocal / Difuso", termos: ["nervos perifericos", "nervo periferico"] },
];

/** Categoria de suspeita, a partir do texto de suspeitas. */
export const regrasSuspeita: Regra[] = [
  {
    nome: "Anômalo / congênito",
    termos: [
      "malformacao",
      "malformacoes",
      "hemivertebra",
      "diverticulo aracnoide",
      "cisto quadrigeminal",
      "hidrocefalia",
      "siringomielia",
    ],
  },
  {
    nome: "Degenerativo",
    termos: [
      "extrusao",
      "protrusao",
      "discal",
      "sindrome da disfuncao cognitiva",
      "sdcc",
      "sdc",
      "atrofia cerebral",
      "mielopatia degenerativa",
    ],
  },
  { nome: "Idiopático", termos: ["epilepsia idiopatica", "idiopatico", "idiopatica"] },
  {
    nome: "Inflamatório/infeccioso",
    termos: [
      "encefalite",
      "mielite",
      "encefalomielite",
      "meningoencefalite",
      "meningoencefalomielite",
      "infeccioso",
      "infecciosa",
      "pif",
      "fiv",
      "felv",
      "cinomose",
      "neospora",
      "neosporose",
      "toxoplasmose",
      "criptococose",
      "criptococcose",
      "inflamatorio",
      "inflamatoria",
    ],
  },
  { nome: "Metabólico", termos: ["uremica", "uremico", "hepatica", "hepatico", "shunt"] },
  {
    nome: "Neoplásico",
    termos: ["neoplasia", "cancer", "neoplasico", "neoplasica", "linfoma", "meningioma"],
  },
  { nome: "Nutricional", termos: ["deficiencia", "nutricional"] },
  {
    nome: "Traumático",
    termos: [
      "trauma",
      "contusao",
      "lesao",
      "avulsao",
      "ruptura",
      "fratura",
      "tce",
      "trauma cranioencefalico",
    ],
  },
  { nome: "Vascular", termos: ["acidente vascular", "avc", "ave", "derrame"] },
];

/** Categoria de diagnóstico, a partir do texto de diagnóstico. */
export const regrasDiagnostico: Regra[] = [
  { nome: "Atrofia cerebral", termos: ["atrofia cerebral"] },
  { nome: "Discoespondilite", termos: ["discoespondilite"] },
  {
    nome: "Doença do disco intervertebral (protrusão/extrusão)",
    termos: ["protrusao", "extrusao", "ddiv"],
  },
  {
    nome: "Doença metabólica/tóxica",
    termos: ["shunt", "amonia", "ureia", "uremia", "azotemia"],
  },
  {
    nome: "Evento vascular",
    termos: ["avc", "ave", "derrame", "acidente vascular", "vascular"],
  },
  {
    nome: "Hidrocefalia",
    termos: ["dilatacao simetrica dos ventriculos", "hidrocefalia"],
  },
  {
    nome: "Instabilidade cervical",
    termos: ["instabilidade", "atlantoaxial", "atlantooccipital", "subluxacao"],
  },
  {
    nome: "Malformação congênita",
    termos: [
      "cisto",
      "siringomielia",
      "diverticulo aracnoide",
      "cisto quadrigeminal",
      "herniacao cerebelar",
      "malformacao",
      "hemivertebra",
    ],
  },
  {
    nome: "Neoplasia do SNC",
    termos: ["neoplasia", "massa", "tumor", "cancer", "neoplasica", "neoplasico"],
  },
  { nome: "Otite média interna", termos: ["otite media", "otite interna", "secrecao timpanica"] },
  { nome: "Trauma", termos: ["fratura", "trauma", "contusao", "laceracao", "avulsao"] },
];

/**
 * Aplica as regras de palavras-chave a um texto livre e devolve os nomes das
 * categorias reconhecidas (sem repetições).
 */
export function classificar(texto: string | null | undefined, regras: Regra[]): string[] {
  if (!texto) return [];
  const base = normalizar(texto);
  if (!base) return [];
  // "cervico-torácica" não deve ativar as regras torácicas de T3-L3
  const semCervicoToracico = base.replace(/cervico\s?toracic\w*/g, " ");
  const encontrados: string[] = [];
  for (const r of regras) {
    const alvo = r.nome === "Medula T3-L3" ? semCervicoToracico : base;
    if (r.termos.some((t) => alvo.includes(t)) && !encontrados.includes(r.nome)) {
      encontrados.push(r.nome);
    }
  }
  return encontrados;
}

export function classificarCaso(entrada: {
  neuro?: string | null;
  suspeitas?: string | null;
  diagnostico?: string | null;
}) {
  return {
    regioes: classificar(entrada.neuro, regrasRegiao),
    suspeitas: classificar(entrada.suspeitas, regrasSuspeita),
    diagnosticos: classificar(entrada.diagnostico, regrasDiagnostico),
  };
}

export const todasRegras = { regrasRegiao, regrasSuspeita, regrasDiagnostico };
