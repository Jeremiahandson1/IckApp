import pool from '../db/init.js';

// ── PREMIUM GATE TOGGLE ──
// Set PREMIUM_ENABLED=true in env to enforce subscription checks
// Default: false (everything free — for early growth / user testing)
const PREMIUM_ENABLED = process.env.PREMIUM_ENABLED === 'true';

if (!PREMIUM_ENABLED) {
  console.log('⚡ Premium gate OFF — all features free. Set PREMIUM_ENABLED=true to enforce.');
}

// Get subscription status for a user
export async function getSubscriptionStatus(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return { plan: 'free', status: 'none', is_premium: !PREMIUM_ENABLED, premium_gate_off: !PREMIUM_ENABLED };
    }

    const sub = result.rows[0];
    const now = new Date();

    // Check trial
    if (sub.plan === 'trial' && sub.trial_ends_at) {
      const trialEnd = new Date(sub.trial_ends_at);
      if (trialEnd > now) {
        return {
          plan: 'trial',
          status: 'active',
          is_premium: true,
          trial_ends_at: sub.trial_ends_at,
          days_remaining: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
        };
      } else {
        // Trial expired
        return { plan: 'trial', status: 'expired', is_premium: !PREMIUM_ENABLED, premium_gate_off: !PREMIUM_ENABLED };
      }
    }

    // Check paid subscription
    if (sub.status === 'active' && sub.expires_at) {
      const expiresAt = new Date(sub.expires_at);
      if (expiresAt > now) {
        return {
          plan: sub.plan,
          status: 'active',
          is_premium: true,
          expires_at: sub.expires_at,
          stripe_customer_id: sub.stripe_customer_id
        };
      }
    }

    // Active with no expiry (lifetime or manual grant)
    if (sub.status === 'active' && !sub.expires_at) {
      return { plan: sub.plan, status: 'active', is_premium: true };
    }

    return { plan: sub.plan, status: sub.status, is_premium: !PREMIUM_ENABLED, premium_gate_off: !PREMIUM_ENABLED };
  } catch (err) {
    console.error('Subscription status error:', err);
    // If check fails, be permissive
    return { plan: 'unknown', status: 'error', is_premium: !PREMIUM_ENABLED };
  }
}

// Start a 30-day trial
export async function startTrial(userId) {
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, trial_started_at, trial_ends_at)
     VALUES ($1, 'trial', 'active', NOW(), NOW() + INTERVAL '30 days')
     ON CONFLICT (user_id) DO UPDATE SET
       plan = 'trial',
       status = 'active',
       trial_started_at = COALESCE(subscriptions.trial_started_at, NOW()),
       trial_ends_at = NOW() + INTERVAL '30 days'`,
    [userId]
  );
}

// Middleware: require premium (or pass through if gate is off)
export function requirePremium(req, res, next) {
  // Gate off = everyone gets through
  if (!PREMIUM_ENABLED) return next();

  // Gate on = check subscription
  (async () => {
    try {
      const status = await getSubscriptionStatus(req.user.id);
      if (status.is_premium) {
        return next();
      }
      return res.status(403).json({
        error: 'Premium feature',
        message: 'Start your free 30-day trial to access this feature.',
        upgrade_url: '/subscription'
      });
    } catch (err) {
      console.error('Premium check error:', err);
      // Fail open — don't block users due to our bug
      next();
    }
  })();
}
