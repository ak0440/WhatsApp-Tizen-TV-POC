import { Redis } from "@upstash/redis";

export interface IncomingMessage {
  messageId: string;
  from: string;
  text: string;
  timestamp: string;
  receivedAt: string;
}

interface MessageStore {
  saveIncomingMessage(message: IncomingMessage): Promise<void>;
  getLatestMessage(): Promise<IncomingMessage | null>;
}

const LATEST_MESSAGE_KEY = "whatsapp-tizen-tv-poc:latest-message";

class MemoryMessageStore implements MessageStore {
  private latestMessage: IncomingMessage | null = null;

  async saveIncomingMessage(message: IncomingMessage): Promise<void> {
    this.latestMessage = message;
  }

  async getLatestMessage(): Promise<IncomingMessage | null> {
    return this.latestMessage;
  }
}

class UpstashMessageStore implements MessageStore {
  constructor(private readonly redis: Redis) {}

  async saveIncomingMessage(message: IncomingMessage): Promise<void> {
    await this.redis.set(LATEST_MESSAGE_KEY, message);
  }

  async getLatestMessage(): Promise<IncomingMessage | null> {
    return this.redis.get<IncomingMessage>(LATEST_MESSAGE_KEY);
  }
}

function createMessageStore(): MessageStore {
  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );

  if (hasUpstash) {
    console.log("[STORE] Using Upstash Redis");
    return new UpstashMessageStore(Redis.fromEnv());
  }

  if (process.env.VERCEL) {
    console.warn(
      "[STORE] Upstash Redis is not configured; incoming messages will not persist reliably on Vercel",
    );
  } else {
    console.log("[STORE] Using local in-memory storage");
  }

  return new MemoryMessageStore();
}

const messageStore = createMessageStore();

export async function saveIncomingMessage(message: IncomingMessage): Promise<void> {
  await messageStore.saveIncomingMessage(message);
  console.log("[STORE] Incoming message saved");
}

export async function getLatestMessage(): Promise<IncomingMessage | null> {
  return messageStore.getLatestMessage();
}
