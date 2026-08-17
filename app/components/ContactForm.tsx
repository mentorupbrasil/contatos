"use client";

import { Check, IdCard, MapPin, Search, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { IMPERATRIZ_NEIGHBORHOODS, OTHER_CITY_OPTION } from "../../lib/locations";
import { formatTitulo, parseTitulo } from "../../lib/titulo";

type NameMatch = {
  id: number;
  name: string;
  place: string;
  leader: string;
  own: boolean;
  phone: string | null;
  zona: number | null;
  secao: number | null;
};

type SecaoInfo = {
  municipio: string;
  zona: number;
  secao: number;
  local: string;
  endereco: string;
  bairro: string;
  perfil: {
    eleitores: number;
    mulheresPct: number;
    biometriaPct: number;
    faixa: string;
    escolaridade: string;
    texto: string;
  };
  bairroSugerido: string | null;
};

type Preview = {
  titulo?: ReturnType<typeof parseTitulo> | null;
  existingTitulo?: {
    id: number;
    name: string;
    leader: string;
    own: boolean;
    zona: number | null;
    secao: number | null;
  } | null;
  secao?: SecaoInfo | null;
  nameMatches?: NameMatch[];
};

export function ContactForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [titulo, setTitulo] = useState("");
  const [zona, setZona] = useState("");
  const [secao, setSecao] = useState("");
  const [place, setPlace] = useState("");
  const [cityName, setCityName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const otherCity = place === OTHER_CITY_OPTION;

  const tituloInfo = useMemo(() => (titulo.replace(/\D/g, "") ? parseTitulo(titulo) : null), [titulo]);
  const municipio = otherCity ? cityName || "Imperatriz" : "Imperatriz";

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const digits = titulo.replace(/\D/g, "");
      if (name.trim().length < 3 && digits.length < 12 && (!zona || !secao)) {
        setPreview(null);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (name.trim().length >= 3) params.set("name", name.trim());
        if (digits) params.set("titulo", digits);
        if (zona) params.set("zona", zona);
        if (secao) params.set("secao", secao);
        params.set("municipio", municipio);
        const response = await fetch(`/api/contacts/preview?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = (await response.json()) as Preview;
        setPreview(result);
        if (!zona && result.existingTitulo?.zona) setZona(String(result.existingTitulo.zona));
        if (!secao && result.existingTitulo?.secao) setSecao(String(result.existingTitulo.secao));
        if (!otherCity && !place && result.secao?.bairroSugerido) {
          setPlace(result.secao.bairroSugerido);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          // preview is optional
        }
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [name, titulo, zona, secao, municipio, otherCity, place]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      phone,
      titulo,
      zona: zona || undefined,
      secao: secao || undefined,
      neighborhood: otherCity ? "—" : place,
      city: otherCity ? cityName.trim() : "Imperatriz",
      otherCity,
      consentConfirmed: true,
    });
  }

  return (
    <form className="sheet-form" onSubmit={handleSubmit}>
      <label>
        Nome completo
        <input
          name="name"
          autoComplete="name"
          placeholder="Ex.: Maria de Fátima"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {preview?.nameMatches && preview.nameMatches.length > 0 && (
        <div className="lookup-card">
          <span className="lookup-card__icon">
            <Search size={16} />
          </span>
          <div>
            <strong>Já existe na rede</strong>
            {preview.nameMatches.map((match) => (
              <small key={match.id}>
                {match.name} · {match.place}
                {match.zona ? ` · Z${match.zona} S${match.secao}` : ""} · {match.leader}
                {match.phone ? ` · ${match.phone}` : ""}
              </small>
            ))}
          </div>
        </div>
      )}

      <label>
        Título eleitoral
        <input
          name="titulo"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0000.0000.0000"
          value={titulo}
          onChange={(event) => setTitulo(formatTitulo(event.target.value))}
        />
      </label>
      {tituloInfo && (
        <div className={`lookup-card ${tituloInfo.valid ? "" : "lookup-card--warn"}`}>
          <span className="lookup-card__icon">
            <IdCard size={16} />
          </span>
          <div>
            <strong>
              {tituloInfo.valid
                ? `Título ${tituloInfo.uf} · ${tituloInfo.ufName}`
                : tituloInfo.error || "Conferindo título…"}
            </strong>
            {tituloInfo.valid && (
              <small>
                {tituloInfo.uf === "MA"
                  ? "Maranhão. Informe zona e seção do documento para local, bairro e perfil da urna."
                  : `Domicílio eleitoral em ${tituloInfo.ufName}. Zona e seção estão no título.`}
              </small>
            )}
            {preview?.existingTitulo && (
              <small>
                Título já usado por {preview.existingTitulo.name} ({preview.existingTitulo.leader}).
              </small>
            )}
          </div>
        </div>
      )}

      <div className="sheet-split">
        <label>
          Zona
          <input
            name="zona"
            inputMode="numeric"
            placeholder="Ex.: 33"
            value={zona}
            onChange={(event) => setZona(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <label>
          Seção
          <input
            name="secao"
            inputMode="numeric"
            placeholder="Ex.: 215"
            value={secao}
            onChange={(event) => setSecao(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
      </div>

      {preview?.secao && (
        <div className="lookup-card lookup-card--ok">
          <span className="lookup-card__icon">
            <MapPin size={16} />
          </span>
          <div>
            <strong>
              Zona {preview.secao.zona} · Seção {preview.secao.secao} · {preview.secao.municipio}
            </strong>
            <small>{preview.secao.local}</small>
            <small>
              {preview.secao.endereco}
              {preview.secao.bairro ? ` · ${preview.secao.bairro}` : ""}
            </small>
            <small>
              <Users size={12} /> {preview.secao.perfil.texto}
            </small>
          </div>
        </div>
      )}
      {zona && secao && preview && !preview.secao && (
        <div className="lookup-card lookup-card--warn">
          <span className="lookup-card__icon">
            <MapPin size={16} />
          </span>
          <div>
            <strong>Zona {zona} · Seção {secao} não encontrada no MA</strong>
            <small>Confira os números do título. A base usa os locais de votação oficiais de 2026.</small>
          </div>
        </div>
      )}

      <label>
        WhatsApp
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(99) 9 9999-9999"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <label>
        Local
        <select
          name="place"
          value={place}
          required={!otherCity}
          onChange={(event) => setPlace(event.target.value)}
        >
          <option value="" disabled>
            Selecione o bairro (Imperatriz)
          </option>
          {IMPERATRIZ_NEIGHBORHOODS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
          <option value={OTHER_CITY_OPTION}>Outro município (só cidade)</option>
        </select>
      </label>
      {otherCity && (
        <label>
          Cidade
          <input
            name="cityName"
            placeholder="Ex.: Açailândia"
            required
            value={cityName}
            onChange={(event) => setCityName(event.target.value)}
          />
        </label>
      )}
      <label className="consent-box">
        <input name="consent" type="checkbox" required />
        <span>
          <span className="consent-title">A pessoa autorizou o cadastro</span>
          <small>Foi informada de que receberá comunicados no WhatsApp e pode sair quando quiser.</small>
        </span>
      </label>
      <button className="button button--primary button--wide" type="submit" disabled={submitting}>
        <Check size={19} /> {submitting ? "Salvando…" : "Salvar contato"}
      </button>
    </form>
  );
}
