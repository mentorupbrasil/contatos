import { and, count, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { campaigns, contacts, users } from "../../../db/schema";
import { apiErrorResponse, requireAppUser } from "../../../lib/auth";
import { isWhatsAppConfigured } from "../../../lib/whatsapp";

export async function GET() {
  try {
    const user = await requireAppUser();
    const db = getDb();
    const contactScope = user.role === "admin"
      ? ne(contacts.status, "deleted")
      : and(eq(contacts.leaderId, user.id), ne(contacts.status, "deleted"));
    const activeScope = user.role === "admin"
      ? eq(contacts.status, "active")
      : and(eq(contacts.leaderId, user.id), eq(contacts.status, "active"));

    const [[{ totalContacts }], [{ activeContacts }], recentContacts, recentCampaigns] = await Promise.all([
      db.select({ totalContacts: count() }).from(contacts).where(contactScope),
      db.select({ activeContacts: count() }).from(contacts).where(activeScope),
      db.select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phoneDisplay,
        neighborhood: contacts.neighborhood,
        status: contacts.status,
        createdAt: contacts.createdAt,
        leader: users.name,
      }).from(contacts).innerJoin(users, eq(contacts.leaderId, users.id)).where(contactScope).orderBy(desc(contacts.createdAt)).limit(80),
      db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(20),
    ]);

    return Response.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      stats: { totalContacts, activeContacts },
      contacts: recentContacts,
      campaigns: recentCampaigns,
      whatsappConfigured: isWhatsAppConfigured(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
