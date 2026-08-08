import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLatestMessage,
  saveIncomingMessage,
  type IncomingMessage,
} from "./messageStore.js";
import {
  sendTemplate,
  WhatsAppApiError,
  type SendTemplateInput,
} from "./whatsapp.js";

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
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
    const messages =
      payload.entry?.flatMap((entry) =>
        entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? [],
      ) ?? [];

    for (const message of messages) {
      if (
        message.type !== "text" ||
        !message.id ||
        !message.from ||
        !message.timestamp ||
        typeof message.text?.body !== "string"
      ) {
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

export default app;
