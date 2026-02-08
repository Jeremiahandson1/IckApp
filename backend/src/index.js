import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Database (must come after dotenv so DATABASE_URL is available)
import { initDatabase } from './db/init.js';
import { requirePremium } from './middleware/subscription.js';

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
// import krogerRoutes from './routes/kroger.js'; // Future: Kroger API integration

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || true, // true reflects the request origin (safe for dev, requires FRONTEND_URL in prod)
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
// Free routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Premium routes (trial or paid required for full access)
// Note: individual routes already handle authenticateToken
// This adds a subscription check layer on top
const premiumCheck = (req, res, next) => {
  // Skip subscription check for OPTIONS requests
  if (req.method === 'OPTIONS') return next();
  // Let the route's own auth run first, then check premium in the route
  next();
};
app.use('/api/pantry', pantryRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/velocity', velocityRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/analytics', analyticsRoutes);
// app.use('/api/kroger', krogerRoutes); // Future: Kroger API integration

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
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Ick API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export default app;
