// src/handler.js

const { getSession, setSession } = require('./store');
const msgs = require('./messages');
const { findNearby, getStoreById, REGIONS } = require('./stores');

// ─── utils ───────────────────────────────────────────────
function safeMessages(...items) {
  return items
    .flat(Infinity)
    .filter(m => m && typeof m === 'object' && m.type);
}

// FIXED reply (stable + fallback)
async function reply(client, token, event, ...items) {
  const messages = safeMessages(...items);

  if (!messages.length) return;

  // 1. normal reply
  if (token) {
    try {
      return await client.replyMessage(token, messages);
    } catch (err) {
      console.error("replyMessage failed:", err.message);
    }
  }

  // 2. fallback push
  const userId = event?.source?.userId;

  if (userId) {
    try {
      console.log("➡️ pushMessage fallback:", userId);
      return await client.pushMessage(userId, messages);
    } catch (err) {
      console.error("pushMessage failed:", err.message);
    }
  }

  console.log("❌ No replyToken and no userId");
}

// ─── MAIN HANDLER ───────────────────────────────────────
async function handleEvent(event, client) {
  try {
    console.log("EVENT:", JSON.stringify(event, null, 2));

    const type = event.type;

    if (type === 'message') {
      const msgType = event.message?.type;

      if (msgType === 'text') return onText(event, client);
      if (msgType === 'location') return onLocation(event, client);

      console.log("Unsupported message type:", msgType);
      return;
    }

    if (type === 'follow') return onFollow(event, client);
    if (type === 'postback') return onPostback(event, client);

  } catch (err) {
    console.error("🔥 HANDLE ERROR:", err);
  }
}

// ─── FOLLOW ─────────────────────────────────────────────
async function onFollow(event, client) {
  const userId = event.source.userId;

  setSession(userId, { step: 'SELECT_LANG' });

  return reply(
    client,
    event.replyToken,
    event,
    msgs.languageSelectorMessage()
  );
}

// ─── TEXT ───────────────────────────────────────────────
async function onText(event, client) {
  const userId = event.source.userId;
  const text = event.message.text.trim();
  const s = getSession(userId);
  const lang = s.lang || 'en';

  if (['LANG_EN', 'LANG_RU', 'LANG_TH'].includes(text)) {
    const newLang =
      text === 'LANG_EN' ? 'en' :
      text === 'LANG_RU' ? 'ru' : 'th';

    setSession(userId, { lang: newLang, step: 'MENU' });

    return reply(
      client,
      event.replyToken,
      event,
      { type: 'text', text: msgs.t(newLang, 'languageSet') },
      msgs.welcomeMessage(newLang)
    );
  }

  if (text === 'MENU') {
    setSession(userId, { step: 'MENU' });

    return reply(
      client,
      event.replyToken,
      event,
      msgs.welcomeMessage(lang)
    );
  }

  if (text === 'LOYALTY') {
    setSession(userId, { step: 'LOYALTY_INTRO' });

    return reply(
      client,
      event.replyToken,
      event,
      msgs.loyaltyIntroMessage(lang)
    );
  }

  if (text === 'START_LOYALTY') {
    setSession(userId, { step: 'ASK_PHONE' });

    return reply(
      client,
      event.replyToken,
      event,
      { type: 'text', text: msgs.t(lang, 'askPhone') }
    );
  }

  if (text === 'SELECT_REGION') {
    const regions = Object.keys(REGIONS);

    return reply(
      client,
      event.replyToken,
      event,
      {
        type: 'text',
        text: msgs.t(lang, 'selectRegion'),
        quickReply: msgs.quickReplies(
          regions.map(r => ({
            type: 'message',
            label: r,
            text: `REGION:${r}`
          }))
        )
      }
    );
  }

  if (text.startsWith('REGION:')) {
    const region = text.split(':')[1];
    const coords = REGIONS[region];

    if (!coords) {
      return reply(
        client,
        event.replyToken,
        event,
        { type: 'text', text: msgs.t(lang, 'error') }
      );
    }

    return showNearbyStores(
      userId,
      coords.lat,
      coords.lng,
      lang,
      client,
      event.replyToken,
      event
    );
  }

  return reply(
    client,
    event.replyToken,
    event,
    msgs.welcomeMessage(lang)
  );
}

// ─── LOCATION ───────────────────────────────────────────
async function onLocation(event, client) {
  const userId = event.source.userId;
  const s = getSession(userId);

  return showNearbyStores(
    userId,
    event.message.latitude,
    event.message.longitude,
    s.lang || 'en',
    client,
    event.replyToken,
    event
  );
}

// ─── NEARBY ─────────────────────────────────────────────
async function showNearbyStores(userId, lat, lng, lang, client, token, event) {
  const nearby = await findNearby(lat, lng, 3);

  if (!nearby.length) {
    return reply(
      client,
      token,
      event,
      { type: 'text', text: msgs.t(lang, 'noStoresFound') }
    );
  }

  const messages = nearby
    .slice(0, 3)
    .flatMap(s => msgs.storeCardMessage(lang, s));

  return reply(client, token, event, ...messages);
}

// ─── FOLLOW / POSTBACK ──────────────────────────────────
async function onFollow(event, client) {
  const userId = event.source.userId;

  setSession(userId, { step: 'SELECT_LANG' });

  return reply(
    client,
    event.replyToken,
    event,
    msgs.languageSelectorMessage()
  );
}

async function onPostback(event, client) {
  const data = event.postback?.data;
  if (!data) return;

  await onText(
    { ...event, message: { type: 'text', text: data } },
    client
  );
}

module.exports = { handleEvent };