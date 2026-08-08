import "dotenv/config";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sendTemplate,
  WhatsAppApiError,
  type SendTemplateInput,
} from "./whatsapp.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "../public");

app.use(express.json({ limit: "10kb" }));
app.use(express.static(publicDirectory));

app.get("/api/health", (_request: Request, response: Response) => {
  response.json({ status: "ok" });
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

app.listen(port, () => {
  console.log(`[SERVER] Running on http://localhost:${port}`);
});
