import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Database (must come after dotenv so DATABASE_URL is available)
import pool, { initDatabase } from './db/init.js';

// Routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import pantryRoutes from './routes/pantry.js';
import swapRoutes from './routes/swaps.js';
import recipeRoutes from './routes/recipes.js';
import shoppingRoutes from './routes/shopping.js';
import velocityRoutes from './routes/velocity.js';
import progressRoutes from './routes/progress.js';
import subscriptionRoutes from './routes/subscription.js';
import analyticsRoutes from './routes/analytics.js';
import krogerRoutes from './routes/kroger.js';
import sightingsRoutes from './routes/sightings.js';
import adminRoutes from './routes/admin.js';
import receiptRoutes from './routes/receipts.js';
import familyRoutes from './routes/family.js';
import kidRatingsRoutes from './routes/kidRatings.js';
import contributionsRoutes from './routes/contributions.js';
import conditionsRoutes from './routes/conditions.js';
import familyGroupRoutes from './routes/familyGroups.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust one level of proxy (Render load balancer) so rate limiter gets real client IPs
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS — whitelist FRONTEND_URL (required in production) + localhost variants for dev
const ALLOWED_ORIGINS = new Set([
  // Dev origins always allowed
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  // Production — must be set via FRONTEND_URL env var
  ...( process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(u => u.trim()).filter(Boolean)
    : []
  )
]);

if (!process.env.FRONTEND_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠ FRONTEND_URL is not set — CORS will only allow localhost. Set FRONTEND_URL=https://your-domain.com in production.');
}

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Capacitor native)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    console.warn(`CORS blocked: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20 // prevent brute force
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
// Stripe webhook needs raw body for signature verification — mount before json parser
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// Database readiness flag — starts false, set to true once initDatabase() completes
let dbReady = false;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: dbReady ? 'healthy' : 'starting', dbReady, timestamp: new Date().toISOString() });
});

// Gate API routes until DB is initialized (return 503 while starting up)
app.use('/api', (req, res, next) => {
  if (!dbReady) {
    res.set('Retry-After', '5');
    return res.status(503).json({ error: 'Server is starting up, please retry shortly' });
  }
  next();
});

// VAPID public key — frontend needs this to register for web push
app.get('/api/push/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
  res.json({ publicKey: key });
});

// API Routes
// Free routes
app.use('/api/auth', authRoutes);
// Sub-routes of /api/products MUST be mounted BEFORE /api/products
// because productRoutes has a catch-all GET /:id that would shadow them otherwise
app.use('/api/products/family', familyRoutes);
app.use('/api/products/kid-ratings', kidRatingsRoutes);
app.use('/api/products/admin/contributions', contributionsRoutes);
app.use('/api/products', productRoutes);
app.use('/api/conditions', conditionsRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Premium routes (individual routes handle auth + premium checks internally)
app.use('/api/pantry', pantryRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/velocity', velocityRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/kroger', krogerRoutes);
app.use('/api/sightings', sightingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/family', familyGroupRoutes);

// Serve frontend in production
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, '../../frontend/dist');
import fs from 'fs';
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — serve index.html for all non-API routes
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log('✓ Serving frontend from', frontendDist);
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Bind port IMMEDIATELY so Render detects a listening service (avoids 5-min timeout)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ick API listening on port ${PORT} (DB init in progress…)`);
});

// Initialize database in the background — don't block port binding
(async () => {
  try {
    await initDatabase();
    dbReady = true;
    console.log('✓ Database initialized — API routes are now live');
  } catch (err) {
    console.error('✗ Database initialization failed:', err);
    // Server stays up returning 503 on /api via the gate middleware
    return;
  }

  // --- Post-init background tasks (all non-fatal) ---

  // Seed reference data (harmful_ingredients + companies) if tables are empty.
  // These are required for the scoring engine to work — without them every
  // product gets default/neutral scores.
  try {
    const hiCount = await pool.query('SELECT COUNT(*) FROM harmful_ingredients');
    const coCount = await pool.query('SELECT COUNT(*) FROM companies');
    const hiNeedsSeed = parseInt(hiCount.rows[0].count) === 0;
    const coNeedsSeed = parseInt(coCount.rows[0].count) < 100; // reseed when new companies are added
    if (hiNeedsSeed || coNeedsSeed) {
      const { harmfulIngredients, companies } = await import('./db/seed.js');
      if (hiNeedsSeed) {
        for (const h of harmfulIngredients) {
          await pool.query(
            `INSERT INTO harmful_ingredients (name, aliases, severity, category, health_effects, banned_in, why_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (name) DO NOTHING`,
            [h.name, JSON.stringify(h.aliases), h.severity, h.category,
             Array.isArray(h.health_effects) ? h.health_effects.join('. ') : h.health_effects,
             JSON.stringify(h.banned_in), h.why_used]
          );
        }
        console.log(`✓ Seeded ${harmfulIngredients.length} harmful ingredients`);
      }
      if (parseInt(coCount.rows[0].count) < companies.length) {
        for (const c of companies) {
          await pool.query(
            `INSERT INTO companies (name, parent_company, behavior_score, controversies, positive_actions, lobbying_history, transparency_rating)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (name) DO UPDATE SET
               parent_company = COALESCE(EXCLUDED.parent_company, companies.parent_company),
               behavior_score = COALESCE(EXCLUDED.behavior_score, companies.behavior_score),
               controversies = COALESCE(EXCLUDED.controversies, companies.controversies),
               positive_actions = COALESCE(EXCLUDED.positive_actions, companies.positive_actions),
               lobbying_history = COALESCE(EXCLUDED.lobbying_history, companies.lobbying_history),
               transparency_rating = COALESCE(EXCLUDED.transparency_rating, companies.transparency_rating)`,
            [c.name, c.parent_company, c.behavior_score, JSON.stringify(c.controversies),
             JSON.stringify(c.positive_actions), c.lobbying_history, c.transparency_rating]
          );
        }
        console.log(`✓ Seeded ${companies.length} companies`);
      }
    } else {
      console.log(`✓ Reference data present (${hiCount.rows[0].count} harmful ingredients, ${coCount.rows[0].count} companies)`);
    }
  } catch (e) {
    console.error('⚠ Reference data seed failed (non-fatal):', e.message, e.stack);
  }

  try {
    const { seedCuratedSwaps } = await import('./db/seed-swaps.js');
    await seedCuratedSwaps();
  } catch (e) {
    console.warn('⚠ Curated swaps seed skipped (non-fatal):', e.message);
  }

  try {
    const { initCuratedAvailability } = await import('./services/curatedStores.js');
    await initCuratedAvailability();
  } catch (e) {
    console.warn('⚠ Curated availability seed failed (non-fatal):', e.message);
  }

  setTimeout(async () => {
    try {
      const countResult = await pool.query('SELECT COUNT(*) FROM products WHERE total_score IS NOT NULL');
      const productCount = parseInt(countResult.rows[0].count);
      if (productCount === 0) {
        console.log('▸ Flyer crawler skipped — no scored products in DB yet');
        return;
      }
      const { startCrawlScheduler } = await import('./services/flyerCrawler.js');
      startCrawlScheduler();
      console.log(`▸ Flyer crawler scheduled (${productCount} products to crawl)`);
    } catch (e) {
      console.warn('⚠ Flyer crawler start failed (non-fatal):', e.message);
    }
  }, 30000);

  try {
    const { startVelocityAlertScheduler } = await import('./services/velocityAlerts.js');
    startVelocityAlertScheduler();
  } catch (e) {
    console.warn('⚠ Velocity alert scheduler failed (non-fatal):', e.message);
  }

  setInterval(async () => {
    try {
      await pool.query(`
        DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '90 days';
        DELETE FROM scan_logs WHERE scanned_at < NOW() - INTERVAL '1 year';
        DELETE FROM refresh_tokens WHERE created_at < NOW() - INTERVAL '90 days';
        DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '7 days';
      `);
      console.log('▸ Daily maintenance cleanup complete');
    } catch (e) {
      console.warn('⚠ Daily cleanup failed (non-fatal):', e.message);
    }
  }, 24 * 60 * 60 * 1000);
})();

export default app;
