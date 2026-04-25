require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const { handleEvent } = require('./handler');
const jobs = require('./jobs');

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);

jobs.init(client);

const app = express();

app.post('/webhook', line.middleware(config), async (req, res) => {
  res.sendStatus(200);

  const events = req.body.events || [];

  for (const event of events) {
    try {
      await handleEvent(event, client);
    } catch (err) {
      console.error('[webhook error]', err);
    }
  }
});

app.use(express.json());

app.post('/crm/store-visit', async (req, res) => {
  const { lineUserId, storeId } = req.body;

  if (!lineUserId || !storeId) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const { getStoreById } = require('./stores');
    const store = await getStoreById(storeId);

    if (store) {
      await client.pushMessage(lineUserId, [
        {
          type: 'text',
          text: `You visited: ${store.name}`,
        },
      ]);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[crm]', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

app.get('/health', (_, res) =>
  res.json({ ok: true, ts: Date.now() })
);

app.listen(3000, () => {
  console.log('Bot running on port 3000');
});