# WhatsApp-Tizen-TV-POC

A small local Level-1 proof of concept: browser-based TV simulator → local Express service → official Meta WhatsApp Cloud API.

## Requirements

- Node.js 20 or newer
- A Meta WhatsApp Cloud API app, phone number ID, business account ID, and access token
- The approved `jaspers_market_order_confirmation_v1` template in `en_US`
- The recipient number permitted by your Meta app (while the app is in development mode)

## Setup and run

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Fill `.env` before sending a message. Open <http://localhost:3000/tv.html>.

For a compiled production-style run:

```powershell
npm run build
npm start
```

The access token remains server-side and is never served to the browser.
