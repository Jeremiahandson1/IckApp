#!/bin/bash
# ═══════════════════════════════════════════
# Ick — Render Start Script
# Runs at runtime (internal DB URL available).
# DB init + seed + import, then start server.
# ═══════════════════════════════════════════
set -e

cd backend

# 1. Initialize database schema (IF NOT EXISTS — idempotent)
echo "▸ Initializing database schema..."
node -e "
  import('./src/db/init.js')
    .then(m => m.initDatabase ? m.initDatabase() : (m.default ? m.default() : null))
    .then(() => { console.log('  ✓ Schema ready'); process.exit(0); })
    .catch(e => { console.error('Schema error:', e.message); process.exit(1); });
"

# 2. Seed data (harmful ingredients, recipes, curated products, swap mappings)
#    Uses ON CONFLICT DO NOTHING — safe to re-run on every deploy
echo ""
echo "▸ Seeding data..."
node src/db/seed.js 2>&1 || echo "⚠ Seed script had issues (non-fatal, continuing)"

# 3. Import Open Food Facts products (resumes from where it left off)
echo ""
echo "▸ Checking product import status..."
PRODUCT_COUNT=$(node -e "
  import pg from 'pg';
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query('SELECT COUNT(*) FROM products').then(r => { console.log(r.rows[0].count); pool.end(); }).catch(() => { console.log('0'); pool.end(); });
" 2>/dev/null || echo "0")

echo "  Current products in DB: $PRODUCT_COUNT"

TARGET=25000
if [ "$PRODUCT_COUNT" -lt "$TARGET" ]; then
  # Calculate start page (100 products per page, ~70% import rate)
  START_PAGE=$(( PRODUCT_COUNT / 70 + 1 ))
  REMAINING=$(( TARGET - PRODUCT_COUNT ))
  echo "  ▸ Resuming import from page $START_PAGE (~$REMAINING products remaining)..."
  node src/db/import-off.js --limit=$TARGET --start-page=$START_PAGE 2>&1 || echo "  ⚠ Import had issues (non-fatal)"
else
  echo "  ✓ Products already imported ($PRODUCT_COUNT products). Skipping."
fi

# 4. Start the server
echo ""
echo "═══════════════════════════════════════"
echo "  ✓ Starting Ick server..."
echo "═══════════════════════════════════════"
exec node src/server.js
