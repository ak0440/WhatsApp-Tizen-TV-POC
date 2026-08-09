export interface SendTemplateInput {
  to: string;
  customerName: string;
  orderNumber: string;
  date: string;
}

export interface SendTextInput {
  to: string;
  message: string;
}

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
}

interface MetaSuccessResponse {
  messages?: Array<{ id?: string }>;
}

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

function getConfig(): WhatsAppConfig {
  const required = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
  ] as const;
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  if (!/^\d+$/.test(phoneNumberId)) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID must be Meta's numeric Phone Number ID, not a display phone number such as +91...",
    );
  }

  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!.trim(),
    phoneNumberId,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!.trim(),
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "v25.0",
  };
}

export function buildTemplatePayload(input: SendTemplateInput) {
  return {
    messaging_product: "whatsapp",
    to: input.to,
    type: "template",
    template: {
      name: "jaspers_market_order_confirmation_v1",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.customerName },
            { type: "text", text: input.orderNumber },
            { type: "text", text: input.date },
          ],
        },
      ],
    },
  };
}

export function buildTextPayload(input: SendTextInput) {
  return {
    messaging_product: "whatsapp",
    to: input.to,
    type: "text",
    text: {
      body: input.message,
    },
  };
}

export async function sendTemplate(input: SendTemplateInput): Promise<string> {
  const config = getConfig();
  const endpoint = `https://graph.facebook.com/${encodeURIComponent(config.apiVersion)}/${encodeURIComponent(config.phoneNumberId)}/messages`;

  console.log(`[WHATSAPP] Phone Number ID configuration validated (${config.phoneNumberId.length} digits)`);
  console.log(`[WHATSAPP] Sending message to ${input.to}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildTemplatePayload(input)),
  });

  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new WhatsAppApiError("Meta API request failed", response.status, responseBody);
  }

  const messageId = (responseBody as MetaSuccessResponse | null)?.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsAppApiError("Meta API returned no message ID", response.status, responseBody);
  }

  console.log("[WHATSAPP] Meta API success");
  console.log(`Message ID: ${messageId}`);
  return messageId;
}

export async function sendText(input: SendTextInput): Promise<string> {
  const config = getConfig();
  const endpoint = `https://graph.facebook.com/${encodeURIComponent(config.apiVersion)}/${encodeURIComponent(config.phoneNumberId)}/messages`;

  console.log(`[WHATSAPP] Phone Number ID configuration validated (${config.phoneNumberId.length} digits)`);
  console.log(`[WHATSAPP] Sending text message to ${input.to}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildTextPayload(input)),
  });

  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new WhatsAppApiError("Meta API request failed", response.status, responseBody);
  }

  const messageId = (responseBody as MetaSuccessResponse | null)?.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsAppApiError("Meta API returned no message ID", response.status, responseBody);
  }

  console.log("[WHATSAPP] Meta API success");
  console.log(`Message ID: ${messageId}`);
  return messageId;
}
