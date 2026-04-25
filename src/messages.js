// src/messages.js

const strings = require('../locales/strings');

function t(lang, key, vars = {}) {
  let str = (strings[lang] || strings.en)[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// ─── Quick reply ───────────────────────────────────────
function quickReplies(items) {
  return {
    items: items.map(i => ({
      type: 'action',
      action: i.action || i,
    })),
  };
}

// ─── BUTTON (как Telegram callback) ────────────────────
function btnAction(label, data, style = 'primary') {
  return {
    type: 'button',
    action: {
      type: 'postback',
      label,
      data
    },
    style,
    color: style === 'primary' ? '#2D7A4F' : undefined,
  };
}

// ─── LANGUAGE ─────────────────────────────────────────
function languageSelectorMessage() {
  return {
    type: 'flex',
    altText: 'Select language',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          btnAction('🇬🇧 English', 'LANG_EN'),
          btnAction('🇷🇺 Русский', 'LANG_RU'),
          btnAction('🇹🇭 ไทย', 'LANG_TH'),
        ],
      },
    },
  };
}

// ─── MENU ─────────────────────────────────────────────
function welcomeMessage(lang) {
  return {
    type: 'flex',
    altText: 'Menu',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          btnAction('🎁 Loyalty', 'LOYALTY'),
          btnAction('📍 Stores', 'FIND_STORE'),
          btnAction('💬 Manager', 'MANAGER'),
        ],
      },
    },
  };
}

// ─── LOYALTY ──────────────────────────────────────────
function loyaltyIntroMessage(lang) {
  return {
    type: 'flex',
    altText: 'Loyalty',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: t(lang, 'loyaltyIntro'),
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        contents: [
          btnAction('Start', 'START_LOYALTY')
        ]
      }
    }
  };
}

// ─── COUNTRY ──────────────────────────────────────────
function countryPickerMessage(lang) {
  const countries = t(lang, 'countryList');

  return {
    type: 'text',
    text: t(lang, 'askCountry'),
    quickReply: quickReplies(
      countries.map(c => ({
        type: 'postback',
        label: c,
        data: `COUNTRY:${c}`
      }))
    )
  };
}

// ─── STORE CARD ───────────────────────────────────────
function storeCardMessage(lang, store) {
  return [{
    type: 'flex',
    altText: store.name,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        contents: [
          { type: 'text', text: store.name, weight: 'bold' },
          { type: 'text', text: store.address, size: 'sm' },
        ]
      },
      footer: {
        type: 'box',
        contents: [
          btnAction('Route', `STORE_ROUTE:${store.id}`),
          btnAction('Info', `STORE_INFO:${store.id}`, 'secondary'),
        ]
      }
    }
  }];
}

// ─── OTP ──────────────────────────────────────────────
function otpResendMessage(lang, text) {
  return {
    type: 'text',
    text,
    quickReply: quickReplies([
      { type: 'postback', label: 'Resend', data: 'RESEND_OTP' },
      { type: 'postback', label: 'Cancel', data: 'MENU' },
    ])
  };
}

module.exports = {
  t,
  languageSelectorMessage,
  welcomeMessage,
  loyaltyIntroMessage,
  countryPickerMessage,
  storeCardMessage,
  otpResendMessage,
  quickReplies
};