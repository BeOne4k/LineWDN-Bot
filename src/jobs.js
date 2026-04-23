// src/jobs.js
// Retention push messages & scheduled reminders.
// Uses node-schedule for per-user delayed jobs.

const schedule = require('node-schedule');
const { getSession, setSession, allSessions } = require('./store');
const { t } = require('./messages');

let _client = null; // LINE client, set on init

function init(lineClient) {
  _client = lineClient;
}

// ─── Push helper ──────────────────────────────────────────────────────────────
async function push(userId, messages) {
  if (!_client) return;
  const msgs = Array.isArray(messages) ? messages : [messages];
  try {
    await _client.pushMessage(userId, msgs);
  } catch (e) {
    console.error(`[jobs] Push to ${userId} failed:`, e.message);
  }
}

function textMsg(text) {
  return { type: 'text', text };
}

// ─── Cancel all jobs for a user ───────────────────────────────────────────────
function cancelUserJobs(userId) {
  const s = getSession(userId);
  for (const jobId of (s.jobIds || [])) {
    const j = schedule.scheduledJobs[jobId];
    if (j) j.cancel();
  }
  setSession(userId, { jobIds: [] });
}

// ─── Schedule a one-shot job ──────────────────────────────────────────────────
function scheduleOnce(userId, delayMs, jobSuffix, fn) {
  const jobId = `${userId}_${jobSuffix}_${Date.now()}`;
  const fireAt = new Date(Date.now() + delayMs);
  const job = schedule.scheduleJob(jobId, fireAt, () => {
    fn();
    // Clean from session
    const s = getSession(userId);
    setSession(userId, { jobIds: (s.jobIds || []).filter(id => id !== jobId) });
  });
  const s = getSession(userId);
  setSession(userId, { jobIds: [...(s.jobIds || []), jobId] });
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ─── FLOW 1: User just opened bot, hasn't pressed loyalty ────────────────────
// → 2h: "It takes 30 seconds..."
function scheduleNoActionReminder(userId) {
  scheduleOnce(userId, 2 * HOUR, '2h_noloyalty', async () => {
    const s = getSession(userId);
    if (!s.registered && s.step === 'MENU') {
      await push(userId, textMsg(t(s.lang, 'reminder2h')));
    }
  });
}

// ─── FLOW 2: User has NOT started at all after 5min ──────────────────────────
function scheduleNoStartReminder(userId) {
  scheduleOnce(userId, 5 * MIN, '5min_nostart', async () => {
    const s = getSession(userId);
    if (!s.registered && !s.phone && s.step === 'MENU') {
      await push(userId, textMsg(t(s.lang, 'reminder5minNoStart')));
    }
  });
}

// ─── FLOW 3: User entered phone but didn't finish (5min) ─────────────────────
function schedulePhoneEnteredReminder(userId) {
  scheduleOnce(userId, 5 * MIN, '5min_phone', async () => {
    const s = getSession(userId);
    if (!s.registered && s.phone && s.step !== 'DONE') {
      await push(userId, textMsg(t(s.lang, 'reminder5minPhoneEntered')));
    }
  });
}

// ─── FLOW 4: Registration started but not completed (24h) ────────────────────
function scheduleIncompleteReminder(userId) {
  scheduleOnce(userId, 24 * HOUR, '24h_incomplete', async () => {
    const s = getSession(userId);
    if (!s.registered) {
      await push(userId, textMsg(t(s.lang, 'reminder24hIncomplete')));
    }
  });
}

// ─── FLOW 5: Registered but no store visit (7 days) ──────────────────────────
function scheduleNoVisitReminder(userId) {
  scheduleOnce(userId, 7 * DAY, '7d_novisit', async () => {
    const s = getSession(userId);
    if (s.registered && !s.lastVisitTs) {
      await push(userId, textMsg(t(s.lang, 'reminder7dNoVisit')));
    }
  });
}

// ─── FLOW 6: After store visit — feedback (1d) + return promo (3d) ────────────
function schedulePostVisitMessages(userId, storeReviewUrl) {
  scheduleOnce(userId, 1 * DAY, '1d_feedback', async () => {
    const s = getSession(userId);
    await push(userId, [
      textMsg(t(s.lang, 'reminder1dAfterVisit')),
      ...(storeReviewUrl ? [{ type: 'text', text: storeReviewUrl }] : []),
    ]);
  });

  scheduleOnce(userId, 3 * DAY, '3d_return', async () => {
    const s = getSession(userId);
    await push(userId, textMsg(t(s.lang, 'reminder3dAfterVisit')));
  });
}

// ─── FLOW 7: Inactive for 14 days ────────────────────────────────────────────
function scheduleInactivityReminder(userId) {
  scheduleOnce(userId, 14 * DAY, '14d_inactive', async () => {
    const s = getSession(userId);
    // Only fire if the user hasn't been active (no new activity timestamp)
    const inactive = Date.now() - (s.lastActivity || 0) >= 14 * DAY;
    if (inactive) {
      await push(userId, textMsg(t(s.lang, 'reminder14dInactive')));
      // Re-schedule for next 14d
      scheduleInactivityReminder(userId);
    }
  });
}

// ─── Called when user registers successfully ──────────────────────────────────
function onRegistered(userId) {
  cancelUserJobs(userId); // cancel pending incomplete reminders
  scheduleNoVisitReminder(userId);
  scheduleInactivityReminder(userId);
}

// ─── Called when CRM reports a store visit ───────────────────────────────────
function onStoreVisit(userId, storeReviewUrl) {
  setSession(userId, { lastVisitTs: Date.now() });
  schedulePostVisitMessages(userId, storeReviewUrl);
  // Cancel and re-schedule inactivity
  const s = getSession(userId);
  const inactJobId = (s.jobIds || []).find(id => id.includes('14d_inactive'));
  if (inactJobId) {
    const j = schedule.scheduledJobs[inactJobId];
    if (j) j.cancel();
  }
  scheduleInactivityReminder(userId);
}

module.exports = {
  init,
  scheduleNoActionReminder,
  scheduleNoStartReminder,
  schedulePhoneEnteredReminder,
  scheduleIncompleteReminder,
  scheduleNoVisitReminder,
  schedulePostVisitMessages,
  scheduleInactivityReminder,
  onRegistered,
  onStoreVisit,
  cancelUserJobs,
};
