// src/messages.js
// LINE message builders — Flex Messages, Quick Replies, image messages, etc.

const strings = require('../locales/strings');

function t(lang, key, vars = {}) {
  let str = (strings[lang] || strings.en)[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// ─── Quick reply buttons ───────────────────────────────────────────────────────
function quickReplies(items) {
  return {
    items: items.map(i => ({
      type: 'action',
      action: typeof i === 'string'
        ? { type: 'message', label: i, text: i }
        : i,
    })),
  };
}

// ─── Language selector ────────────────────────────────────────────────────────
function languageSelectorMessage() {
  return {
    type: 'flex',
    altText: 'Welcome to WeedeN! Please choose your language.',
    contents: {
      type: 'bubble',
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: '🌿 WeedeN',
          size: 'xl',
          weight: 'bold',
          align: 'center',
          color: '#2D7A4F',
        }],
        paddingAll: '20px',
        backgroundColor: '#F0FFF4',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'Welcome! Please choose your language.', wrap: true, align: 'center', color: '#333333' },
          { type: 'text', text: 'Добро пожаловать! Выберите язык.', wrap: true, align: 'center', color: '#555555', size: 'sm' },
          { type: 'text', text: 'ยินดีต้อนรับ! กรุณาเลือกภาษา', wrap: true, align: 'center', color: '#555555', size: 'sm' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          btnAction('🇬🇧 English', 'LANG_EN'),
          btnAction('🇷🇺 Русский', 'LANG_RU'),
          btnAction('🇹🇭 ภาษาไทย', 'LANG_TH'),
        ],
      },
    },
  };
}

// ─── Welcome message with rich menu hint ─────────────────────────────────────
function welcomeMessage(lang) {
  return [
    {
      type: 'text',
      text: t(lang, 'welcome'),
    },
    {
      type: 'flex',
      altText: t(lang, 'welcomeButtons')[0],
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            btnAction(t(lang, 'welcomeButtons')[0], 'LOYALTY'),
            btnAction(t(lang, 'welcomeButtons')[1], 'FIND_STORE'),
            btnAction(t(lang, 'welcomeButtons')[2], 'MANAGER'),
            btnAction(t(lang, 'welcomeButtons')[3], 'ABOUT'),
          ],
        },
      },
    },
  ];
}

// ─── Loyalty intro ────────────────────────────────────────────────────────────
function loyaltyIntroMessage(lang) {
  return {
    type: 'flex',
    altText: t(lang, 'loyaltyIntro'),
    contents: {
      type: 'bubble',
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🎁', size: '3xl', align: 'center' },
          { type: 'text', text: '-30%', size: '4xl', weight: 'bold', align: 'center', color: '#E53E3E' },
          { type: 'text', text: 'bonus', size: 'md', align: 'center', color: '#2D7A4F' },
        ],
        paddingAll: '20px',
        backgroundColor: '#FFF5F5',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [{
          type: 'text',
          text: t(lang, 'loyaltyIntro'),
          wrap: true,
          color: '#333333',
        }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [btnAction(t(lang, 'loyaltyStartBtn'), 'START_LOYALTY')],
      },
    },
  };
}

// ─── Country picker ───────────────────────────────────────────────────────────
function countryPickerMessage(lang) {
  const countries = t(lang, 'countryList');
  return {
    type: 'text',
    text: t(lang, 'askCountry'),
    quickReply: quickReplies(countries.map(c => ({ type: 'message', label: c, text: `COUNTRY:${c}` }))),
  };
}

// ─── Loyalty card (barcode) ───────────────────────────────────────────────────
function loyaltyCardMessages(lang, { clientId, barcodeUrl, storeName, storeId }) {
  return [
    {
      type: 'text',
      text: t(lang, 'registrationSuccess'),
    },
    {
      type: 'text',
      text: t(lang, 'cardId', { id: clientId }),
    },
    // Barcode image
    {
      type: 'image',
      originalContentUrl: barcodeUrl,
      previewImageUrl: barcodeUrl,
    },
    // Nearest store prompt
    nearestStorePromptMessage(lang, storeName, storeId),
  ];
}

// ─── Nearest store prompt (shown right after registration) ───────────────────
function nearestStorePromptMessage(lang, storeName, storeId) {
  return {
    type: 'flex',
    altText: t(lang, 'nearestStoreMsg'),
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '📍', size: 'xl', align: 'center' },
          { type: 'text', text: t(lang, 'nearestStoreMsg'), wrap: true, weight: 'bold', align: 'center' },
          { type: 'text', text: storeName || 'WeedeN Store', wrap: true, align: 'center', color: '#2D7A4F' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          btnAction(t(lang, 'openStoreInfo'), `STORE_INFO:${storeId}`, 'secondary'),
          btnAction(t(lang, 'buildRoute'), `STORE_ROUTE:${storeId}`, 'primary'),
        ],
      },
    },
  };
}

// ─── Store card ───────────────────────────────────────────────────────────────
function storeCardMessage(lang, store) {
  const msgs = [];

  // Photo (if available)
  if (store.photoUrl && store.photoUrl.startsWith('https://')) {
    msgs.push({
      type: 'image',
      originalContentUrl: store.photoUrl,
      previewImageUrl: store.photoUrl,
    });
  }

  msgs.push({
    type: 'flex',
    altText: store.name,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `🌿 ${store.name}`, weight: 'bold', size: 'lg', color: '#2D7A4F' },
          { type: 'text', text: `📍 ${store.address}`, wrap: true, size: 'sm', color: '#555555' },
          { type: 'text', text: `⏰ ${store.hours}`, size: 'sm', color: '#555555' },
          ...(store.distance != null ? [{ type: 'text', text: `📏 ${store.distance.toFixed(1)} km`, size: 'sm', color: '#888888' }] : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: t(lang, 'openMapBtn'), uri: `STORE_ROUTE:${store.id}` },
            style: 'primary',
            color: '#2D7A4F',
          },
          btnAction(t(lang, 'openStoreInfo'), `STORE_INFO:${store.id}`, 'secondary'),
        ],
      },
    },
  });

  return msgs;
}

// ─── OTP resend button ────────────────────────────────────────────────────────
function otpResendMessage(lang, text) {
  return {
    type: 'text',
    text,
    quickReply: quickReplies([
      { type: 'message', label: t(lang, 'otpResend'), text: 'RESEND_OTP' },
      { type: 'message', label: t(lang, 'cancel'), text: 'CANCEL' },
    ]),
  };
}

// ─── Generic button ───────────────────────────────────────────────────────────
function btnAction(label, data, style = 'primary') {
  return {
    type: 'button',
    action: { type: 'message', label, text: data },
    style,
    color: style === 'primary' ? '#2D7A4F' : undefined,
  };
}

// ─── Simple text with main menu quick reply ───────────────────────────────────
function textWithMenu(lang, text) {
  return {
    type: 'text',
    text,
    quickReply: quickReplies([
      { type: 'message', label: t(lang, 'mainMenu'), text: 'MENU' },
    ]),
  };
}

// ─── Manager messages ─────────────────────────────────────────────────────────
function managerIntroMessage(lang, isWorkingHours) {
  const body = isWorkingHours ? t(lang, 'managerIntro') : t(lang, 'outsideHours');
  return {
    type: 'text',
    text: body,
    quickReply: isWorkingHours ? quickReplies([
      { type: 'message', label: t(lang, 'back'), text: 'MENU' },
    ]) : quickReplies([
      { type: 'message', label: t(lang, 'back'), text: 'MENU' },
    ]),
  };
}

module.exports = {
  t,
  languageSelectorMessage,
  welcomeMessage,
  loyaltyIntroMessage,
  countryPickerMessage,
  loyaltyCardMessages,
  nearestStorePromptMessage,
  storeCardMessage,
  otpResendMessage,
  textWithMenu,
  managerIntroMessage,
  quickReplies,
};
