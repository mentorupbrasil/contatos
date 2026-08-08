import { and, count, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { campaigns, contacts } from "../../../db/schema";
import { apiErrorResponse, requireAppUser } from "../../../lib/auth";
import { isWhatsAppConfigured } from "../../../lib/whatsapp";

export type AppNotification = {
  id: string;
  kind: "contact" | "optout" | "campaign" | "system" | "tip";
  title: string;
  body: string;
  createdAt: string;
  href?: "contatos" | "disparos" | "mais";
};

export async function GET() {
  try {
    const user = await requireAppUser();
    const db = getDb();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const activeScope =
      user.role === "admin"
        ? eq(contacts.status, "active")
        : and(eq(contacts.leaderId, user.id), eq(contacts.status, "active"));
    const newScope =
      user.role === "admin"
        ? and(ne(contacts.status, "deleted"), gte(contacts.createdAt, weekAgo))
        : and(eq(contacts.leaderId, user.id), ne(contacts.status, "deleted"), gte(contacts.createdAt, weekAgo));
    const optOutScope =
      user.role === "admin"
        ? and(eq(contacts.status, "opted_out"), gte(contacts.optedOutAt, twoWeeksAgo))
        : and(
            eq(contacts.leaderId, user.id),
            eq(contacts.status, "opted_out"),
            gte(contacts.optedOutAt, twoWeeksAgo),
          );

    const [[{ activeContacts }], [{ newContacts }], [{ optedOut }], pendingCampaigns, recentOptOuts] =
      await Promise.all([
        db.select({ activeContacts: count() }).from(contacts).where(activeScope),
        db.select({ newContacts: count() }).from(contacts).where(newScope),
        db.select({ optedOut: count() }).from(contacts).where(optOutScope),
        user.role === "admin"
          ? db
              .select({
                id: campaigns.id,
                title: campaigns.title,
                status: campaigns.status,
                updatedAt: campaigns.updatedAt,
              })
              .from(campaigns)
              .where(inArray(campaigns.status, ["queued", "sending", "paused"]))
              .orderBy(desc(campaigns.updatedAt))
              .limit(5)
          : Promise.resolve([]),
        db
          .select({
            id: contacts.id,
            name: contacts.name,
            optedOutAt: contacts.optedOutAt,
          })
          .from(contacts)
          .where(optOutScope)
          .orderBy(desc(contacts.optedOutAt))
          .limit(3),
      ]);

    const items: AppNotification[] = [];

    if (Number(newContacts) > 0) {
      items.push({
        id: `new-contacts-${weekAgo.toISOString().slice(0, 10)}`,
        kind: "contact",
        title: Number(newContacts) === 1 ? "1 contato novo na semana" : `${newContacts} contatos novos na semana`,
        body:
          user.role === "admin"
            ? "A rede cresceu. Veja os cadastros recentes."
            : "Boa! Sua base aumentou nos últimos 7 dias.",
        createdAt: new Date().toISOString(),
        href: "contatos",
      });
    }

    for (const row of recentOptOuts) {
      items.push({
        id: `optout-${row.id}`,
        kind: "optout",
        title: `${row.name} saiu da base`,
        body: "Pediu para não receber mais comunicados.",
        createdAt: (row.optedOutAt ?? new Date()).toISOString(),
        href: "contatos",
      });
    }

    if (Number(optedOut) > recentOptOuts.length) {
      const extra = Number(optedOut) - recentOptOuts.length;
      items.push({
        id: `optout-extra-${twoWeeksAgo.toISOString().slice(0, 10)}`,
        kind: "optout",
        title: `${extra} saída${extra > 1 ? "s" : ""} recente${extra > 1 ? "s" : ""}`,
        body: "Revise os contatos que optaram por sair.",
        createdAt: new Date().toISOString(),
        href: "contatos",
      });
    }

    for (const campaign of pendingCampaigns) {
      const label =
        campaign.status === "paused"
          ? "Disparo pausado"
          : campaign.status === "sending" || campaign.status === "queued"
            ? "Disparo em andamento"
            : "Disparo pendente";
      items.push({
        id: `campaign-${campaign.id}-${campaign.status}`,
        kind: "campaign",
        title: label,
        body: campaign.title,
        createdAt: campaign.updatedAt.toISOString(),
        href: "disparos",
      });
    }

    if (user.role === "admin" && !isWhatsAppConfigured()) {
      items.push({
        id: "whatsapp-config",
        kind: "system",
        title: "WhatsApp ainda sem credenciais",
        body: "Configure as variáveis WHATSAPP_* para liberar disparos oficiais.",
        createdAt: new Date().toISOString(),
        href: "mais",
      });
    }

    if (Number(activeContacts) === 0) {
      items.push({
        id: "tip-first-contact",
        kind: "tip",
        title: "Comece cadastrando um contato",
        body: "Com consentimento, adicione a primeira pessoa da sua base.",
        createdAt: new Date().toISOString(),
        href: "contatos",
      });
    } else if (Number(newContacts) === 0 && Number(optedOut) === 0 && pendingCampaigns.length === 0) {
      items.push({
        id: "tip-all-clear",
        kind: "tip",
        title: "Tudo em dia por aqui",
        body: "Sem alertas novos. Continue movimentando a rede.",
        createdAt: new Date().toISOString(),
      });
    }

    return Response.json({ notifications: items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
