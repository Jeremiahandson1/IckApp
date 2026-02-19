import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Database (must come after dotenv so DATABASE_URL is available)
import { initDatabase } from './db/init.js';

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

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production'
    ? false  // Block all cross-origin requests if FRONTEND_URL not set in prod
    : true), // Reflect origin in dev only
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

// Stricter rate limit for scan endpoint — each scan can trigger 3 external API calls
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150, // 150 scans per 15 min per IP
  message: { error: 'Too many scans. Please wait a few minutes.' }
});
app.use('/api/products/scan', scanLimiter);

// Body parsing
// Stripe webhook needs raw body for signature verification — mount before json parser
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
// Free routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
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

// Initialize database tables then start server
initDatabase()
  .then(async () => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Ick API running on port ${PORT}`);
    });

    // Apply curated swap mappings (100 top products get verified swaps_to)
    try {
      const { seedCuratedSwaps } = await import('./db/seed-swaps.js');
      await seedCuratedSwaps();
    } catch (e) {
      console.warn('⚠ Curated swaps seed skipped (non-fatal):', e.message);
    }

    // Seed curated store availability (ground truth — always runs)
    try {
      const { initCuratedAvailability } = await import('./services/curatedStores.js');
      await initCuratedAvailability();
    } catch (e) {
      console.warn('⚠ Curated availability seed failed (non-fatal):', e.message);
    }

    // Start flyer crawler (30s delay, then daily at 3AM UTC)
    setTimeout(async () => {
      try {
        const { startCrawlScheduler } = await import('./services/flyerCrawler.js');
        startCrawlScheduler();
        console.log('▸ Flyer crawler scheduled');
      } catch (e) {
        console.warn('⚠ Flyer crawler start failed (non-fatal):', e.message);
      }
    }, 30000);
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export default app;
