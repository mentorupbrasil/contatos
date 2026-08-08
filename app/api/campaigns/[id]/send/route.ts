import { eq } from "drizzle-orm";
import { getDb, getRawDb } from "../../../../../db";
import { auditLogs, campaigns } from "../../../../../db/schema";
import { ApiError, apiErrorResponse, requireAdmin, requireAppUser } from "../../../../../lib/auth";
import { isWhatsAppConfigured, sendTemplateMessage } from "../../../../../lib/whatsapp";

type RecipientRow = { recipientId: number; name: string; phoneE164: string; attempts: number };

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAppUser();
    requireAdmin(user);
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) throw new ApiError(400, "Disparo inválido.", "INVALID_CAMPAIGN");
    const db = await getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!campaign) throw new ApiError(404, "Disparo não encontrado.", "CAMPAIGN_NOT_FOUND");
    if (["draft", "paused", "failed"].includes(campaign.status)) throw new ApiError(409, "Este disparo não está liberado para envio.", "CAMPAIGN_NOT_SENDABLE");
    if (!(await isWhatsAppConfigured())) throw new ApiError(503, "Configure as credenciais oficiais do WhatsApp antes de iniciar a fila.", "WHATSAPP_NOT_CONFIGURED");

    const raw = await getRawDb();
    const rows = await raw.prepare(`SELECT cr.id AS recipientId, cr.attempts AS attempts, c.name AS name, c.phone_e164 AS phoneE164
      FROM campaign_recipients cr
      INNER JOIN contacts c ON c.id = cr.contact_id
      WHERE cr.campaign_id = ? AND cr.status = 'queued' AND c.status = 'active'
      ORDER BY cr.id LIMIT 25`).bind(id).all<RecipientRow>();

    if (!campaign.startedAt) {
      await db.update(campaigns).set({ status: "sending", startedAt: new Date(), updatedAt: new Date() }).where(eq(campaigns.id, id));
    }

    let sent = 0;
    let failed = 0;
    for (const recipient of rows.results ?? []) {
      const claim = await raw.prepare("UPDATE campaign_recipients SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status = 'queued'").bind(recipient.recipientId).run();
      if (!claim.meta.changes) continue;
      try {
        const providerId = await sendTemplateMessage({
          to: recipient.phoneE164,
          templateName: campaign.templateName,
          language: campaign.templateLanguage,
          contactName: campaign.includeNameParameter ? recipient.name.split(" ")[0] : undefined,
        });
        await raw.prepare("UPDATE campaign_recipients SET status = 'sent', provider_message_id = ?, sent_at = ?, failure_code = NULL WHERE id = ?")
          .bind(providerId, Date.now(), recipient.recipientId).run();
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 220) : "Falha no envio";
        const retry = recipient.attempts + 1 < 3;
        await raw.prepare("UPDATE campaign_recipients SET status = ?, failure_code = ? WHERE id = ?")
          .bind(retry ? "queued" : "failed", message, recipient.recipientId).run();
        failed += 1;
      }
    }

    const summary = await raw.prepare(`SELECT
      SUM(CASE WHEN status IN ('sent','delivered','read') THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) + SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS read,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status IN ('queued','sending') THEN 1 ELSE 0 END) AS remaining
      FROM campaign_recipients WHERE campaign_id = ?`).bind(id).first<Record<string, number>>();
    const remaining = Number(summary?.remaining ?? 0);
    const isComplete = remaining === 0;
    await db.update(campaigns).set({
      status: isComplete ? "completed" : "sending",
      completedAt: isComplete ? new Date() : null,
      sentCount: Number(summary?.sent ?? 0),
      deliveredCount: Number(summary?.delivered ?? 0),
      readCount: Number(summary?.read ?? 0),
      failedCount: Number(summary?.failed ?? 0),
      updatedAt: new Date(),
    }).where(eq(campaigns.id, id));
    if (isComplete) await db.insert(auditLogs).values({ actorUserId: user.id, action: "campaign.completed", entityType: "campaign", entityId: String(id), details: JSON.stringify(summary) });
    return Response.json({ batch: { sent, failed }, summary: { ...summary, remaining }, complete: isComplete });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
