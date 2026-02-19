import pool from '../db/init.js';

/**
 * Middleware: require admin role.
 * Must be used after authenticateToken so req.user is populated.
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Admin check failed' });
  }
};
