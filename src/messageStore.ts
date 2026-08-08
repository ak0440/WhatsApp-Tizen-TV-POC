export interface IncomingMessage {
  messageId: string;
  from: string;
  text: string;
  timestamp: string;
  receivedAt: string;
}

interface SupabaseMessageRow {
  id: string;
  sender: string | null;
  message: string | null;
  whatsapp_timestamp: string | null;
  received_at: string;
}

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for incoming-message storage",
    );
  }

  return { url, serviceRoleKey };
}

function supabaseHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export async function saveIncomingMessage(message: IncomingMessage): Promise<void> {
  const config = getSupabaseConfig();
  const response = await fetch(
    `${config.url}/rest/v1/whatsapp_messages?on_conflict=id`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders(config.serviceRoleKey),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: message.messageId,
        sender: message.from,
        message: message.text,
        whatsapp_timestamp: message.timestamp,
        received_at: message.receivedAt,
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase message upsert failed (${response.status}): ${details}`);
  }

  console.log("[STORE] Incoming message saved");
}

export async function getLatestMessage(): Promise<IncomingMessage | null> {
  const config = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "id,sender,message,whatsapp_timestamp,received_at",
    order: "received_at.desc",
    limit: "1",
  });
  const response = await fetch(
    `${config.url}/rest/v1/whatsapp_messages?${query.toString()}`,
    {
      headers: supabaseHeaders(config.serviceRoleKey),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase latest-message query failed (${response.status}): ${details}`);
  }

  const rows = (await response.json()) as SupabaseMessageRow[];
  const row = rows[0];
  if (!row) return null;

  return {
    messageId: row.id,
    from: row.sender ?? "",
    text: row.message ?? "",
    timestamp: row.whatsapp_timestamp ?? "",
    receivedAt: row.received_at,
  };
}
