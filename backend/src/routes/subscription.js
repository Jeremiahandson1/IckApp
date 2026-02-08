import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSubscriptionStatus, startTrial } from '../middleware/subscription.js';

const router = express.Router();

// ============================================================
// STRIPE INTEGRATION
// Set STRIPE_SECRET_KEY in .env to enable real payments.
// When not set, trial and free features work; subscribe returns
// a clear "payment not configured" message instead of faking it.
// ============================================================

let stripe = null;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

if (STRIPE_SECRET) {
  try {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(STRIPE_SECRET);
    console.log('✓ Stripe initialized');
  } catch (e) {
    console.warn('⚠ Stripe module not installed. Run: npm install stripe');
  }
}

const PLANS = {
  monthly: {
    price: 3.99, interval: 'month', name: 'Monthly',
    stripe_price_id: process.env.STRIPE_MONTHLY_PRICE_ID || null
  },
  yearly: {
    price: 29.99, interval: 'year', name: 'Yearly', savings: '37%',
    stripe_price_id: process.env.STRIPE_YEARLY_PRICE_ID || null
  }
};

// ── Status ──
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = await getSubscriptionStatus(req.user.id);
    res.json({ ...status, plans: PLANS, stripe_configured: !!stripe });
  } catch (err) {
    console.error('Subscription status error:', err);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// ── Start trial ──
router.post('/start-trial', authenticateToken, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length > 0 && existing.rows[0].trial_started_at) {
      return res.status(400).json({ error: 'Trial already used', plans: PLANS });
    }
    await startTrial(req.user.id);
    const status = await getSubscriptionStatus(req.user.id);
    res.json({ message: 'Your 30-day free trial has started!', subscription: status, plans: PLANS });
  } catch (err) {
    console.error('Start trial error:', err);
    res.status(500).json({ error: 'Failed to start trial' });
  }
});

// ── Subscribe (Stripe Checkout) ──
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

    if (stripe && PLANS[plan].stripe_price_id) {
      // Get or create Stripe customer
      let stripeCustomerId;
      const sub = await pool.query('SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [req.user.id]);

      if (sub.rows[0]?.stripe_customer_id) {
        stripeCustomerId = sub.rows[0].stripe_customer_id;
      } else {
        const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [req.user.id]);
        const customer = await stripe.customers.create({
          email: userResult.rows[0].email,
          name: userResult.rows[0].name || undefined,
          metadata: { user_id: req.user.id }
        });
        stripeCustomerId = customer.id;
        await pool.query(
          `INSERT INTO subscriptions (user_id, plan, status, stripe_customer_id)
           VALUES ($1, 'free', 'inactive', $2)
           ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = $2`,
          [req.user.id, stripeCustomerId]
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: PLANS[plan].stripe_price_id, quantity: 1 }],
        success_url: `${APP_URL}/subscription?success=true&plan=${plan}`,
        cancel_url: `${APP_URL}/subscription?cancelled=true`,
        metadata: { user_id: req.user.id, plan },
        subscription_data: { metadata: { user_id: req.user.id, plan } }
      });

      return res.json({ checkout_url: session.url, session_id: session.id });
    }

    // Stripe not configured
    return res.status(503).json({
      error: 'Payment processing not yet configured',
      message: 'Add STRIPE_SECRET_KEY and price IDs to .env to enable payments.',
      setup_steps: [
        '1. Create Stripe account at stripe.com',
        '2. Create product with monthly ($3.99) and yearly ($29.99) prices',
        '3. Add STRIPE_SECRET_KEY, STRIPE_MONTHLY_PRICE_ID, STRIPE_YEARLY_PRICE_ID to .env',
        '4. Restart server'
      ]
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── Stripe Webhook ──
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(400).json({ error: 'Webhooks not configured' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan || 'monthly';
      if (userId && session.subscription) {
        const expiresAt = new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 86400000);
        await pool.query(
          `INSERT INTO subscriptions (user_id, plan, status, subscribed_at, expires_at, stripe_subscription_id)
           VALUES ($1, $2, 'active', NOW(), $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET
             plan=$2, status='active', subscribed_at=NOW(), expires_at=$3,
             stripe_subscription_id=$4, updated_at=NOW()`,
          [userId, plan, expiresAt.toISOString(), session.subscription]
        );
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await pool.query(`UPDATE subscriptions SET status='cancelled', updated_at=NOW() WHERE stripe_subscription_id=$1`, [sub.id]);
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      if (inv.subscription) {
        await pool.query(`UPDATE subscriptions SET status='past_due', updated_at=NOW() WHERE stripe_subscription_id=$1`, [inv.subscription]);
      }
      break;
    }
  }
  res.json({ received: true });
});

// ── Cancel ──
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const sub = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.id]);
    if (sub.rows.length === 0) return res.status(404).json({ error: 'No subscription found' });

    if (stripe && sub.rows[0].stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(sub.rows[0].stripe_subscription_id, { cancel_at_period_end: true });
      } catch (e) { console.error('Stripe cancel:', e.message); }
    }

    await pool.query(`UPDATE subscriptions SET status='cancelled', updated_at=NOW() WHERE user_id=$1`, [req.user.id]);
    res.json({
      message: 'Subscription cancelled. You\'ll keep access until the end of your billing period.',
      subscription: await getSubscriptionStatus(req.user.id)
    });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// ── Feature map (updated: scanning is free) ──
router.get('/features', async (req, res) => {
  res.json({
    free: {
      scanning: 'unlimited',
      health_scores: true,
      ingredient_warnings: true,
      allergen_alerts: true,
      favorites: true,
      scan_history: true,
      basic_swaps: true,
      description: 'Unlimited scanning with health scores, allergen alerts, and swap suggestions'
    },
    premium: {
      everything_in_free: true,
      pantry_management: true,
      pantry_health_audit: true,
      smart_shopping_lists: true,
      consumption_velocity: true,
      detailed_progress: true,
      achievements: true,
      kid_approval_ratings: true,
      description: 'Pantry management, smart shopping lists, velocity tracking, and detailed analytics'
    },
    plans: PLANS,
    trial: { duration_days: 30, includes: 'All premium features', no_credit_card: true }
  });
});

export default router;
