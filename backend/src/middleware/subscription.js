import pool from '../db/init.js';

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(userId) {
  const result = await pool.query(
    'SELECT * FROM subscriptions WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return { plan: 'free', status: 'active', isPremium: false, isTrialing: false, daysLeft: 0 };
  }

  const sub = result.rows[0];
  const now = new Date();

  // Check active trial
  if (sub.plan === 'trial' && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    if (now < trialEnd) {
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      return { plan: 'trial', status: 'active', isPremium: true, isTrialing: true, daysLeft, trialEndsAt: sub.trial_ends_at };
    }
    // Trial expired — fall through to free
    return { plan: 'free', status: 'trial_expired', isPremium: false, isTrialing: false, daysLeft: 0, trialEndsAt: sub.trial_ends_at };
  }

  // Check active paid subscription
  if (sub.plan === 'monthly' || sub.plan === 'yearly') {
    if (sub.status === 'active' && (!sub.expires_at || now < new Date(sub.expires_at))) {
      return { plan: sub.plan, status: 'active', isPremium: true, isTrialing: false, expiresAt: sub.expires_at };
    }
    return { plan: sub.plan, status: 'expired', isPremium: false, isTrialing: false, expiresAt: sub.expires_at };
  }

  return { plan: 'free', status: 'active', isPremium: false, isTrialing: false, daysLeft: 0 };
}

/**
 * Middleware: require premium (trial or paid) — blocks with 403
 */
export function requirePremium(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  getSubscriptionStatus(req.user.id)
    .then(sub => {
      req.subscription = sub;
      if (sub.isPremium) {
        return next();
      }
      return res.status(403).json({
        error: 'Premium subscription required',
        subscription: sub,
        upgrade_message: 'Start your free 30-day trial to unlock this feature'
      });
    })
    .catch(err => {
      console.error('Subscription check error:', err);
      res.status(500).json({ error: 'Failed to check subscription' });
    });
}

/**
 * Middleware: attach subscription info but don't block
 */
export function attachSubscription(req, res, next) {
  if (!req.user) {
    req.subscription = { plan: 'free', isPremium: false };
    return next();
  }

  getSubscriptionStatus(req.user.id)
    .then(sub => {
      req.subscription = sub;
      next();
    })
    .catch(err => {
      console.error('Subscription attach error:', err);
      req.subscription = { plan: 'free', isPremium: false };
      next();
    });
}

/**
 * Start a 30-day free trial for a user
 */
export async function startTrial(userId) {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const result = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, trial_started_at, trial_ends_at)
     VALUES ($1, 'trial', 'active', $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       plan = 'trial',
       status = 'active',
       trial_started_at = COALESCE(subscriptions.trial_started_at, $2),
       trial_ends_at = COALESCE(subscriptions.trial_ends_at, $3),
       updated_at = NOW()
     RETURNING *`,
    [userId, now.toISOString(), trialEnd.toISOString()]
  );

  return result.rows[0];
}
