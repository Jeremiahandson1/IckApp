#!/bin/bash
# ═══════════════════════════════════════════
# Ick — Render Build Script
# Runs on every deploy. Idempotent — safe to re-run.
# ═══════════════════════════════════════════
set -e

echo "═══════════════════════════════════════"
echo "  Ick Build (Render)"
echo "═══════════════════════════════════════"

# 1. Install backend dependencies
echo ""
echo "▸ Installing backend dependencies..."
cd backend
npm install --production
cd ..

# 2. Install frontend dependencies and build
echo ""
echo "▸ Installing frontend dependencies..."
cd frontend
npm install --include=dev
echo ""
echo "▸ Building frontend..."
npm run build
cd ..

# 3. Initialize database schema (IF NOT EXISTS — idempotent)
echo ""
echo "▸ Initializing database schema..."
cd backend
node -e "
  import('./src/db/init.js')
    .then(m => m.initDatabase ? m.initDatabase() : (m.default ? m.default() : null))
    .then(() => { console.log('  ✓ Schema ready'); process.exit(0); })
    .catch(e => { console.error('Schema error:', e.message); process.exit(1); });
"

# 4. Seed data (harmful ingredients, recipes, curated products, swap mappings)
#    Uses ON CONFLICT DO NOTHING — safe to re-run on every deploy
echo ""
echo "▸ Seeding data (harmful ingredients, 56 recipes, products, swaps)..."
node src/db/seed.js 2>&1 || echo "⚠ Seed script had issues (non-fatal, continuing)"

# 5. Import Open Food Facts products (first deploy only — check if already done)
echo ""
echo "▸ Checking product import status..."
PRODUCT_COUNT=$(node -e "
  import pg from 'pg';
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query('SELECT COUNT(*) FROM products').then(r => { console.log(r.rows[0].count); pool.end(); }).catch(() => { console.log('0'); pool.end(); });
" 2>/dev/null || echo "0")

echo "  Current products in DB: $PRODUCT_COUNT"

if [ "$PRODUCT_COUNT" -lt "1000" ]; then
  echo "  ▸ Importing 25,000 products from Open Food Facts..."
  echo "    (This runs once. Future deploys skip this step.)"
  echo "    Estimated time: 10-15 minutes."
  node src/db/import-off.js --limit=25000 2>&1 || echo "  ⚠ Import had issues (non-fatal)"
else
  echo "  ✓ Products already imported ($PRODUCT_COUNT products). Skipping."
fi

cd ..

echo ""
echo "═══════════════════════════════════════"
echo "  ✓ Build complete!"
echo "═══════════════════════════════════════"
