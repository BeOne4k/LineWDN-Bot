// src/handler.js
// Main message handler — routes all LINE events through the conversation flow.

const { getSession, setSession } = require('./store');
const msgs = require('./messages');
const { sendOtp, verifyOtp } = require('./otp');
const odoo = require('./odoo');
const { findNearby, getStoreById, mapsUrl, REGIONS } = require('./stores');
const jobs = require('./jobs');

const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
const OTP_MAX_ATTEMPTS = 3;

// ─── Check working hours (10–18 local server time) ────────────────────────────
function isWorkingHours() {
  const h = new Date().getHours();
  return h >= 10 && h < 18;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handleEvent(event, client) {
  if (event.type === 'follow') return onFollow(event, client);
  if (event.type === 'message' && event.message.type === 'text') return onText(event, client);
  if (event.type === 'message' && event.message.type === 'location') return onLocation(event, client);
  if (event.type === 'postback') return onPostback(event, client);
}

// ─── User follows / joins ─────────────────────────────────────────────────────
async function onFollow(event, client) {
  const userId = event.source.userId;
  const s = getSession(userId);
  setSession(userId, { step: 'SELECT_LANG' });

  await client.replyMessage(event.replyToken, msgs.languageSelectorMessage());

  // Schedule "no action" reminder
  jobs.scheduleNoStartReminder(userId);
}

// ─── Text messages ────────────────────────────────────────────────────────────
async function onText(event, client) {
  const userId = event.source.userId;
  const text = event.message.text.trim();
  const s = getSession(userId);
  const lang = s.lang;

  const reply = (...m) => client.replyMessage(event.replyToken, m.flat());

  // ─── Language selection ──────────────────────────────────────────────────
  if (['LANG_EN', 'LANG_RU', 'LANG_TH'].includes(text)) {
    const newLang = text === 'LANG_EN' ? 'en' : text === 'LANG_RU' ? 'ru' : 'th';
    setSession(userId, { lang: newLang, step: 'MENU' });

    await reply(
      { type: 'text', text: msgs.t(newLang, 'languageSet') },
      ...msgs.welcomeMessage(newLang)
    );

    jobs.scheduleNoActionReminder(userId);
    jobs.scheduleIncompleteReminder(userId);
    return;
  }

  // ─── Main menu navigation ────────────────────────────────────────────────
  if (text === 'MENU') {
    setSession(userId, { step: 'MENU' });
    return reply(...msgs.welcomeMessage(lang));
  }

  if (text === 'LOYALTY' || text === msgs.t(lang, 'welcomeButtons')[0]) {
    setSession(userId, { step: 'LOYALTY_INTRO' });
    return reply(msgs.loyaltyIntroMessage(lang));
  }

  if (text === 'START_LOYALTY') {
    setSession(userId, { step: 'ASK_PHONE' });
    return reply({ type: 'text', text: msgs.t(lang, 'askPhone') });
  }

  if (text === 'FIND_STORE' || text === msgs.t(lang, 'welcomeButtons')[1]) {
    setSession(userId, { step: 'FIND_STORE' });
    return reply({
      type: 'text',
      text: msgs.t(lang, 'storeSearchIntro'),
      quickReply: msgs.quickReplies([
        { type: 'location', label: msgs.t(lang, 'sendLocationBtn') },
        { type: 'message', label: msgs.t(lang, 'selectRegionBtn'), text: 'SELECT_REGION' },
      ]),
    });
  }

  if (text === 'SELECT_REGION') {
    const regions = Object.keys(REGIONS);
    return reply({
      type: 'text',
      text: msgs.t(lang, 'selectRegion'),
      quickReply: msgs.quickReplies(regions.map(r => ({ type: 'message', label: r, text: `REGION:${r}` }))),
    });
  }

  if (text.startsWith('REGION:')) {
    const regionName = text.split(':')[1];
    const coords = REGIONS[regionName];
    if (coords) return showNearbyStores(userId, coords.lat, coords.lng, lang, reply);
    return reply({ type: 'text', text: msgs.t(lang, 'error') });
  }

  if (text === 'MANAGER' || text === msgs.t(lang, 'welcomeButtons')[2]) {
    setSession(userId, { step: 'MANAGER' });
    return reply(msgs.managerIntroMessage(lang, isWorkingHours()));
  }

  if (text === 'ABOUT' || text === msgs.t(lang, 'welcomeButtons')[3]) {
    return reply(msgs.textWithMenu(lang, msgs.t(lang, 'aboutText')));
  }

  // ─── Store info / route ──────────────────────────────────────────────────
  if (text.startsWith('STORE_INFO:')) {
    const storeId = text.split(':')[1];
    const store = await getStoreById(storeId);
    if (!store) return reply({ type: 'text', text: msgs.t(lang, 'error') });
    setSession(userId, { visitedStoreId: storeId });
    await reply(...msgs.storeCardMessage(lang, store));
    // Reminder: show card
    await client.pushMessage(userId, { type: 'text', text: msgs.t(lang, 'showCardReminder') });
    return;
  }

  if (text.startsWith('STORE_ROUTE:')) {
    const storeId = text.split(':')[1];
    const store = await getStoreById(storeId);
    if (!store) return reply({ type: 'text', text: msgs.t(lang, 'error') });
    setSession(userId, { visitedStoreId: storeId });
    await reply({
      type: 'text',
      text: msgs.t(lang, 'showCardReminder'),
    }, {
      type: 'text',
      text: mapsUrl(store),
    });
    return;
  }

  // ─── OTP resend ───────────────────────────────────────────────────────────
  if (text === 'RESEND_OTP') {
    if (!s.phone) return reply({ type: 'text', text: msgs.t(lang, 'error') });
    const { code, expiry } = await sendOtp(s.phone);
    setSession(userId, { otpCode: code, otpExpiry: expiry, otpAttempts: 0 });
    return reply({ type: 'text', text: msgs.t(lang, 'otpSent', { phone: s.phone }) });
  }

  if (text === 'CANCEL') {
    setSession(userId, { step: 'MENU', phone: null, otpCode: null, otpAttempts: 0 });
    return reply(...msgs.welcomeMessage(lang));
  }

  // ─── Country selection ────────────────────────────────────────────────────
  if (text.startsWith('COUNTRY:') && s.step === 'ASK_COUNTRY') {
    const country = text.replace('COUNTRY:', '').trim();
    setSession(userId, { country, step: 'COMPLETING' });
    return await completeRegistration(userId, lang, reply, client);
  }

  // ─── Step-based input handling ────────────────────────────────────────────
  switch (s.step) {
    case 'ASK_PHONE': {
      if (!PHONE_REGEX.test(text)) {
        return reply({ type: 'text', text: msgs.t(lang, 'invalidPhone') });
      }
      const { code, expiry } = await sendOtp(text);
      setSession(userId, {
        phone: text,
        otpCode: code,
        otpExpiry: expiry,
        otpAttempts: 0,
        step: 'ASK_OTP',
      });
      jobs.schedulePhoneEnteredReminder(userId);
      return reply({ type: 'text', text: msgs.t(lang, 'otpSent', { phone: text }) });
    }

    case 'ASK_OTP': {
      const result = verifyOtp(text, s.otpCode, s.otpExpiry);
      if (result === 'expired') {
        setSession(userId, { step: 'ASK_PHONE' });
        return reply(msgs.otpResendMessage(lang, msgs.t(lang, 'otpExpired')));
      }
      if (result === 'invalid') {
        const attempts = (s.otpAttempts || 0) + 1;
        setSession(userId, { otpAttempts: attempts });
        if (attempts >= OTP_MAX_ATTEMPTS) {
          setSession(userId, { step: 'MENU', otpAttempts: 0 });
          return reply({ type: 'text', text: msgs.t(lang, 'otpBlocked') });
        }
        return reply({
          type: 'text',
          text: msgs.t(lang, 'otpInvalid', { attempts: OTP_MAX_ATTEMPTS - attempts }),
        });
      }
      // OTP ok
      setSession(userId, { step: 'ASK_AGE', otpAttempts: 0 });
      return reply({ type: 'text', text: msgs.t(lang, 'askAge') });
    }

    case 'ASK_AGE': {
      const age = parseInt(text, 10);
      if (isNaN(age) || age < 1 || age > 120) {
        return reply({ type: 'text', text: msgs.t(lang, 'invalidAge') });
      }
      setSession(userId, { age, step: 'ASK_COUNTRY' });
      return reply(msgs.countryPickerMessage(lang));
    }

    case 'MANAGER': {
      if (isWorkingHours()) {
        // AI → human handoff logic placeholder
        // For now: inform manager via push/notification system
        console.log(`[manager] User ${userId} message: ${text}`);
        return reply({ type: 'text', text: msgs.t(lang, 'messageSaved') });
      } else {
        return reply({ type: 'text', text: msgs.t(lang, 'messageSaved') });
      }
    }

    default: {
      // First interaction — show language selector if step is START
      if (s.step === 'START' || !s.lang) {
        return reply(msgs.languageSelectorMessage());
      }
      // Fallback: show menu
      return reply(...msgs.welcomeMessage(lang));
    }
  }
}

// ─── Location message ─────────────────────────────────────────────────────────
async function onLocation(event, client) {
  const userId = event.source.userId;
  const s = getSession(userId);
  const { latitude, longitude } = event.message;

  const reply = (...m) => client.replyMessage(event.replyToken, m.flat());
  return showNearbyStores(userId, latitude, longitude, s.lang, reply);
}

// ─── Show nearby stores ───────────────────────────────────────────────────────
async function showNearbyStores(userId, lat, lng, lang, reply) {
  const nearby = await findNearby(lat, lng, 3);
  if (!nearby.length) {
    return reply({ type: 'text', text: msgs.t(lang, 'noStoresFound') });
  }
  // Show up to 3 stores
  const toShow = nearby.slice(0, 3);
  const allMsgs = toShow.flatMap(s => msgs.storeCardMessage(lang, s));
  return reply(...allMsgs);
}

// ─── Complete registration ────────────────────────────────────────────────────
async function completeRegistration(userId, lang, reply, client) {
  const s = getSession(userId);
  try {
    const result = await odoo.registerUser({
      phone: s.phone,
      age: s.age,
      country: s.country,
      lineUserId: userId,
    });

    setSession(userId, {
      crmId: result.partnerId,
      registered: true,
      step: 'DONE',
    });

    jobs.onRegistered(userId);

    // Find nearest store for the welcome message
    // (We don't have location yet, so show a generic nearest or first store)
    const { getAllStores } = require('./stores');
    const allStores = await getAllStores();
    const nearest = allStores[0];

    const barcodeUrl = odoo.getBarcodeImageUrl(result.barcode);

    const replyMsgs = msgs.loyaltyCardMessages(lang, {
      clientId: result.clientId,
      barcodeUrl,
      storeName: nearest?.name || 'WeedeN Store',
      storeId: nearest?.id || '',
    });

    if (result.isNew) {
      return reply(...replyMsgs);
    } else {
      // Existing user
      return reply(
        { type: 'text', text: msgs.t(lang, 'userExists') },
        { type: 'image', originalContentUrl: barcodeUrl, previewImageUrl: barcodeUrl },
        msgs.nearestStorePromptMessage(lang, nearest?.name, nearest?.id),
      );
    }

  } catch (err) {
    console.error('[registration] CRM error:', err.message);
    setSession(userId, { step: 'MENU' });
    return reply({ type: 'text', text: msgs.t(lang, 'crmError') });
  }
}

// ─── Postback events ──────────────────────────────────────────────────────────
async function onPostback(event, client) {
  // Handle rich menu postbacks if configured
  const data = event.postback?.data;
  if (!data) return;
  // Re-use text handler logic by simulating a text message
  await onText({ ...event, message: { type: 'text', text: data } }, client);
}

module.exports = { handleEvent };
