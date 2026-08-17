import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

const ROOT = process.cwd();
const LOCAIS = path.join(ROOT, "tmp-tse/locais/eleitorado_local_votacao_2026_MA.csv");
const PERFIL = path.join(ROOT, "tmp-tse/perfil/perfil_eleitor_secao_2026_MA.csv");
const OUT = path.join(ROOT, "lib/data/ma-secoes.json");

function splitCsv(line) {
  return line.split(";").map((part) => part.replace(/^"|"$/g, "").trim());
}

function keyOf(municipio, zona, secao) {
  return `${municipio}|${Number(zona)}|${Number(secao)}`;
}

function titleCase(value) {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s/()-])([\p{L}])/gu, (full, sep, letter) => `${sep}${letter.toLocaleUpperCase("pt-BR")}`);
}

async function indexByHeader(filePath) {
  const stream = createReadStream(filePath, { encoding: "latin1" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const first = await rl[Symbol.asyncIterator]().next();
  rl.close();
  stream.destroy();
  if (first.done) throw new Error(`Arquivo vazio: ${filePath}`);
  const header = splitCsv(first.value);
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  return index;
}

async function eachRow(filePath, onRow) {
  const stream = createReadStream(filePath, { encoding: "latin1" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!header) {
      header = splitCsv(line);
      continue;
    }
    if (!line) continue;
    onRow(splitCsv(line), header);
  }
}

const locaisIndex = await indexByHeader(LOCAIS);
const secoes = new Map();

await eachRow(LOCAIS, (cols) => {
  const municipio = cols[locaisIndex.NM_MUNICIPIO];
  const turno = cols[locaisIndex.NR_TURNO];
  const situacao = (cols[locaisIndex.DS_SITU_SECAO] || "").toUpperCase();
  if (turno !== "1" || situacao !== "ATIVO") return;
  const zona = Number(cols[locaisIndex.NR_ZONA]);
  const secao = Number(cols[locaisIndex.NR_SECAO]);
  const key = keyOf(municipio, zona, secao);
  if (secoes.has(key)) return;
  secoes.set(key, {
    municipio: titleCase(municipio),
    zona,
    secao,
    local: titleCase(cols[locaisIndex.NM_LOCAL_VOTACAO] || ""),
    endereco: titleCase(cols[locaisIndex.DS_ENDERECO] || ""),
    bairro: titleCase(cols[locaisIndex.NM_BAIRRO] || ""),
    cep: (cols[locaisIndex.NR_CEP] || "").replace(/\D/g, ""),
    eleitores: Number(cols[locaisIndex.QT_ELEITOR_SECAO] || 0),
    mulheres: 0,
    homens: 0,
    biometria: 0,
    faixa: "",
    escolaridade: "",
    _faixas: new Map(),
    _esc: new Map(),
  });
});

const perfilIndex = await indexByHeader(PERFIL);
await eachRow(PERFIL, (cols) => {
  const municipio = cols[perfilIndex.NM_MUNICIPIO];
  const zona = Number(cols[perfilIndex.NR_ZONA]);
  const secao = Number(cols[perfilIndex.NR_SECAO]);
  const row = secoes.get(keyOf(municipio, zona, secao));
  if (!row) return;
  const qtd = Number(cols[perfilIndex.QT_ELEITORES] || 0);
  const bio = Number(cols[perfilIndex.QT_ELEITORES_BIOMETRIA] || 0);
  const genero = (cols[perfilIndex.DS_GENERO] || "").toUpperCase();
  if (genero.includes("FEMININO")) row.mulheres += qtd;
  else if (genero.includes("MASCULINO")) row.homens += qtd;
  row.biometria += bio;
  const faixa = cols[perfilIndex.DS_FAIXA_ETARIA] || "";
  const esc = cols[perfilIndex.DS_GRAU_ESCOLARIDADE] || "";
  if (faixa) row._faixas.set(faixa, (row._faixas.get(faixa) || 0) + qtd);
  if (esc) row._esc.set(esc, (row._esc.get(esc) || 0) + qtd);
});

function topKey(map) {
  let best = "";
  let max = -1;
  for (const [key, value] of map) {
    if (value > max) {
      best = key;
      max = value;
    }
  }
  return titleCase(best);
}

const compact = {};
for (const [key, row] of secoes) {
  compact[key] = {
    municipio: row.municipio,
    zona: row.zona,
    secao: row.secao,
    local: row.local,
    endereco: row.endereco,
    bairro: row.bairro,
    cep: row.cep || null,
    eleitores: row.eleitores || row.mulheres + row.homens,
    mulheres: row.mulheres,
    homens: row.homens,
    biometria: row.biometria,
    faixa: topKey(row._faixas),
    escolaridade: topKey(row._esc),
  };
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    source: "TSE Dados Abertos — eleitorado 2026",
    uf: "MA",
    generatedAt: new Date().toISOString().slice(0, 10),
    total: Object.keys(compact).length,
    secoes: compact,
  }),
);
console.log(`Gerado ${OUT} com ${Object.keys(compact).length} seções.`);
