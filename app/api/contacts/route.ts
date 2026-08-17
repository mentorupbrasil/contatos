import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, consentEvents, contacts, users } from "../../../db/schema";
import { ApiError, apiErrorResponse, requireAppUser } from "../../../lib/auth";
import { lookupSecao, profileSummary } from "../../../lib/eleitoral";
import { IMPERATRIZ_NEIGHBORHOODS } from "../../../lib/locations";
import { displayBrazilianPhone, normalizeBrazilianPhone } from "../../../lib/phone";
import { parseTitulo } from "../../../lib/titulo";

function electoralFields(body: {
  titulo?: string;
  zona?: number | string;
  secao?: number | string;
  city?: string;
}) {
  const tituloRaw = body.titulo?.trim() ?? "";
  if (!tituloRaw) {
    return {
      tituloNumero: null as string | null,
      tituloUf: null as string | null,
      zona: null as number | null,
      secao: null as number | null,
      localVotacao: null as string | null,
      localEndereco: null as string | null,
      localBairro: null as string | null,
      perfilSecao: null as string | null,
    };
  }

  const titulo = parseTitulo(tituloRaw);
  if (!titulo.valid) {
    throw new ApiError(400, titulo.error || "Título eleitoral inválido.", "INVALID_TITULO");
  }

  const zona = body.zona === "" || body.zona == null ? null : Number(body.zona);
  const secao = body.secao === "" || body.secao == null ? null : Number(body.secao);
  const zonaOk = zona == null || (Number.isInteger(zona) && zona > 0);
  const secaoOk = secao == null || (Number.isInteger(secao) && secao > 0);
  if (!zonaOk || !secaoOk || (zona == null) !== (secao == null)) {
    throw new ApiError(400, "Informe zona e seção juntas, como no título.", "INVALID_ZONA_SECAO");
  }

  const found = zona && secao ? lookupSecao(body.city || "Imperatriz", zona, secao) : null;
  return {
    tituloNumero: titulo.digits,
    tituloUf: titulo.uf,
    zona,
    secao,
    localVotacao: found?.local ?? null,
    localEndereco: found?.endereco ?? null,
    localBairro: found?.bairro ?? null,
    perfilSecao: found ? JSON.stringify(profileSummary(found)) : null,
  };
}

export async function GET() {
  try {
    const user = await requireAppUser();
    const db = getDb();
    const scope =
      user.role === "admin"
        ? ne(contacts.status, "deleted")
        : and(eq(contacts.leaderId, user.id), ne(contacts.status, "deleted"));
    const rows = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phoneDisplay,
        neighborhood: contacts.neighborhood,
        city: contacts.city,
        tituloNumero: contacts.tituloNumero,
        tituloUf: contacts.tituloUf,
        zona: contacts.zona,
        secao: contacts.secao,
        localVotacao: contacts.localVotacao,
        localBairro: contacts.localBairro,
        perfilSecao: contacts.perfilSecao,
        status: contacts.status,
        createdAt: contacts.createdAt,
        leader: users.name,
      })
      .from(contacts)
      .innerJoin(users, eq(contacts.leaderId, users.id))
      .where(scope)
      .orderBy(desc(contacts.createdAt))
      .limit(2000);
    return Response.json({ contacts: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      neighborhood?: string;
      city?: string;
      otherCity?: boolean;
      consentConfirmed?: boolean;
      titulo?: string;
      zona?: number | string;
      secao?: number | string;
    };
    const name = body.name?.trim() ?? "";
    if (name.length < 2) throw new ApiError(400, "Informe o nome da pessoa.", "NAME_REQUIRED");
    if (!body.consentConfirmed) {
      throw new ApiError(400, "Confirme a autorização antes de cadastrar.", "CONSENT_REQUIRED");
    }

    let city = "Imperatriz";
    let neighborhood = body.neighborhood?.trim() || "Não informado";

    if (body.otherCity) {
      city = body.city?.trim() || "";
      if (city.length < 2) throw new ApiError(400, "Informe a cidade.", "CITY_REQUIRED");
      neighborhood = "—";
    } else if (!(IMPERATRIZ_NEIGHBORHOODS as readonly string[]).includes(neighborhood)) {
      throw new ApiError(400, "Selecione um bairro de Imperatriz.", "INVALID_NEIGHBORHOOD");
    }

    let phoneE164: string;
    try {
      phoneE164 = normalizeBrazilianPhone(body.phone ?? "");
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : "Telefone inválido.", "INVALID_PHONE");
    }

    const db = getDb();
    const [duplicate] = await db
      .select({ id: contacts.id, status: contacts.status })
      .from(contacts)
      .where(eq(contacts.phoneE164, phoneE164))
      .limit(1);
    if (duplicate?.status === "opted_out") {
      throw new ApiError(
        409,
        "Este número pediu descadastramento. Registre um novo consentimento antes de reativá-lo.",
        "CONTACT_OPTED_OUT",
      );
    }
    if (duplicate) throw new ApiError(409, "Este número já está cadastrado na rede.", "DUPLICATE_PHONE");

    const electoral = electoralFields({ ...body, city });
    if (electoral.tituloNumero) {
      const [dupTitulo] = await db
        .select({ id: contacts.id, status: contacts.status })
        .from(contacts)
        .where(eq(contacts.tituloNumero, electoral.tituloNumero))
        .limit(1);
      if (dupTitulo && dupTitulo.status !== "deleted") {
        throw new ApiError(409, "Este título já está cadastrado na rede.", "DUPLICATE_TITULO");
      }
    }

    const now = new Date();
    const [contact] = await db
      .insert(contacts)
      .values({
        name,
        phoneE164,
        phoneDisplay: displayBrazilianPhone(phoneE164),
        neighborhood,
        city,
        ...electoral,
        leaderId: user.id,
        consentAt: now,
      })
      .returning();

    await Promise.all([
      db.insert(consentEvents).values({
        contactId: contact.id,
        kind: "granted",
        source: "lideranca_presencial",
        actorUserId: user.id,
        detail: "Autorização confirmada no cadastro",
      }),
      db.insert(auditLogs).values({
        actorUserId: user.id,
        action: "contact.created",
        entityType: "contact",
        entityId: String(contact.id),
        details: JSON.stringify({ source: "lideranca_presencial", city, zona: electoral.zona, secao: electoral.secao }),
      }),
    ]);

    return Response.json(
      { contact: { ...contact, leader: user.name, phone: contact.phoneDisplay } },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
