import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditLogs, consentEvents, contacts } from "../../../../db/schema";
import { ApiError, apiErrorResponse, requireAppUser } from "../../../../lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAppUser();
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) throw new ApiError(400, "Contato inválido.", "INVALID_CONTACT");
    const body = (await request.json()) as { action?: "opt_out" | "reactivate" };
    const db = getDb();
    const scope = user.role === "admin" ? eq(contacts.id, id) : and(eq(contacts.id, id), eq(contacts.leaderId, user.id));
    const [contact] = await db.select().from(contacts).where(scope).limit(1);
    if (!contact) throw new ApiError(404, "Contato não encontrado.", "CONTACT_NOT_FOUND");

    if (body.action === "opt_out") {
      const now = new Date();
      await db.update(contacts).set({ status: "opted_out", optedOutAt: now, updatedAt: now }).where(eq(contacts.id, id));
      await Promise.all([
        db.insert(consentEvents).values({ contactId: id, kind: "withdrawn", source: "painel", actorUserId: user.id }),
        db.insert(auditLogs).values({ actorUserId: user.id, action: "contact.opted_out", entityType: "contact", entityId: String(id) }),
      ]);
      return Response.json({ status: "opted_out" });
    }

    if (body.action === "reactivate") {
      throw new ApiError(400, "A reativação exige um novo registro de consentimento.", "NEW_CONSENT_REQUIRED");
    }
    throw new ApiError(400, "Ação inválida.", "INVALID_ACTION");
  } catch (error) {
    return apiErrorResponse(error);
  }
}
