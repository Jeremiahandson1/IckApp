/**
 * Ick SMS Service — Twilio stub
 *
 * Setup:
 *   1. Sign up at twilio.com
 *   2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in env
 *
 * Until configured, sends are no-ops and log to console.
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

async function getTwilio() {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) {
    console.warn('[SMS] Twilio not configured — SMS disabled');
    return null;
  }
  if (!twilioClient) {
    const twilio = await import('twilio');
    twilioClient = twilio.default(TWILIO_SID, TWILIO_AUTH);
  }
  return twilioClient;
}

export async function sendSMS({ to, body }) {
  const client = await getTwilio();
  if (!client) {
    console.log(`[SMS] Would send to ${to}: ${body}`);
    return { ok: false, reason: 'sms_disabled' };
  }

  try {
    const message = await client.messages.create({
      body,
      from: TWILIO_FROM,
      to,
    });
    return { ok: true, sid: message.sid };
  } catch (err) {
    console.error('[SMS] Send error:', err.message);
    return { ok: false, reason: err.message };
  }
}

export async function sendFamilyInviteSMS({ to, inviterName, joinUrl }) {
  return sendSMS({
    to,
    body: `${inviterName} invited you to their family group on Ick! Join here: ${joinUrl}`,
  });
}
