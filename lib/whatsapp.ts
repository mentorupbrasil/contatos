type RuntimeEnv = {
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_API_VERSION?: string;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
};

async function runtimeEnv() {
  const workers = await import("cloudflare:workers");
  return workers.env as unknown as RuntimeEnv;
}

async function configuration() {
  const values = await runtimeEnv();
  const accessToken = values.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = values.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = values.WHATSAPP_GRAPH_API_VERSION?.trim();
  if (!accessToken || !phoneNumberId || !graphVersion) {
    throw new Error("WhatsApp Cloud API ainda não foi configurada.");
  }
  return { accessToken, phoneNumberId, graphVersion };
}

export async function isWhatsAppConfigured() {
  try {
    await configuration();
    return true;
  } catch {
    return false;
  }
}

async function send(payload: Record<string, unknown>) {
  const config = await configuration();
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
  });
  const result = (await response.json()) as { messages?: Array<{ id?: string }>; error?: { code?: number; message?: string } };
  if (!response.ok || !result.messages?.[0]?.id) {
    const code = result.error?.code ? String(result.error.code) : String(response.status);
    throw new Error(`WHATSAPP_${code}: ${result.error?.message ?? "Falha no envio"}`);
  }
  return result.messages[0].id as string;
}

export function sendTemplateMessage(input: {
  to: string;
  templateName: string;
  language: string;
  contactName?: string;
}) {
  const components = input.contactName
    ? [{ type: "body", parameters: [{ type: "text", text: input.contactName }] }]
    : undefined;
  return send({
    to: input.to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.language },
      ...(components ? { components } : {}),
    },
  });
}

export function sendTextMessage(to: string, body: string) {
  return send({ to: to.replace(/^\+/, ""), type: "text", text: { preview_url: false, body } });
}

export async function webhookVerifyToken() {
  return (await runtimeEnv()).WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
}

export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = (await runtimeEnv()).WHATSAPP_APP_SECRET?.trim();
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const actual = signatureHeader.slice(7).toLowerCase();
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  return mismatch === 0;
}
