import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLatestMessage,
  saveIncomingMessage,
  type IncomingMessage,
} from "./messageStore.js";
import {
  sendText,
  sendTemplate,
  WhatsAppApiError,
  type SendTextInput,
  type SendTemplateInput,
} from "./whatsapp.js";

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: unknown[];
        contacts?: unknown[];
      };
    }>;
  }>;
}

export const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "../public");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(publicDirectory));

app.get("/", (_request: Request, response: Response) => {
  response.redirect("/tv.html");
});

app.get("/privacy", (_request: Request, response: Response) => {
  response.sendFile(path.join(publicDirectory, "privacy.html"));
});

app.get("/favicon.ico", (_request: Request, response: Response) => {
  response.redirect(301, "/favicon.svg");
});

app.get("/api/health", (_request: Request, response: Response) => {
  response.json({ status: "ok" });
});

app.get("/api/webhook", (request: Request, response: Response) => {
  console.log("[WEBHOOK] Verification request received");
  const mode = request.query["hub.mode"];
  const verifyToken = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    typeof verifyToken === "string" &&
    Boolean(process.env.WHATSAPP_VERIFY_TOKEN) &&
    verifyToken === process.env.WHATSAPP_VERIFY_TOKEN &&
    typeof challenge === "string"
  ) {
    console.log("[WEBHOOK] Verification successful");
    response.status(200).send(challenge);
    return;
  }

  response.sendStatus(403);
});

app.post("/api/webhook", async (request: Request, response: Response) => {
  try {
    const payload = request.body as MetaWebhookPayload;
    console.log("[WEBHOOK] received");
    console.log(`object: ${payload.object ?? "unknown"}`);

    let changeCount = 0;
    const messages =
      payload.entry?.flatMap((entry) =>
        entry.changes?.flatMap((change) => {
          changeCount += 1;
          const value = change.value;
          const hasMessages = Array.isArray(value?.messages);
          const messageCount = hasMessages ? value.messages!.length : 0;
          const firstMessage = hasMessages ? value.messages![0] : undefined;

          console.log(`field: ${change.field ?? "unknown"}`);
          console.log(`has value.messages: ${hasMessages}`);
          console.log(`message count: ${messageCount}`);
          console.log(`message type: ${firstMessage?.type ?? "none"}`);
          console.log(`has text.body: ${typeof firstMessage?.text?.body === "string"}`);
          console.log(`has statuses: ${Array.isArray(value?.statuses)}`);
          console.log(`has contacts: ${Array.isArray(value?.contacts)}`);

          if (!hasMessages) {
            console.log("[WEBHOOK] Ignored: no messages array");
          }

          return value?.messages ?? [];
        }) ?? [],
      ) ?? [];

    if (changeCount === 0) {
      console.log("[WEBHOOK] Ignored: no messages array");
    }

    for (const message of messages) {
      console.log(`message id: ${message.id ?? "missing"}`);
      console.log(`from: ${message.from ?? "missing"}`);
      console.log(`type: ${message.type ?? "missing"}`);
      console.log(`text body: ${message.text?.body ?? "missing"}`);

      if (message.type !== "text") {
        console.log(`[WEBHOOK] Ignored: unsupported message type ${message.type ?? "missing"}`);
        continue;
      }

      if (
        !message.id ||
        !message.from ||
        !message.timestamp ||
        typeof message.text?.body !== "string"
      ) {
        console.log("[WEBHOOK] Ignored: incomplete text message");
        continue;
      }

      const incomingMessage: IncomingMessage = {
        messageId: message.id,
        from: message.from,
        text: message.text.body,
        timestamp: message.timestamp,
        receivedAt: new Date().toISOString(),
      };

      console.log("[WHATSAPP] Incoming message");
      console.log(`From: ${incomingMessage.from}`);
      console.log(`Message: ${incomingMessage.text}`);
      await saveIncomingMessage(incomingMessage);
    }
  } catch (error) {
    console.error(
      "[WEBHOOK] Failed to process payload:",
      error instanceof Error ? error.message : error,
    );
  }

  response.sendStatus(200);
});

app.get("/api/messages/latest", async (_request: Request, response: Response) => {
  try {
    const message = await getLatestMessage();
    response.json({ success: true, message });
  } catch (error) {
    console.error(
      "[STORE] Failed to load latest message:",
      error instanceof Error ? error.message : error,
    );
    response.status(500).json({ success: false, error: "Message store unavailable" });
  }
});

app.post("/api/whatsapp/send-template", async (request: Request, response: Response) => {
  const fields: Array<keyof SendTemplateInput> = [
    "to",
    "customerName",
    "orderNumber",
    "date",
  ];
  const missing = fields.filter(
    (field) => typeof request.body?.[field] !== "string" || !request.body[field].trim(),
  );

  if (missing.length > 0) {
    response.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(", ")}`,
    });
    return;
  }

  const input = Object.fromEntries(
    fields.map((field) => [field, request.body[field].trim()]),
  ) as unknown as SendTemplateInput;

  try {
    const messageId = await sendTemplate(input);
    response.json({ success: true, messageId });
  } catch (error) {
    console.error("[WHATSAPP] Meta API failed");
    if (error instanceof WhatsAppApiError) {
      console.error(`Status: ${error.status}`);
      console.error("Error:", error.details);
    } else {
      console.error("Status: unavailable");
      console.error("Error:", error instanceof Error ? error.message : error);
    }
    response.status(502).json({ success: false, error: "Meta API request failed" });
  }
});

app.post("/api/whatsapp/send-text", async (request: Request, response: Response) => {
  const fields: Array<keyof SendTextInput> = ["to", "message"];
  const missing = fields.filter(
    (field) => typeof request.body?.[field] !== "string" || !request.body[field].trim(),
  );

  if (missing.length > 0) {
    response.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(", ")}`,
    });
    return;
  }

  const input: SendTextInput = {
    to: request.body.to.trim(),
    message: request.body.message.trim(),
  };

  try {
    const messageId = await sendText(input);
    response.json({ success: true, messageId });
  } catch (error) {
    console.error("[WHATSAPP] Meta API failed");
    if (error instanceof WhatsAppApiError) {
      console.error(`Status: ${error.status}`);
      console.error("Error:", error.details);
    } else {
      console.error("Status: unavailable");
      console.error("Error:", error instanceof Error ? error.message : error);
    }
    response.status(502).json({ success: false, error: "Meta API request failed" });
  }
});

export default app;
