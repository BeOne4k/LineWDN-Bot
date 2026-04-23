// src/index.js
// WeedeN LINE Bot — Express server + LINE webhook

require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const { handleEvent } = require('./handler');
const jobs = require('./jobs');
const { onStoreVisit } = require('./jobs');

// ─── LINE client config ───────────────────────────────────────────────────────
const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
});

// ─── Init job scheduler ───────────────────────────────────────────────────────
jobs.init(client);

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();

// LINE webhook — must use raw body for signature validation
app.post(
  '/webhook',
  line.middleware(lineConfig),
  async (req, res) => {
    res.status(200).end(); // Acknowledge immediately (LINE requires <1s response)

    // Handle events asynchronously
    const events = req.body.events || [];
    for (const event of events) {
      try {
        await handleEvent(event, client);
      } catch (err) {
        console.error('[webhook] Event handling error:', err);
      }
    }
  }
);

// ─── CRM webhook — called by Odoo when a customer visits a store ──────────────
// Configure Odoo to POST to this endpoint when a loyalty card is scanned.
// Body: { lineUserId, storeId }
app.use(express.json());

app.post('/crm/store-visit', async (req, res) => {
  const { lineUserId, storeId } = req.body;
  if (!lineUserId || !storeId) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { getStoreById } = require('./stores');
    const store = await getStoreById(storeId);
    const reviewUrl = store?.reviewUrl || null;

    onStoreVisit(lineUserId, reviewUrl);
    res.json({ ok: true });
  } catch (e) {
    console.error('[crm-webhook]', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ WeedeN LINE Bot running on port ${PORT}`);
  console.log(`   Webhook: POST /webhook`);
  console.log(`   CRM hook: POST /crm/store-visit`);
  console.log(`   Health: GET /health`);
});
