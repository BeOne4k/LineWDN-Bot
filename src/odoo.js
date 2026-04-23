// src/odoo.js
// Odoo XML-RPC integration for loyalty card management.
// Odoo exposes JSON-RPC at /web/dataset/call_kw

const axios = require('axios');

const BASE = process.env.ODOO_URL;
const DB   = process.env.ODOO_DB;
const USER = process.env.ODOO_USERNAME;
const PASS = process.env.ODOO_PASSWORD;

let _uid = null; // cached session uid

// ─── Authenticate ─────────────────────────────────────────────────────────────
async function authenticate() {
  if (_uid) return _uid;
  const res = await axios.post(`${BASE}/web/dataset/call_kw`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      model: 'res.users',
      method: 'authenticate',
      args: [DB, USER, PASS, {}],
      kwargs: {},
    },
  });
  _uid = res.data.result;
  return _uid;
}

// ─── Low-level call ───────────────────────────────────────────────────────────
async function odooCall(model, method, args, kwargs = {}) {
  const uid = await authenticate();
  const res = await axios.post(`${BASE}/web/dataset/call_kw`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      model,
      method,
      args,
      kwargs: { context: { uid }, ...kwargs },
    },
  });
  if (res.data.error) throw new Error(res.data.error.data?.message || 'Odoo error');
  return res.data.result;
}

// ─── Find partner by phone ─────────────────────────────────────────────────────
async function findByPhone(phone) {
  const results = await odooCall('res.partner', 'search_read',
    [[['mobile', '=', phone]]],
    { fields: ['id', 'name', 'mobile', 'barcode', 'loyalty_card_id', 'x_age', 'country_id'], limit: 1 }
  );
  return results[0] || null;
}

// ─── Create partner ────────────────────────────────────────────────────────────
async function createPartner({ phone, age, country, lineUserId }) {
  const id = await odooCall('res.partner', 'create', [{
    mobile: phone,
    x_age: age,
    x_country_name: country,
    x_line_user_id: lineUserId,
    customer_rank: 1,
    lang: 'en_US',
  }]);
  return id;
}

// ─── Update partner ────────────────────────────────────────────────────────────
async function updatePartner(partnerId, values) {
  await odooCall('res.partner', 'write', [[partnerId], values]);
}

// ─── Get loyalty card (barcode) ───────────────────────────────────────────────
async function getLoyaltyCard(partnerId) {
  // Adjust model/field names to your Odoo loyalty module
  const results = await odooCall('loyalty.card', 'search_read',
    [[['partner_id', '=', partnerId]]],
    { fields: ['id', 'code', 'barcode', 'points'], limit: 1 }
  );
  return results[0] || null;
}

// ─── Issue loyalty card ───────────────────────────────────────────────────────
async function issueLoyaltyCard(partnerId) {
  // Adjust to your Odoo loyalty module's create method
  const cardId = await odooCall('loyalty.card', 'create', [{
    partner_id: partnerId,
  }]);
  return cardId;
}

// ─── Get barcode image URL ────────────────────────────────────────────────────
// Returns a URL to the barcode image Odoo can generate, or the barcode string.
function getBarcodeImageUrl(barcode) {
  // If your Odoo has a barcode endpoint:
  return `${BASE}/report/barcode/Code128/${encodeURIComponent(barcode)}?width=600&height=120`;
}

// ─── Mark LINE user id ────────────────────────────────────────────────────────
async function linkLineUser(partnerId, lineUserId) {
  await updatePartner(partnerId, { x_line_user_id: lineUserId });
}

// ─── Register (create or update) ──────────────────────────────────────────────
async function registerUser({ phone, age, country, lineUserId }) {
  let partner = await findByPhone(phone);
  let isNew = false;

  if (!partner) {
    const newId = await createPartner({ phone, age, country, lineUserId });
    partner = { id: newId };
    isNew = true;
  } else {
    await updatePartner(partner.id, {
      x_age: age,
      x_country_name: country,
      x_line_user_id: lineUserId,
    });
  }

  // Ensure loyalty card exists
  let card = await getLoyaltyCard(partner.id);
  if (!card) {
    const cardId = await issueLoyaltyCard(partner.id);
    card = await odooCall('loyalty.card', 'read', [[cardId]], { fields: ['id', 'code', 'barcode', 'points'] });
    card = card[0];
  }

  return {
    partnerId: partner.id,
    isNew,
    barcode: card?.barcode || card?.code || String(partner.id),
    cardId: card?.id,
    clientId: `WDN-${String(partner.id).padStart(6, '0')}`,
  };
}

module.exports = {
  findByPhone,
  createPartner,
  updatePartner,
  getLoyaltyCard,
  issueLoyaltyCard,
  getBarcodeImageUrl,
  linkLineUser,
  registerUser,
};
