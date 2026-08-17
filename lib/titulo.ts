const UF_BY_CODE: Record<string, string> = {
  "01": "AC",
  "02": "AL",
  "03": "AP",
  "04": "AM",
  "05": "BA",
  "06": "CE",
  "07": "DF",
  "08": "ES",
  "09": "GO",
  "10": "MA",
  "11": "MT",
  "12": "MS",
  "13": "MG",
  "14": "PA",
  "15": "PB",
  "16": "PR",
  "17": "PE",
  "18": "PI",
  "19": "RJ",
  "20": "RN",
  "21": "RS",
  "22": "RO",
  "23": "RR",
  "24": "SC",
  "25": "SP",
  "26": "SE",
  "27": "TO",
  "28": "ZZ",
};

const UF_NAME: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
  ZZ: "Exterior",
};

export type TituloInfo = {
  digits: string;
  formatted: string;
  valid: boolean;
  uf: string | null;
  ufName: string | null;
  ufCode: string | null;
  error?: string;
};

function verifierDigit(digits: number[], base = 2) {
  const sum = digits.reduce((acc, digit, index) => acc + digit * (base + index), 0);
  const remainder = sum % 11;
  return remainder > 9 ? 0 : remainder;
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatTitulo(value: string) {
  const digits = digitsOnly(value).slice(0, 12);
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 8)}.${digits.slice(8)}`;
}

export function parseTitulo(value: string): TituloInfo {
  const digits = digitsOnly(value);
  if (!digits) {
    return { digits: "", formatted: "", valid: false, uf: null, ufName: null, ufCode: null };
  }
  if (digits.length !== 12) {
    return {
      digits,
      formatted: formatTitulo(digits),
      valid: false,
      uf: null,
      ufName: null,
      ufCode: null,
      error: "O título tem 12 números. Continue digitando.",
    };
  }

  const parts = digits.split("").map(Number);
  const ufCode = digits.slice(8, 10);
  const uf = UF_BY_CODE[ufCode] ?? null;
  if (!uf) {
    return {
      digits,
      formatted: formatTitulo(digits),
      valid: false,
      uf: null,
      ufName: null,
      ufCode,
      error: "UF do título inválida.",
    };
  }

  const dv1 = verifierDigit(parts.slice(0, 8));
  const dv2 = verifierDigit([parts[8], parts[9], dv1], 7);
  const valid = dv1 === parts[10] && dv2 === parts[11];

  return {
    digits,
    formatted: formatTitulo(digits),
    valid,
    uf,
    ufName: UF_NAME[uf],
    ufCode,
    error: valid ? undefined : "Número do título inválido. Confira os dígitos.",
  };
}
