// Admin audit log helper.
//
// Every mutation-producing admin route should call logAdminAction() so we
// have a permanent record of who changed what and when. The helper is
// fire-and-forget — a logging failure must never block the actual request.
//
// Usage in a route:
//   await logAdminAction(req, 'grant_trial', 'user', userId, { days: 30 });

import pool from '../db/init.js';

export async function logAdminAction(req, action, targetType, targetId, details = {}) {
  try {
    await pool.query(
      `INSERT INTO admin_actions
         (admin_user_id, admin_email, action, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user?.id || null,
        req.user?.email || null,
        action,
        targetType,
        targetId == null ? null : String(targetId),
        details ? JSON.stringify(details) : null,
        req.ip || req.headers['x-forwarded-for'] || null,
        req.headers['user-agent'] || null,
      ]
    );
  } catch (err) {
    // Never let logging failures block the real operation
    console.warn('[admin-audit] log failed:', err.message);
  }
}
