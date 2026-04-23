# WeedeN LINE Bot

Full-featured LINE Messaging API bot for WeedeN loyalty program.

## Features

- 🌐 **3 languages** — EN / RU / TH with auto-persist
- 🎁 **Loyalty flow** — phone → OTP → age/country → Odoo CRM → barcode card
- 📍 **Store finder** — geo or manual region, 3km radius search
- 💬 **Manager handoff** — AI-first, human on request / outside hours
- ⏰ **6 retention triggers** — all scheduled automatically per user

## Retention schedule

| Trigger | Delay | Condition |
|---|---|---|
| No action after welcome | 2 hours | Not started loyalty |
| No start at all | 5 min | No loyalty action |
| Phone entered, not finished | 5 min | Phone stored, not registered |
| Incomplete registration | 24 hours | Not registered |
| Registered, no store visit | 7 days | No CRM visit recorded |
| After store visit — feedback | 1 day | After CRM visit webhook |
| After store visit — promo | 3 days | After CRM visit webhook |
| Long inactivity | 14 days | No recent activity |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. LINE Developer Console
1. Go to https://developers.line.biz
2. Create a Messaging API channel
3. Set Webhook URL: `https://YOUR_DOMAIN/webhook`
4. Enable "Use webhooks"
5. Generate Channel Access Token (long-lived)
6. Copy Channel Secret and Access Token to `.env`

⚠️ **IMPORTANT**: Regenerate your Channel Secret and Access Token since they were shared. Do this in LINE Developer Console > Your Channel > Basic Settings / Messaging API.

### 4. Configure Odoo

The bot expects these custom fields on `res.partner`:
- `x_age` (Integer)
- `x_country_name` (Char)
- `x_line_user_id` (Char)

And a working `loyalty.card` model. Adjust field names in `src/odoo.js` to match your Odoo setup.

To trigger post-visit messages, configure Odoo to POST to:
```
POST https://YOUR_DOMAIN/crm/store-visit
Content-Type: application/json

{ "lineUserId": "U1234...", "storeId": "bkk-01" }
```

### 5. Add your stores

Edit `src/stores.js` → `STORES` array with your real store data:
```js
{
  id: 'unique-id',
  name: 'Store Name',
  address: 'Full address',
  lat: 13.7320,
  lng: 100.5674,
  hours: 'Mon–Sun 10:00–21:00',
  photoUrl: 'https://...',
  reviewUrl: 'https://g.page/r/...',
}
```

Or set `STORES_API_URL` in `.env` to load from an external API.

### 6. Run

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

## Deployment

### Railway / Render / Fly.io (recommended)
```bash
# Set environment variables in dashboard
# Deploy from GitHub repo
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### ngrok (local testing)
```bash
ngrok http 3000
# Use the https URL as your webhook in LINE console
```

## Project structure

```
weeden-line-bot/
├── src/
│   ├── index.js      # Express server + webhook
│   ├── handler.js    # All conversation logic
│   ├── messages.js   # LINE Flex Message builders
│   ├── store.js      # In-memory session store
│   ├── odoo.js       # Odoo CRM integration
│   ├── otp.js        # OTP send/verify
│   ├── stores.js     # Store DB + geo search
│   └── jobs.js       # Retention push schedulers
├── locales/
│   └── strings.js    # EN / RU / TH text strings
├── .env.example
├── package.json
└── README.md
```

## Production notes

- **Replace in-memory session store** (`src/store.js`) with Redis or PostgreSQL for multi-instance deployments
- **Add rate limiting** to the `/webhook` endpoint
- **Regenerate LINE credentials** — the ones in this repo are compromised
- **OTP provider**: plug in Twilio / AWS SNS / 2Factor in `src/otp.js` → `sendOtp()`
- **Barcode generation**: the bot uses Odoo's built-in barcode endpoint. Verify the URL format matches your Odoo version.
