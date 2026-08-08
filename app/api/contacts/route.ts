import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, consentEvents, contacts, users } from "../../../db/schema";
import { ApiError, apiErrorResponse, requireAppUser } from "../../../lib/auth";
import { displayBrazilianPhone, normalizeBrazilianPhone } from "../../../lib/phone";

export async function GET() {
  try {
    const user = await requireAppUser();
    const db = await getDb();
    const scope = user.role === "admin"
      ? ne(contacts.status, "deleted")
      : and(eq(contacts.leaderId, user.id), ne(contacts.status, "deleted"));
    const rows = await db.select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phoneDisplay,
      neighborhood: contacts.neighborhood,
      status: contacts.status,
      createdAt: contacts.createdAt,
      leader: users.name,
    }).from(contacts).innerJoin(users, eq(contacts.leaderId, users.id)).where(scope).orderBy(desc(contacts.createdAt)).limit(300);
    return Response.json({ contacts: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as { name?: string; phone?: string; neighborhood?: string; consentConfirmed?: boolean };
    const name = body.name?.trim() ?? "";
    const neighborhood = body.neighborhood?.trim() || "Não informado";
    if (name.length < 2) throw new ApiError(400, "Informe o nome da pessoa.", "NAME_REQUIRED");
    if (!body.consentConfirmed) throw new ApiError(400, "Confirme a autorização antes de cadastrar.", "CONSENT_REQUIRED");

    let phoneE164: string;
    try {
      phoneE164 = normalizeBrazilianPhone(body.phone ?? "");
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : "Telefone inválido.", "INVALID_PHONE");
    }

    const db = await getDb();
    const [duplicate] = await db.select({ id: contacts.id, status: contacts.status }).from(contacts).where(eq(contacts.phoneE164, phoneE164)).limit(1);
    if (duplicate?.status === "opted_out") throw new ApiError(409, "Este número pediu descadastramento. Registre um novo consentimento antes de reativá-lo.", "CONTACT_OPTED_OUT");
    if (duplicate) throw new ApiError(409, "Este número já está cadastrado na rede.", "DUPLICATE_PHONE");

    const now = new Date();
    const [contact] = await db.insert(contacts).values({
      name,
      phoneE164,
      phoneDisplay: displayBrazilianPhone(phoneE164),
      neighborhood,
      leaderId: user.id,
      consentAt: now,
    }).returning();

    await db.batch([
      db.insert(consentEvents).values({ contactId: contact.id, kind: "granted", source: "lideranca_presencial", actorUserId: user.id, detail: "Autorização confirmada no cadastro" }),
      db.insert(auditLogs).values({ actorUserId: user.id, action: "contact.created", entityType: "contact", entityId: String(contact.id), details: JSON.stringify({ source: "lideranca_presencial" }) }),
    ]);
    return Response.json({ contact: { ...contact, leader: user.name, phone: contact.phoneDisplay } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
