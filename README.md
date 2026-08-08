# WhatsApp-Tizen-TV-POC

A small two-way proof of concept using a Samsung/Tizen-style browser simulator, Node.js, Express, the official Meta WhatsApp Cloud API, and HTTP polling.

## Two-Way WhatsApp POC

Outgoing:

```text
TV simulator -> Express backend -> Meta WhatsApp Cloud API -> WhatsApp phone
```

Incoming:

```text
WhatsApp phone -> Meta webhook -> Express backend -> latest-message store -> TV polling
```

The TV polls `GET /api/messages/latest` every two seconds. No WebSocket is used.

## Requirements

- Node.js 20 or newer
- A Meta WhatsApp Cloud API app, phone number ID, business account ID, and access token
- The approved `jaspers_market_order_confirmation_v1` template in `en_US`
- A recipient permitted by the Meta app while it is in development mode
- A Vercel account for the public HTTPS webhook
- A Supabase project with the `whatsapp_messages` table for durable incoming-message storage

## Local setup

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open <http://localhost:3000/tv.html>. Add the Supabase variables to `.env` to store and retrieve incoming messages.

### Local outgoing test

1. Add the Meta credentials to `.env`.
2. Start the app with `npm run dev`.
3. Open <http://localhost:3000/tv.html>.
4. Enter the allowed WhatsApp recipient and template fields.
5. Select **Send WhatsApp**.
6. Confirm the TV reports success and the terminal logs the returned Meta message ID.

## Environment variables

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_VERSION=v25.0

WHATSAPP_VERIFY_TOKEN=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

PORT=3000
```

`WHATSAPP_VERIFY_TOKEN` is a random secret you create. It is not the Meta access token. The Supabase service-role key is backend-only and must never be exposed to browser JavaScript.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, select **Add New > Project**, import the GitHub repository, and deploy it with the default Node.js settings.
3. In the Vercel project, open **Settings > Environment Variables** and add:
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_API_VERSION` (`v25.0`)
   - `WHATSAPP_VERIFY_TOKEN` (a random secret you create)
4. Create the `whatsapp_messages` table in Supabase, then add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Vercel project.
5. Redeploy after adding all environment variables and storage.
6. Verify:
   - `https://MY-APP.vercel.app/tv.html`
   - `https://MY-APP.vercel.app/api/health`
   - `https://MY-APP.vercel.app/api/messages/latest`

Supabase provides persistent storage shared by all Vercel function instances.

## Configure the Meta webhook

Meta requires a publicly accessible HTTPS callback, so use the deployed Vercel URL rather than localhost.

1. Open the app in **Meta for Developers**.
2. Open **WhatsApp > Configuration**.
3. Under **Webhook**, select **Edit** or **Configure**.
4. Set the callback URL to `https://MY-APP.vercel.app/api/webhook`.
5. Enter the exact same value used for `WHATSAPP_VERIFY_TOKEN` in Vercel.
6. Complete verification.
7. Subscribe the WhatsApp Business Account to the `messages` webhook field.

The verification request calls `GET /api/webhook`; incoming events call `POST /api/webhook`.

## Incoming end-to-end test

1. Keep `https://MY-APP.vercel.app/tv.html` open.
2. Send a WhatsApp message or reply from the registered test mobile.
3. Meta sends the event to `/api/webhook`.
4. The backend stores the incoming text message in Supabase Postgres.
5. The TV calls `/api/messages/latest` every two seconds.
6. Within approximately two seconds, a TV-style WhatsApp notification appears.
7. Select **Dismiss**. Polling the same message ID will not show it again; a new WhatsApp message will.

Delivery, sent, and read status events are ignored. Only incoming text messages are displayed.

## Build and production-style local run

```powershell
npm run build
npm start
```

The Meta access token and all other secrets remain server-side and are never sent to browser JavaScript.
