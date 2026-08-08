import { getRawDb } from "../../../../db";
import { normalizeBrazilianPhone } from "../../../../lib/phone";
import { sendTextMessage, verifyWebhookSignature, webhookVerifyToken } from "../../../../lib/whatsapp";

type WebhookStatus = { id?: string; status?: "sent" | "delivered" | "read" | "failed"; errors?: Array<{ code?: number }> };
type WebhookMessage = { from?: string; type?: string; text?: { body?: string } };
type WebhookPayload = { entry?: Array<{ changes?: Array<{ value?: { statuses?: WebhookStatus[]; messages?: WebhookMessage[] } }> }> };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === await webhookVerifyToken()) return new Response(challenge ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const payload = JSON.parse(rawBody) as WebhookPayload;
  const raw = await getRawDb();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (!status.id || !status.status) continue;
        const timestamp = Date.now();
        if (status.status === "delivered") {
          await raw.prepare("UPDATE campaign_recipients SET status = 'delivered', delivered_at = ? WHERE provider_message_id = ? AND status IN ('sent','delivered')").bind(timestamp, status.id).run();
        } else if (status.status === "read") {
          await raw.prepare("UPDATE campaign_recipients SET status = 'read', read_at = ?, delivered_at = COALESCE(delivered_at, ?) WHERE provider_message_id = ?").bind(timestamp, timestamp, status.id).run();
        } else if (status.status === "failed") {
          await raw.prepare("UPDATE campaign_recipients SET status = 'failed', failure_code = ? WHERE provider_message_id = ?").bind(`WHATSAPP_${status.errors?.[0]?.code ?? "FAILED"}`, status.id).run();
        }
      }

      for (const message of change.value?.messages ?? []) {
        const body = message.text?.body?.trim().toLocaleUpperCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!message.from || !body || !["SAIR", "PARAR", "CANCELAR", "DESCADASTRAR"].includes(body)) continue;
        let phone: string;
        try { phone = normalizeBrazilianPhone(message.from); } catch { continue; }
        const contact = await raw.prepare("SELECT id FROM contacts WHERE phone_e164 = ? AND status = 'active'").bind(phone).first<{ id: number }>();
        if (!contact) continue;
        const now = Date.now();
        await raw.batch([
          raw.prepare("UPDATE contacts SET status = 'opted_out', opted_out_at = ?, updated_at = ? WHERE id = ?").bind(now, now, contact.id),
          raw.prepare("INSERT INTO consent_events (contact_id, kind, source, detail, created_at) VALUES (?, 'withdrawn', 'whatsapp', 'Solicitação recebida por palavra-chave', ?)").bind(contact.id, now),
          raw.prepare("INSERT INTO audit_logs (action, entity_type, entity_id, details, created_at) VALUES ('contact.opted_out', 'contact', ?, '{\"source\":\"whatsapp\"}', ?)").bind(String(contact.id), now),
        ]);
        try {
          await sendTextMessage(phone, "Pronto: seu número foi descadastrado e não receberá novos comunicados. Para solicitar a eliminação dos seus dados, use o canal de privacidade informado pela campanha.");
        } catch {
          // O descadastramento permanece válido mesmo se a confirmação falhar.
        }
      }
    }
  }
  return Response.json({ received: true });
}
