// src/store.js
// In-memory session store.
// In production: replace with Redis or a Firestore/PostgreSQL table.

const sessions = new Map();

// ─────────────────────────────────────────────
// Session schema:
// {
//   userId: string,
//   lang: 'en' | 'ru' | 'th',
//   step: string,                // current conversation step
//   phone: string,               // entered phone number
//   otpCode: string,             // expected OTP code
//   otpAttempts: number,         // wrong OTP counter
//   otpExpiry: number,           // timestamp ms
//   age: number,
//   country: string,
//   crmId: string,               // Odoo partner id after registration
//   registered: boolean,
//   lastActivity: number,        // timestamp ms
//   visitedStoreId: string,      // last store the user viewed
//   lastVisitTs: number,         // timestamp of last CRM-detected store visit
//   jobIds: string[],            // scheduled job ids for cleanup
// }
// ─────────────────────────────────────────────

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      userId,
      lang: 'en',
      step: 'START',
      phone: null,
      otpCode: null,
      otpAttempts: 0,
      otpExpiry: null,
      age: null,
      country: null,
      crmId: null,
      registered: false,
      lastActivity: Date.now(),
      visitedStoreId: null,
      lastVisitTs: null,
      jobIds: [],
    });
  }
  const s = sessions.get(userId);
  s.lastActivity = Date.now();
  return s;
}

function setSession(userId, data) {
  const current = getSession(userId);
  Object.assign(current, data);
  sessions.set(userId, current);
}

function clearStep(userId) {
  const s = getSession(userId);
  s.step = 'MENU';
  sessions.set(userId, s);
}

function allSessions() {
  return Array.from(sessions.values());
}

module.exports = { getSession, setSession, clearStep, allSessions };
