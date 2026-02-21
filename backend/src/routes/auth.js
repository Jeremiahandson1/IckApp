import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import pool from '../db/init.js';
import {
  generateToken, generateRefreshToken,
  storeRefreshToken, validateAndRotateRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens,
  authenticateToken
} from '../middleware/auth.js';
import { startTrial, getSubscriptionStatus } from '../middleware/subscription.js';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/email.js';

const router = express.Router();

// ── Zod validation schemas ────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  name: z.string().max(100).optional(),
  zip_code: z.string().regex(/^\d{5}$/, { message: 'Invalid zip code' }).optional(),
  household_size: z.number().int().min(1).max(20).optional(),
  has_kids: z.boolean().optional(),
  kids_ages: z.array(z.number().int().min(0).max(18)).optional(),
  allergen_alerts: z.array(z.string().max(50)).optional(),
});

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password required' }),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => e.message).join(', ');
      return res.status(400).json({ error: errors });
    }
    req.body = result.data; // use parsed/coerced values
    next();
  };
}

// ── Per-email brute-force protection ────────────────────────────────────────
// Tracks failed login attempts per email in DB. Locks for 15 min after 10 failures.
const MAX_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

async function checkLoginAllowed(email) {
  const result = await pool.query(
    `SELECT COUNT(*) as attempts
     FROM login_attempts
     WHERE email = LOWER($1)
       AND success = false
       AND attempted_at > NOW() - INTERVAL '${LOCKOUT_MINUTES} minutes'`,
    [email]
  );
  return parseInt(result.rows[0].attempts) < MAX_ATTEMPTS;
}

async function recordLoginAttempt(email, ip, success) {
  await pool.query(
    'INSERT INTO login_attempts (email, ip, success) VALUES (LOWER($1), $2, $3)',
    [email, ip || null, success]
  ).catch(() => {}); // non-fatal — don't let logging failure block auth
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

// ── Shared user response shape ───────────────────────────────────────────────
function userResponse(user, subscription) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    zip_code: user.zip_code,
    household_size: user.household_size,
    has_kids: user.has_kids,
    kids_ages: user.kids_ages,
    allergen_alerts: user.allergen_alerts,
    subscription
  };
}

// ── Register ─────────────────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name, zip_code, household_size, has_kids, kids_ages, allergen_alerts } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, zip_code, household_size, has_kids, kids_ages, allergen_alerts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, zip_code, household_size, has_kids, kids_ages, allergen_alerts, created_at`,
      [email.toLowerCase(), passwordHash, name, zip_code, household_size || 1,
       has_kids || false, JSON.stringify(kids_ages || []), JSON.stringify(allergen_alerts || [])]
    );

    const user = result.rows[0];

    await pool.query('INSERT INTO user_engagement (user_id) VALUES ($1)', [user.id]);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    await pool.query(
      `UPDATE users SET email_verification_token = $1, email_verification_sent_at = NOW() WHERE id = $2`,
      [verificationTokenHash, user.id]
    );

    // Send welcome + verification emails (non-blocking — don't fail registration if email fails)
    Promise.all([
      sendWelcomeEmail({ to: user.email, name: user.name }),
      sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken }),
    ]).catch(e => console.warn('[Email] Post-registration email failed (non-fatal):', e.message));

    const subscription = await getSubscriptionStatus(user.id);
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    await storeRefreshToken(user.id, refreshToken);

    res.status(201).json({
      user: userResponse(user, subscription),
      token: accessToken,
      refreshToken
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', validate(loginSchema), async (req, res) => {
  const ip = getClientIp(req);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Per-email lockout check
    const allowed = await checkLoginAllowed(email);
    if (!allowed) {
      return res.status(429).json({
        error: `Too many failed login attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
        code: 'LOGIN_LOCKED'
      });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      await recordLoginAttempt(email, ip, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await recordLoginAttempt(email, ip, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success — record and clear lockout by recording a success
    await recordLoginAttempt(email, ip, true);

    const subscription = await getSubscriptionStatus(user.id);
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    await storeRefreshToken(user.id, refreshToken);

    res.json({
      user: userResponse(user, subscription),
      token: accessToken,
      refreshToken
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Refresh token ─────────────────────────────────────────────────────────────
// POST /api/auth/refresh  { refreshToken: "..." }
// Returns new { token, refreshToken } pair (old refresh token is revoked)
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken required', code: 'MISSING_REFRESH_TOKEN' });
    }

    const result = await validateAndRotateRefreshToken(refreshToken);

    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'REFRESH_TOKEN_INVALID' });
    }

    res.json({
      token: result.accessToken,
      refreshToken: result.refreshToken
    });

  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
// Revokes the provided refresh token (client should discard the access token)
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true }); // Always succeed from the client's perspective
  }
});

// ── Logout all devices ────────────────────────────────────────────────────────
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    await revokeAllUserRefreshTokens(req.user.id);
    res.json({ success: true, message: 'All sessions revoked' });
  } catch (err) {
    console.error('Logout all error:', err);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// ── Get profile ───────────────────────────────────────────────────────────────
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.zip_code, u.household_size, u.has_kids, u.kids_ages, u.allergen_alerts, u.created_at,
              e.total_products_scanned, e.total_swaps_clicked, e.total_recipes_viewed
       FROM users u
       LEFT JOIN user_engagement e ON u.id = e.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = await getSubscriptionStatus(req.user.id);
    res.json({ user: { ...result.rows[0], subscription } });

  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── Update profile ────────────────────────────────────────────────────────────
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, zip_code, household_size, has_kids, kids_ages, allergen_alerts } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           zip_code = COALESCE($2, zip_code),
           household_size = COALESCE($3, household_size),
           has_kids = COALESCE($4, has_kids),
           kids_ages = COALESCE($5, kids_ages),
           allergen_alerts = COALESCE($6, allergen_alerts),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, email, name, zip_code, household_size, has_kids, kids_ages, allergen_alerts`,
      [name, zip_code, household_size, has_kids,
       kids_ages ? JSON.stringify(kids_ages) : null,
       allergen_alerts ? JSON.stringify(allergen_alerts) : null,
       req.user.id]
    );

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── Push notification subscription ───────────────────────────────────────────
router.post('/push-subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'subscription required' });

    if (subscription.type === 'native') {
      // Native FCM/APNs token from Capacitor
      if (!subscription.token) return res.status(400).json({ error: 'Native token missing' });
      await pool.query(
        `UPDATE users SET native_push_token = $1, updated_at = NOW() WHERE id = $2`,
        [subscription.token, req.user.id]
      );
    } else {
      // Web Push VAPID subscription object
      if (!subscription.endpoint) return res.status(400).json({ error: 'Invalid Web Push subscription' });
      await pool.query(
        `UPDATE users SET push_subscription = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(subscription), req.user.id]
      );
    }

    res.json({ subscribed: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// ── Bootstrap admin (only works when no admins exist yet) ─────────────────────
router.post('/bootstrap-admin', authenticateToken, async (req, res) => {
  try {
    // Require the bootstrap secret set in Render env vars
    const { bootstrap_secret } = req.body;
    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

    if (!expectedSecret) {
      return res.status(503).json({ error: 'ADMIN_BOOTSTRAP_SECRET not configured on server.' });
    }
    if (!bootstrap_secret || bootstrap_secret !== expectedSecret) {
      return res.status(403).json({ error: 'Invalid bootstrap secret.' });
    }

    const adminCheck = await pool.query('SELECT COUNT(*) FROM users WHERE is_admin = true');
    if (parseInt(adminCheck.rows[0].count) > 0) {
      return res.status(403).json({ error: 'Admin already exists. Ask an existing admin to promote you.' });
    }

    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [req.user.id]);
    res.json({ promoted: true, message: 'You are now the first admin.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed. Run database migration first.' });
  }
});

// ── Forgot password ───────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  // Always return 200 even if email not found — prevents user enumeration
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const result = await pool.query(
      'SELECT id, name, email FROM users WHERE email = LOWER($1)',
      [email]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Invalidate any existing reset tokens for this user
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [user.id]
      );

      // Generate token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    }

    res.json({ sent: true, message: 'If that email is registered, a reset link is on its way.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.json({ sent: true, message: 'If that email is registered, a reset link is on its way.' });
  }
});

// ── Reset password ────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({ error: 'token and new_password required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await pool.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    const resetRow = result.rows[0];

    if (resetRow.used_at) {
      return res.status(400).json({ error: 'This reset link has already been used.' });
    }
    if (new Date(resetRow.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, resetRow.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetRow.id]);

    // Log out all other sessions
    await revokeAllUserRefreshTokens(resetRow.user_id);

    res.json({ reset: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ── Email verification ────────────────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await pool.query(
      `UPDATE users SET email_verified_at = NOW(), email_verification_token = NULL
       WHERE email_verification_token = $1 AND email_verified_at IS NULL
       RETURNING id`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or already used verification link.' });
    }

    res.json({ verified: true, message: 'Email verified!' });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Resend verification email ─────────────────────────────────────────────────
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT email, name, email_verified_at, email_verification_sent_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified_at) return res.status(400).json({ error: 'Email already verified' });

    // Throttle: max once per 5 minutes
    if (user.email_verification_sent_at) {
      const msSince = Date.now() - new Date(user.email_verification_sent_at).getTime();
      if (msSince < 5 * 60 * 1000) {
        return res.status(429).json({ error: 'Please wait a few minutes before requesting another verification email.' });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await pool.query(
      'UPDATE users SET email_verification_token = $1, email_verification_sent_at = NOW() WHERE id = $2',
      [tokenHash, req.user.id]
    );

    await sendVerificationEmail({ to: user.email, name: user.name, token });
    res.json({ sent: true });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend' });
  }
});

// ── Change password ───────────────────────────────────────────────────────────
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Verify current password
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);

    // Revoke all refresh tokens so other devices are logged out
    await revokeAllUserRefreshTokens(req.user.id);

    res.json({ success: true, message: 'Password updated. All other sessions have been logged out.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ── Delete account ────────────────────────────────────────────────────────────
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required to confirm account deletion' });
    }

    // Verify password before deleting
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Delete the user — cascades to all related data via FK constraints
    // Also clean up password reset tokens (no FK cascade on that table)
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [req.user.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

    res.json({ deleted: true, message: 'Your account and all data have been permanently deleted.' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
