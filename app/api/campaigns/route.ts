import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, campaignRecipients, campaigns, contacts } from "../../../db/schema";
import { ApiError, apiErrorResponse, requireAdmin, requireAppUser } from "../../../lib/auth";

export async function GET() {
  try {
    await requireAppUser();
    const db = getDb();
    const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(50);
    return Response.json({ campaigns: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    requireAdmin(user);
    const body = (await request.json()) as {
      title?: string;
      templateName?: string;
      templateLanguage?: string;
      includeNameParameter?: boolean;
      complianceConfirmed?: boolean;
    };
    const title = body.title?.trim() ?? "";
    const templateName = body.templateName?.trim() ?? "";
    if (title.length < 3 || !/^[a-z0-9_]+$/.test(templateName)) {
      throw new ApiError(400, "Informe um nome e um modelo válido do WhatsApp.", "INVALID_CAMPAIGN");
    }
    if (!body.complianceConfirmed) {
      throw new ApiError(400, "Confirme a revisão antes do disparo.", "REVIEW_REQUIRED");
    }

    const db = getDb();
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title,
        templateName,
        templateLanguage: body.templateLanguage?.trim() || "pt_BR",
        includeNameParameter: body.includeNameParameter !== false,
        status: "queued",
        createdBy: user.id,
      })
      .returning();

    const activeContacts = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.status, "active"));

    if (activeContacts.length > 0) {
      await db.insert(campaignRecipients).values(
        activeContacts.map((contact) => ({
          campaignId: campaign.id,
          contactId: contact.id,
          status: "queued" as const,
        })),
      );
    }

    const totalRecipients = activeContacts.length;
    await db
      .update(campaigns)
      .set({ totalRecipients, updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id));
    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: "campaign.queued",
      entityType: "campaign",
      entityId: String(campaign.id),
      details: JSON.stringify({ totalRecipients, templateName }),
    });

    return Response.json({ campaign: { ...campaign, totalRecipients } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
