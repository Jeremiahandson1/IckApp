import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../db/init.js';
import {
  generateToken, generateRefreshToken,
  storeRefreshToken, validateAndRotateRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens,
  authenticateToken
} from '../middleware/auth.js';
import { startTrial, getSubscriptionStatus } from '../middleware/subscription.js';

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
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    await pool.query(
      `UPDATE users SET push_subscription = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(subscription), req.user.id]
    );
    res.json({ subscribed: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// ── Bootstrap admin (only works when no admins exist yet) ─────────────────────
router.post('/bootstrap-admin', authenticateToken, async (req, res) => {
  try {
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

export default router;
