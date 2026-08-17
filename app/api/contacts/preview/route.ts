import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { contacts, users } from "../../../../db/schema";
import { apiErrorResponse, requireAppUser } from "../../../../lib/auth";
import { electoralMeta, lookupSecao, profileSummary } from "../../../../lib/eleitoral";
import { IMPERATRIZ_NEIGHBORHOODS } from "../../../../lib/locations";
import { parseTitulo } from "../../../../lib/titulo";

function maskPhone(display: string) {
  const digits = display.replace(/\D/g, "");
  if (digits.length < 8) return display;
  return `(${digits.slice(0, 2)}) •••••-${digits.slice(-4)}`;
}

function suggestNeighborhood(bairro: string, city: string) {
  if (city && city.toLocaleLowerCase("pt-BR") !== "imperatriz") return null;
  const needle = bairro
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (!needle) return null;
  return (
    IMPERATRIZ_NEIGHBORHOODS.find((item) => {
      const hay = item.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      return hay === needle || needle.includes(hay) || hay.includes(needle);
    }) ?? null
  );
}

export async function GET(request: Request) {
  try {
    const current = await requireAppUser();
    const url = new URL(request.url);
    const tituloRaw = url.searchParams.get("titulo") ?? "";
    const nameRaw = url.searchParams.get("name") ?? "";
    const municipio = url.searchParams.get("municipio")?.trim() || "Imperatriz";
    const zona = Number(url.searchParams.get("zona"));
    const secao = Number(url.searchParams.get("secao"));
    const db = getDb();

    const titulo = tituloRaw.replace(/\D/g, "") ? parseTitulo(tituloRaw) : null;
    let existingTitulo: {
      id: number;
      name: string;
      leader: string;
      own: boolean;
      zona: number | null;
      secao: number | null;
    } | null = null;

    if (titulo?.valid) {
      const [row] = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          leader: users.name,
          leaderId: contacts.leaderId,
          zona: contacts.zona,
          secao: contacts.secao,
          status: contacts.status,
        })
        .from(contacts)
        .innerJoin(users, eq(contacts.leaderId, users.id))
        .where(and(eq(contacts.tituloNumero, titulo.digits), ne(contacts.status, "deleted")))
        .limit(1);
      if (row) {
        existingTitulo = {
          id: row.id,
          name: row.name,
          leader: row.leader,
          own: row.leaderId === current.id,
          zona: row.zona,
          secao: row.secao,
        };
      }
    }

    const secaoRow =
      Number.isInteger(zona) && Number.isInteger(secao) && zona > 0 && secao > 0
        ? lookupSecao(municipio, zona, secao)
        : existingTitulo?.zona && existingTitulo.secao
          ? lookupSecao(municipio, existingTitulo.zona, existingTitulo.secao)
          : null;

    const name = nameRaw.trim();
    let nameMatches: Array<{
      id: number;
      name: string;
      place: string;
      leader: string;
      own: boolean;
      phone: string | null;
      zona: number | null;
      secao: number | null;
    }> = [];

    if (name.length >= 3) {
      const pattern = `%${name.replace(/[%_]/g, "")}%`;
      const rows = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          city: contacts.city,
          neighborhood: contacts.neighborhood,
          leader: users.name,
          leaderId: contacts.leaderId,
          phone: contacts.phoneDisplay,
          zona: contacts.zona,
          secao: contacts.secao,
        })
        .from(contacts)
        .innerJoin(users, eq(contacts.leaderId, users.id))
        .where(
          and(
            ne(contacts.status, "deleted"),
            sql`lower(${contacts.name}) like lower(${pattern})`,
          ),
        )
        .limit(6);

      nameMatches = rows.map((row) => {
        const own = row.leaderId === current.id || current.role === "admin";
        return {
          id: row.id,
          name: row.name,
          place:
            row.city === "Imperatriz" && row.neighborhood !== "—"
              ? `${row.neighborhood} · Imperatriz`
              : row.city,
          leader: row.leader,
          own,
          phone: own ? row.phone : maskPhone(row.phone),
          zona: row.zona,
          secao: row.secao,
        };
      });
    }

    const perfil = secaoRow ? profileSummary(secaoRow) : null;

    return Response.json({
      titulo,
      existingTitulo,
      secao: secaoRow
        ? {
            ...secaoRow,
            perfil,
            bairroSugerido: suggestNeighborhood(secaoRow.bairro, secaoRow.municipio),
          }
        : null,
      nameMatches,
      meta: electoralMeta(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
