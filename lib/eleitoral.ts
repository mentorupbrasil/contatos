import "server-only";
import maSecoes from "./data/ma-secoes.json";

export type SecaoEleitoral = {
  municipio: string;
  zona: number;
  secao: number;
  local: string;
  endereco: string;
  bairro: string;
  cep: string | null;
  eleitores: number;
  mulheres: number;
  homens: number;
  biometria: number;
  faixa: string;
  escolaridade: string;
};

type MaSecoesFile = {
  source: string;
  uf: string;
  generatedAt: string;
  total: number;
  secoes: Record<string, SecaoEleitoral>;
};

const data = maSecoes as MaSecoesFile;

function normalizeCity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const secaoIndex = new Map<string, SecaoEleitoral>();
for (const [key, row] of Object.entries(data.secoes)) {
  const [municipio, zona, secao] = key.split("|");
  secaoIndex.set(`${normalizeCity(municipio)}|${zona}|${secao}`, row);
}

export function secaoKey(municipio: string, zona: number, secao: number) {
  return `${normalizeCity(municipio)}|${zona}|${secao}`;
}

export function lookupSecao(municipio: string, zona: number, secao: number): SecaoEleitoral | null {
  if (!Number.isInteger(zona) || !Number.isInteger(secao) || zona < 1 || secao < 1) return null;
  return (
    secaoIndex.get(secaoKey(municipio, zona, secao)) ??
    secaoIndex.get(`IMPERATRIZ|${zona}|${secao}`) ??
    null
  );
}

export function profileSummary(row: SecaoEleitoral) {
  const total = Math.max(1, row.eleitores || row.mulheres + row.homens);
  const womenPct = Math.round((row.mulheres / total) * 100);
  const bioPct = Math.round((row.biometria / total) * 100);
  return {
    eleitores: row.eleitores,
    mulheresPct: womenPct,
    homensPct: 100 - womenPct,
    biometriaPct: Math.min(100, bioPct),
    faixa: row.faixa,
    escolaridade: row.escolaridade,
    texto: `${row.eleitores} eleitores · ${womenPct}% mulheres · faixa ${row.faixa || "n/d"} · ${row.escolaridade || "escolaridade n/d"}`,
  };
}

export function electoralMeta() {
  return { source: data.source, uf: data.uf, generatedAt: data.generatedAt, total: data.total };
}
