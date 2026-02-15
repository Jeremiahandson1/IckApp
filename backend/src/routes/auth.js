import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/init.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { startTrial, getSubscriptionStatus } from '../middleware/subscription.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, zip_code, household_size, has_kids, kids_ages, allergen_alerts } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, zip_code, household_size, has_kids, kids_ages, allergen_alerts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, zip_code, household_size, has_kids, kids_ages, allergen_alerts, created_at`,
      [email, passwordHash, name, zip_code, household_size || 1, has_kids || false, JSON.stringify(kids_ages || []), JSON.stringify(allergen_alerts || [])]
    );

    const user = result.rows[0];

    // Create engagement tracking record
    await pool.query(
      'INSERT INTO user_engagement (user_id) VALUES ($1)',
      [user.id]
    );

    // Start on free tier — trial offered after first scan limit hit
    const subscription = await getSubscriptionStatus(user.id);

    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        zip_code: user.zip_code,
        household_size: user.household_size,
        has_kids: user.has_kids,
        kids_ages: user.kids_ages,
        allergen_alerts: user.allergen_alerts,
        subscription
      },
      token
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const subscription = await getSubscriptionStatus(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        zip_code: user.zip_code,
        household_size: user.household_size,
        has_kids: user.has_kids,
        kids_ages: user.kids_ages,
        allergen_alerts: user.allergen_alerts,
        subscription
      },
      token
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token (extends session without re-login)
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Verify user still exists
    const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const token = generateToken(result.rows[0]);
    res.json({ token });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Get profile
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

    // Get subscription status
    const subscription = await getSubscriptionStatus(req.user.id);

    res.json({ user: { ...result.rows[0], subscription } });

  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
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
      [name, zip_code, household_size, has_kids, kids_ages ? JSON.stringify(kids_ages) : null, allergen_alerts ? JSON.stringify(allergen_alerts) : null, req.user.id]
    );

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Save push notification subscription
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

// Bootstrap: promote to admin (only works if NO admins exist yet)
router.post('/bootstrap-admin', authenticateToken, async (req, res) => {
  try {
    const adminCheck = await pool.query('SELECT COUNT(*) FROM users WHERE is_admin = true');
    if (parseInt(adminCheck.rows[0].count) > 0) {
      return res.status(403).json({ error: 'Admin already exists. Ask an existing admin to promote you.' });
    }

    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [req.user.id]);
    res.json({ promoted: true, message: 'You are now the first admin.' });
  } catch (err) {
    // is_admin column may not exist yet
    res.status(500).json({ error: 'Failed. Run database migration first.' });
  }
});

export default router;
