import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { auditLogs, campaignRecipients, campaigns, contacts } from "../../../../../db/schema";
import { ApiError, apiErrorResponse, requireAdmin, requireAppUser } from "../../../../../lib/auth";
import { isWhatsAppConfigured, sendTemplateMessage } from "../../../../../lib/whatsapp";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAppUser();
    requireAdmin(user);
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) throw new ApiError(400, "Disparo inválido.", "INVALID_CAMPAIGN");

    const db = getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!campaign) throw new ApiError(404, "Disparo não encontrado.", "CAMPAIGN_NOT_FOUND");
    if (["draft", "paused", "failed"].includes(campaign.status)) {
      throw new ApiError(409, "Este disparo não está liberado para envio.", "CAMPAIGN_NOT_SENDABLE");
    }
    if (!isWhatsAppConfigured()) {
      throw new ApiError(
        503,
        "Configure as credenciais oficiais do WhatsApp antes de iniciar a fila.",
        "WHATSAPP_NOT_CONFIGURED",
      );
    }

    const rows = await db
      .select({
        recipientId: campaignRecipients.id,
        attempts: campaignRecipients.attempts,
        name: contacts.name,
        phoneE164: contacts.phoneE164,
      })
      .from(campaignRecipients)
      .innerJoin(contacts, eq(campaignRecipients.contactId, contacts.id))
      .where(
        and(
          eq(campaignRecipients.campaignId, id),
          eq(campaignRecipients.status, "queued"),
          eq(contacts.status, "active"),
        ),
      )
      .orderBy(asc(campaignRecipients.id))
      .limit(25);

    if (!campaign.startedAt) {
      await db
        .update(campaigns)
        .set({ status: "sending", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(campaigns.id, id));
    }

    let sent = 0;
    let failed = 0;
    for (const recipient of rows) {
      const claimed = await db
        .update(campaignRecipients)
        .set({ status: "sending", attempts: recipient.attempts + 1 })
        .where(and(eq(campaignRecipients.id, recipient.recipientId), eq(campaignRecipients.status, "queued")))
        .returning({ id: campaignRecipients.id });
      if (!claimed.length) continue;

      try {
        const providerId = await sendTemplateMessage({
          to: recipient.phoneE164,
          templateName: campaign.templateName,
          language: campaign.templateLanguage,
          contactName: campaign.includeNameParameter ? recipient.name.split(" ")[0] : undefined,
        });
        await db
          .update(campaignRecipients)
          .set({
            status: "sent",
            providerMessageId: providerId,
            sentAt: new Date(),
            failureCode: null,
          })
          .where(eq(campaignRecipients.id, recipient.recipientId));
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 220) : "Falha no envio";
        const retry = recipient.attempts + 1 < 3;
        await db
          .update(campaignRecipients)
          .set({ status: retry ? "queued" : "failed", failureCode: message })
          .where(eq(campaignRecipients.id, recipient.recipientId));
        failed += 1;
      }
    }

    const [summary] = await db
      .select({
        sent: sql<number>`coalesce(sum(case when ${campaignRecipients.status} in ('sent','delivered','read') then 1 else 0 end), 0)`,
        delivered: sql<number>`coalesce(sum(case when ${campaignRecipients.status} in ('delivered','read') then 1 else 0 end), 0)`,
        read: sql<number>`coalesce(sum(case when ${campaignRecipients.status} = 'read' then 1 else 0 end), 0)`,
        failed: sql<number>`coalesce(sum(case when ${campaignRecipients.status} = 'failed' then 1 else 0 end), 0)`,
        remaining: sql<number>`coalesce(sum(case when ${campaignRecipients.status} in ('queued','sending') then 1 else 0 end), 0)`,
      })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, id));

    const remaining = Number(summary?.remaining ?? 0);
    const isComplete = remaining === 0;
    await db
      .update(campaigns)
      .set({
        status: isComplete ? "completed" : "sending",
        completedAt: isComplete ? new Date() : null,
        sentCount: Number(summary?.sent ?? 0),
        deliveredCount: Number(summary?.delivered ?? 0),
        readCount: Number(summary?.read ?? 0),
        failedCount: Number(summary?.failed ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id));

    if (isComplete) {
      await db.insert(auditLogs).values({
        actorUserId: user.id,
        action: "campaign.completed",
        entityType: "campaign",
        entityId: String(id),
        details: JSON.stringify(summary),
      });
    }

    return Response.json({
      batch: { sent, failed },
      summary: { ...summary, remaining },
      complete: isComplete,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
