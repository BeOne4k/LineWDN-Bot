// src/otp.js
// OTP generation and verification.
// Pluggable: replace sendSms() to use Twilio, 2Factor, AWS SNS, etc.

const axios = require('axios');

// ─── Generate 6-digit OTP ──────────────────────────────────────────────────────
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Send OTP via SMS ─────────────────────────────────────────────────────────
async function sendOtp(phone) {
  const code = generateOtp();
  const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

  // ── Replace with your actual SMS provider ──────────────────────────────────
  // Example: Twilio
  // await twilioClient.messages.create({ to: phone, from: '...', body: `Your WeedeN code: ${code}` });

  // Example: generic POST provider
  if (process.env.OTP_PROVIDER_URL && process.env.OTP_API_KEY) {
    try {
      await axios.post(process.env.OTP_PROVIDER_URL, {
        apiKey: process.env.OTP_API_KEY,
        phone,
        message: `Your WeedeN verification code: ${code}`,
      });
    } catch (e) {
      console.error('[OTP] SMS send failed:', e.message);
      // In dev/staging you can log the code and proceed
      console.log(`[OTP] DEV FALLBACK — code for ${phone}: ${code}`);
    }
  } else {
    // Development mode: just log
    console.log(`[OTP] DEV MODE — code for ${phone}: ${code}`);
  }

  return { code, expiry };
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────
function verifyOtp(inputCode, storedCode, expiry) {
  if (Date.now() > expiry) return 'expired';
  if (inputCode.trim() === storedCode) return 'ok';
  return 'invalid';
}

module.exports = { sendOtp, verifyOtp };
