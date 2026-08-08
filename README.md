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
- An Upstash Redis integration connected to the Vercel project for durable incoming-message storage

## Local setup

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open <http://localhost:3000/tv.html>. Local development uses an in-memory latest-message store unless Upstash variables are provided.

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

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

PORT=3000
```

`WHATSAPP_VERIFY_TOKEN` is a random secret you create. It is not the Meta access token. The Upstash variables are optional locally but required for reliable persistence across Vercel function instances.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, select **Add New > Project**, import the GitHub repository, and deploy it with the default Node.js settings.
3. In the Vercel project, open **Settings > Environment Variables** and add:
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_API_VERSION` (`v25.0`)
   - `WHATSAPP_VERIFY_TOKEN` (a random secret you create)
4. In the project, open **Storage**, create/connect **Upstash for Redis**, and ensure the integration supplies `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
5. Redeploy after adding all environment variables and storage.
6. Verify:
   - `https://MY-APP.vercel.app/tv.html`
   - `https://MY-APP.vercel.app/api/health`
   - `https://MY-APP.vercel.app/api/messages/latest`

Without Upstash, the app falls back to memory and incoming messages are not guaranteed to persist or be visible across Vercel instances.

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
4. The backend stores the latest incoming text message in Upstash Redis.
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
