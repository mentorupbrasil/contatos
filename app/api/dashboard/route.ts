import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { campaigns, contacts, users } from "../../../db/schema";
import { apiErrorResponse, requireAppUser } from "../../../lib/auth";
import { isWhatsAppConfigured } from "../../../lib/whatsapp";

export async function GET() {
  try {
    const user = await requireAppUser();
    const db = getDb();
    const contactScope =
      user.role === "admin"
        ? ne(contacts.status, "deleted")
        : and(eq(contacts.leaderId, user.id), ne(contacts.status, "deleted"));
    const activeScope =
      user.role === "admin"
        ? eq(contacts.status, "active")
        : and(eq(contacts.leaderId, user.id), eq(contacts.status, "active"));

    const networkActive = eq(contacts.status, "active");

    const [
      [{ totalContacts }],
      [{ activeContacts }],
      recentContacts,
      recentCampaigns,
      ranking,
      rankingByCity,
      rankingByNeighborhood,
      rankingByZona,
    ] = await Promise.all([
      db.select({ totalContacts: count() }).from(contacts).where(contactScope),
      db.select({ activeContacts: count() }).from(contacts).where(activeScope),
      db
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
          leaderId: users.id,
        })
        .from(contacts)
        .innerJoin(users, eq(contacts.leaderId, users.id))
        .where(contactScope)
        .orderBy(desc(contacts.createdAt))
        .limit(80),
      db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(20),
      db
        .select({
          leaderId: users.id,
          name: users.name,
          role: users.role,
          total: sql<number>`coalesce(sum(case when ${contacts.status} <> 'deleted' then 1 else 0 end), 0)`,
          active: sql<number>`coalesce(sum(case when ${contacts.status} = 'active' then 1 else 0 end), 0)`,
        })
        .from(users)
        .leftJoin(contacts, eq(contacts.leaderId, users.id))
        .where(eq(users.status, "active"))
        .groupBy(users.id, users.name, users.role)
        .orderBy(sql`coalesce(sum(case when ${contacts.status} = 'active' then 1 else 0 end), 0) desc`),
      db
        .select({
          city: contacts.city,
          active: sql<number>`count(*)::int`,
        })
        .from(contacts)
        .where(networkActive)
        .groupBy(contacts.city)
        .orderBy(sql`count(*) desc`),
      db
        .select({
          city: contacts.city,
          neighborhood: contacts.neighborhood,
          active: sql<number>`count(*)::int`,
        })
        .from(contacts)
        .where(and(networkActive, eq(contacts.city, "Imperatriz"), ne(contacts.neighborhood, "—")))
        .groupBy(contacts.city, contacts.neighborhood)
        .orderBy(sql`count(*) desc`)
        .limit(80),
      db
        .select({
          zona: contacts.zona,
          active: sql<number>`count(*)::int`,
        })
        .from(contacts)
        .where(and(networkActive, sql`${contacts.zona} is not null`))
        .groupBy(contacts.zona)
        .orderBy(sql`count(*) desc`),
    ]);

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      stats: { totalContacts, activeContacts },
      contacts: recentContacts,
      campaigns: recentCampaigns,
      ranking,
      rankingByCity,
      rankingByNeighborhood,
      rankingByZona,
      whatsappConfigured: isWhatsAppConfigured(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
