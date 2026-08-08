import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditLogs, campaignRecipients, consentEvents, contacts } from "../../../../db/schema";
import { normalizeBrazilianPhone } from "../../../../lib/phone";
import { sendTextMessage, verifyWebhookSignature, webhookVerifyToken } from "../../../../lib/whatsapp";

type WebhookStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  errors?: Array<{ code?: number }>;
};
type WebhookMessage = { from?: string; type?: string; text?: { body?: string } };
type WebhookPayload = {
  entry?: Array<{ changes?: Array<{ value?: { statuses?: WebhookStatus[]; messages?: WebhookMessage[] } }> }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === webhookVerifyToken()) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as WebhookPayload;
  const db = getDb();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (!status.id || !status.status) continue;
        const now = new Date();
        if (status.status === "delivered") {
          await db
            .update(campaignRecipients)
            .set({ status: "delivered", deliveredAt: now })
            .where(
              and(
                eq(campaignRecipients.providerMessageId, status.id),
                inArray(campaignRecipients.status, ["sent", "delivered"]),
              ),
            );
        } else if (status.status === "read") {
          await db
            .update(campaignRecipients)
            .set({ status: "read", readAt: now, deliveredAt: now })
            .where(eq(campaignRecipients.providerMessageId, status.id));
        } else if (status.status === "failed") {
          await db
            .update(campaignRecipients)
            .set({
              status: "failed",
              failureCode: `WHATSAPP_${status.errors?.[0]?.code ?? "FAILED"}`,
            })
            .where(eq(campaignRecipients.providerMessageId, status.id));
        }
      }

      for (const message of change.value?.messages ?? []) {
        const body = message.text?.body
          ?.trim()
          .toLocaleUpperCase("pt-BR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!message.from || !body || !["SAIR", "PARAR", "CANCELAR", "DESCADASTRAR"].includes(body)) {
          continue;
        }

        let phone: string;
        try {
          phone = normalizeBrazilianPhone(message.from);
        } catch {
          continue;
        }

        const [contact] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.phoneE164, phone), eq(contacts.status, "active")))
          .limit(1);
        if (!contact) continue;

        const now = new Date();
        await db
          .update(contacts)
          .set({ status: "opted_out", optedOutAt: now, updatedAt: now })
          .where(eq(contacts.id, contact.id));
        await Promise.all([
          db.insert(consentEvents).values({
            contactId: contact.id,
            kind: "withdrawn",
            source: "whatsapp",
            detail: "Solicitação recebida por palavra-chave",
          }),
          db.insert(auditLogs).values({
            action: "contact.opted_out",
            entityType: "contact",
            entityId: String(contact.id),
            details: JSON.stringify({ source: "whatsapp" }),
          }),
        ]);

        try {
          await sendTextMessage(
            phone,
            "Pronto: seu número foi descadastrado e não receberá novos comunicados. Para solicitar a eliminação dos seus dados, use o canal de privacidade informado pela campanha.",
          );
        } catch {
          // O descadastramento permanece válido mesmo se a confirmação falhar.
        }
      }
    }
  }

  return Response.json({ received: true });
}
