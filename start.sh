#!/bin/bash
# ═══════════════════════════════════════════
# Ick — Render Start Script
# Starts server immediately, imports in background.
# ═══════════════════════════════════════════
set -e

cd backend

# 1. Initialize database schema (fast — just CREATE IF NOT EXISTS)
echo "▸ Initializing database schema..."
node -e "
  import('./src/db/init.js')
    .then(m => m.initDatabase ? m.initDatabase() : (m.default ? m.default() : null))
    .then(() => { console.log('  ✓ Schema ready'); process.exit(0); })
    .catch(e => { console.error('Schema error:', e.message); process.exit(1); });
"

# 2. Seed core data (fast — ON CONFLICT DO NOTHING)
echo ""
echo "▸ Seeding data..."
node src/db/seed.js 2>&1 || echo "⚠ Seed script had issues (non-fatal, continuing)"

# 3. Start the server FIRST (so Render detects the port)
echo ""
echo "═══════════════════════════════════════"
echo "  ✓ Starting Ick server..."
echo "═══════════════════════════════════════"
node src/index.js &
SERVER_PID=$!

# 4. Wait for server to bind port
sleep 3

# 5. Import products in background (won't block the server)
PRODUCT_COUNT=$(node -e "
  import pg from 'pg';
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query('SELECT COUNT(*) FROM products').then(r => { console.log(r.rows[0].count); pool.end(); }).catch(() => { console.log('0'); pool.end(); });
" 2>/dev/null || echo "0")

echo "  Current products in DB: $PRODUCT_COUNT"

TARGET=25000
if [ "$PRODUCT_COUNT" -lt "$TARGET" ]; then
  START_PAGE=$(( PRODUCT_COUNT / 70 + 1 ))
  REMAINING=$(( TARGET - PRODUCT_COUNT ))
  echo "  ▸ Background import from page $START_PAGE (~$REMAINING products remaining)..."
  node src/db/import-off.js --limit=$TARGET --start-page=$START_PAGE 2>&1 &
  echo "  ▸ Import running in background. Server is live."
else
  echo "  ✓ Products already imported ($PRODUCT_COUNT products). Skipping."
fi

# Wait for server process (keeps container alive)
wait $SERVER_PID
