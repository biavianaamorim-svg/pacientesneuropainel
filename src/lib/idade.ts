/** Converte texto de idade ("11 anos, 6 meses", "3a 2m", "8 meses") em meses. */
export function idadeParaMeses(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const t = String(texto).toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;

  let anos = 0;
  let meses = 0;
  let achou = false;

  const anoMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(anos|ano|a\b|y\b)/);
  if (anoMatch) {
    anos = parseFloat(anoMatch[1]!.replace(",", "."));
    achou = true;
  }
  const mesMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(meses|mes|mês|m\b)/);
  if (mesMatch) {
    meses = parseFloat(mesMatch[1]!.replace(",", "."));
    achou = true;
  }
  const diaMatch = t.match(/(\d+)\s*(dias|dia|d\b)/);
  if (diaMatch && !achou) {
    return Math.round(parseInt(diaMatch[1]!, 10) / 30);
  }

  if (!achou) {
    const soNumero = t.match(/^(\d+(?:[.,]\d+)?)$/);
    if (soNumero) return Math.round(parseFloat(soNumero[1]!.replace(",", ".")) * 12);
    return null;
  }

  return Math.round(anos * 12 + meses);
}

export function mesesParaTexto(meses: number | null | undefined): string {
  if (meses === null || meses === undefined) return "—";
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  if (a && m) return `${a} a ${m} m`;
  if (a) return `${a} a`;
  return `${m} m`;
}

/** Normaliza texto para comparação anti-duplicata (sem acento, minúsculo). */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Similaridade 0..1 entre duas strings (Dice coefficient em bigramas). */
export function similaridade(a: string, b: string): number {
  const x = normalizar(a);
  const y = normalizar(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const big = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const bx = big(x);
  const by = big(y);
  let inter = 0;
  bx.forEach((g) => {
    if (by.has(g)) inter++;
  });
  return (2 * inter) / (bx.size + by.size);
}
