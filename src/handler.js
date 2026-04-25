const { getSession, setSession } = require('./store');
const msgs = require('./messages');
const { findNearby, REGIONS } = require('./stores');

function safeMessages(...items) {
  return items.flat(Infinity).filter(m => m && typeof m === 'object');
}

async function reply(client, token, event, ...items) {
  const messages = safeMessages(...items);
  if (!messages.length) return;

  try {
    if (token) {
      return await client.replyMessage(token, messages);
    }
  } catch (e) {
    console.error('reply failed:', e.message);
  }

  console.log('No replyToken → skip (NO PUSH IN CHAT FLOW)');
}

async function handleEvent(event, client) {
  console.log("🔥 MICRO BOT EVENT:");
  console.log(JSON.stringify(event, null, 2));

  const userId = event.source?.userId;
  const replyToken = event.replyToken;

  console.log("USER:", userId);
  console.log("REPLY TOKEN:", replyToken);
  console.log("MODE:", event.mode);

  // ❗ пробуем только replyMessage если есть token
  if (replyToken) {
    try {
      await client.replyMessage(replyToken, {
        type: "text",
        text: "👋 micro bot replyMessage works"
      });

      console.log("✅ replyMessage SUCCESS");
      return;
    } catch (err) {
      console.error("❌ replyMessage FAILED:", err.message);
    }
  }

  // fallback push
  if (userId) {
    try {
      await client.pushMessage(userId, {
        type: "text",
        text: "📨 micro bot pushMessage works"
      });

      console.log("✅ pushMessage SUCCESS");
    } catch (err) {
      console.error("❌ pushMessage FAILED:", err.message);
    }
  }
}

async function onFollow(event, client) {
  const userId = event.source.userId;
  setSession(userId, { step: 'MENU' });

  return reply(client, event.replyToken, event,
    msgs.languageSelectorMessage()
  );
}

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

    return reply(client, event.replyToken, event,
      { type: 'text', text: msgs.t(newLang, 'languageSet') },
      msgs.welcomeMessage(newLang)
    );
  }

  if (text === 'MENU') {
    return reply(client, event.replyToken, event,
      msgs.welcomeMessage(lang)
    );
  }

  if (text === 'SELECT_REGION') {
    const regions = Object.keys(REGIONS);

    return reply(client, event.replyToken, event, {
      type: 'text',
      text: msgs.t(lang, 'selectRegion'),
      quickReply: {
        items: regions.map(r => ({
          type: 'action',
          action: {
            type: 'message',
            label: r,
            text: `REGION:${r}`
          }
        }))
      }
    });
  }

  if (text.startsWith('REGION:')) {
    const region = text.split(':')[1];
    const coords = REGIONS[region];

    if (!coords) return;

    return showNearby(client, event, coords, lang);
  }

  return reply(client, event.replyToken, event,
    msgs.welcomeMessage(lang)
  );
}

async function showNearby(client, event, coords, lang) {
  const nearby = await findNearby(coords.lat, coords.lng, 3);

  if (!nearby.length) {
    return reply(client, event.replyToken, event, {
      type: 'text',
      text: msgs.t(lang, 'noStoresFound')
    });
  }

  return reply(
    client,
    event.replyToken,
    event,
    ...nearby.flatMap(s => msgs.storeCardMessage(lang, s))
  );
}

module.exports = { handleEvent };