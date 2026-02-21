/**
 * Ick Email Service — powered by Resend
 *
 * Setup:
 *   1. Sign up at resend.com (free: 3,000 emails/month, 100/day)
 *   2. Add a sending domain (or use onboarding@resend.dev to test)
 *   3. Set RESEND_API_KEY in Render env vars
 *   4. Set EMAIL_FROM in Render env vars (e.g. "Ick <hello@ick.app>")
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'Ick <onboarding@resend.dev>';
const APP_URL = process.env.FRONTEND_URL || 'https://ick.app';

// Resend is loaded lazily so missing key doesn't crash startup
let resendClient = null;

async function getResend() {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — emails disabled');
    return null;
  }
  if (!resendClient) {
    const { Resend } = await import('resend');
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

async function send({ to, subject, html, text }) {
  const resend = await getResend();
  if (!resend) return { ok: false, reason: 'email_disabled' };

  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html, text });
    return { ok: true, id: result.id };
  } catch (err) {
    console.error('[Email] Send error:', err.message);
    return { ok: false, reason: err.message };
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const BODY_STYLE = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; margin: 0; padding: 0;';
const CARD_STYLE = 'max-width: 520px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden;';
const HEADER_STYLE = 'background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px 32px 24px; text-align: center;';
const BODY_PAD = 'padding: 32px;';
const BTN_STYLE = 'display: inline-block; background: #f97316; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px; margin: 16px 0;';
const TEXT_STYLE = 'color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 16px;';
const FOOTER_STYLE = 'padding: 20px 32px; border-top: 1px solid #334155; color: #475569; font-size: 13px; text-align: center;';

function layout(content) {
  return `<!DOCTYPE html><html><body style="${BODY_STYLE}">
    <div style="${CARD_STYLE}">
      <div style="${HEADER_STYLE}">
        <span style="font-size: 32px;">🥦</span>
        <h1 style="color: #fff; margin: 8px 0 0; font-size: 24px; font-weight: 700;">Ick</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">Know what's in your food</p>
      </div>
      <div style="${BODY_PAD}">${content}</div>
      <div style="${FOOTER_STYLE}">
        <p style="margin: 0;">You're receiving this because you have an Ick account. 
        <a href="${APP_URL}" style="color: #f97316; text-decoration: none;">Visit Ick</a></p>
      </div>
    </div>
  </body></html>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

export async function sendWelcomeEmail({ to, name }) {
  const displayName = name ? name.split(' ')[0] : 'there';
  return send({
    to,
    subject: 'Welcome to Ick! 🥦',
    html: layout(`
      <h2 style="color: #f1f5f9; margin: 0 0 16px;">Hey ${displayName}, you're in!</h2>
      <p style="${TEXT_STYLE}">Ick helps you scan food barcodes and instantly know what's in them — artificial dyes, harmful additives, ultra-processing levels, and more.</p>
      <p style="${TEXT_STYLE}"><strong style="color: #f1f5f9;">Start by scanning a barcode</strong> — anything in your pantry, at the store, or from a delivery order. Ick gives it a health score in under a second.</p>
      <div style="text-align: center;">
        <a href="${APP_URL}/scan" style="${BTN_STYLE}">Start Scanning →</a>
      </div>
      <p style="${TEXT_STYLE}">If you scan something and it's not in our database, tap "Contribute" to add it. You'll be helping thousands of other families.</p>
    `),
    text: `Hey ${displayName}, welcome to Ick! Start scanning food at ${APP_URL}/scan`,
  });
}

export async function sendVerificationEmail({ to, name, token }) {
  const displayName = name ? name.split(' ')[0] : 'there';
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  return send({
    to,
    subject: 'Verify your Ick email',
    html: layout(`
      <h2 style="color: #f1f5f9; margin: 0 0 16px;">Verify your email, ${displayName}</h2>
      <p style="${TEXT_STYLE}">Click the button below to verify your email address and unlock all Ick features.</p>
      <div style="text-align: center;">
        <a href="${verifyUrl}" style="${BTN_STYLE}">Verify Email →</a>
      </div>
      <p style="${TEXT_STYLE}">This link expires in 24 hours. If you didn't create an Ick account, you can safely ignore this email.</p>
      <p style="color: #475569; font-size: 13px; margin: 0;">Or copy this link:<br><span style="word-break: break-all; color: #f97316;">${verifyUrl}</span></p>
    `),
    text: `Verify your Ick email: ${verifyUrl}`,
  });
}

export async function sendPasswordResetEmail({ to, name, token }) {
  const displayName = name ? name.split(' ')[0] : 'there';
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  return send({
    to,
    subject: 'Reset your Ick password',
    html: layout(`
      <h2 style="color: #f1f5f9; margin: 0 0 16px;">Password reset, ${displayName}</h2>
      <p style="${TEXT_STYLE}">Someone requested a password reset for your Ick account. If that was you, click below:</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" style="${BTN_STYLE}">Reset Password →</a>
      </div>
      <p style="${TEXT_STYLE}">This link expires in 1 hour. If you didn't request this, your account is safe — you can ignore this email.</p>
      <p style="color: #475569; font-size: 13px; margin: 0;">Or copy this link:<br><span style="word-break: break-all; color: #f97316;">${resetUrl}</span></p>
    `),
    text: `Reset your Ick password: ${resetUrl}`,
  });
}

export async function sendTrialExpiryEmail({ to, name, daysLeft }) {
  const displayName = name ? name.split(' ')[0] : 'there';
  return send({
    to,
    subject: `Your Ick trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: layout(`
      <h2 style="color: #f1f5f9; margin: 0 0 16px;">Your free trial is almost up, ${displayName}</h2>
      <p style="${TEXT_STYLE}">Your Ick premium trial ends in <strong style="color: #f97316;">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. After that, you'll still be able to scan and get health scores — but premium features like pantry management, shopping lists, and swap recommendations will be locked.</p>
      <p style="${TEXT_STYLE}">Subscribe now to keep full access:</p>
      <div style="text-align: center;">
        <a href="${APP_URL}/subscription" style="${BTN_STYLE}">Keep Premium →</a>
      </div>
    `),
    text: `Your Ick trial ends in ${daysLeft} days. Subscribe at ${APP_URL}/subscription`,
  });
}

export async function sendSubscriptionConfirmationEmail({ to, name, plan, expiresAt }) {
  const displayName = name ? name.split(' ')[0] : 'there';
  const renewDate = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return send({
    to,
    subject: 'Ick Premium activated ✓',
    html: layout(`
      <h2 style="color: #f1f5f9; margin: 0 0 16px;">You're premium, ${displayName}!</h2>
      <p style="${TEXT_STYLE}">Your <strong style="color: #f97316;">${plan === 'yearly' ? 'Annual' : 'Monthly'} Premium</strong> subscription is active. You now have full access to:</p>
      <ul style="color: #94a3b8; font-size: 15px; line-height: 2; padding-left: 20px; margin: 0 0 16px;">
        <li>Unlimited pantry management</li>
        <li>Smart shopping lists</li>
        <li>Swap recommendations</li>
        <li>Family profiles & kid-safe ratings</li>
        <li>Receipt scanning & budget tracking</li>
      </ul>
      <p style="${TEXT_STYLE}">Your subscription renews on <strong style="color: #f1f5f9;">${renewDate}</strong>. You can manage it anytime in your profile.</p>
      <div style="text-align: center;">
        <a href="${APP_URL}/scan" style="${BTN_STYLE}">Start Scanning →</a>
      </div>
    `),
    text: `Ick Premium activated! Your ${plan} plan renews on ${renewDate}. Start at ${APP_URL}/scan`,
  });
}
