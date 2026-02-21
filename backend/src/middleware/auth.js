import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db/init.js';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

if (!REFRESH_SECRET) {
  console.error('FATAL: REFRESH_SECRET environment variable is required (must be independent of JWT_SECRET)');
  process.exit(1);
}

// ── Access tokens: short-lived (15 min) ──────────────────────────────────────
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Give the client a clear signal to use their refresh token
      const expired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        error: expired ? 'Token expired' : 'Invalid token',
        code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
      });
    }
    req.user = user;
    next();
  });
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) req.user = user;
      next(); // always called inside callback to avoid race condition
    });
  } else {
    next();
  }
}

// ── Token generation ─────────────────────────────────────────────────────────
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

// Hash a refresh token before storing it (prevents DB dump → token theft)
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Refresh token DB operations ───────────────────────────────────────────────
export async function storeRefreshToken(userId, token) {
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO NOTHING`,
    [userId, hash, expiresAt]
  );
}

export async function validateAndRotateRefreshToken(token) {
  const hash = hashToken(token);

  // Look up token — must exist, not be revoked, and not be expired
  const result = await pool.query(
    `SELECT rt.*, u.id as uid, u.email
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.revoked = false
       AND rt.expires_at > NOW()`,
    [hash]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // Revoke the used token (rotation: each refresh token is single-use)
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token_hash = $1',
    [hash]
  );

  // Issue a new pair
  const user = { id: row.uid, email: row.email };
  const newAccessToken = generateToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await storeRefreshToken(user.id, newRefreshToken);

  return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function revokeRefreshToken(token) {
  const hash = hashToken(token);
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token_hash = $1',
    [hash]
  ).catch(() => {}); // non-fatal
}

export async function revokeAllUserRefreshTokens(userId) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE user_id = $1 AND revoked = false',
    [userId]
  ).catch(() => {});
}

export { JWT_SECRET };
