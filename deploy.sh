#!/bin/bash
# ============================================================
# ScanAndSwap Quick Start Deploy Script
# ============================================================
# Run this after `npm install` on both frontend and backend.
#
# Usage:
#   ./deploy.sh              # Quick start: seed data + 500 products
#   ./deploy.sh --full       # Full import: seed + 50,000 products
#   ./deploy.sh --limit=5000 # Custom limit
#
# Prerequisites:
#   - PostgreSQL running with DATABASE_URL set in .env
#   - Node.js 18+
#   - npm install completed in both /backend and /frontend
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "========================================="
echo "  ScanAndSwap Deploy v2.0"
echo "========================================="
echo ""

# Check for .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "⚠️  No .env file found in backend/"
  echo "   Create one with at minimum:"
  echo "   DATABASE_URL=postgres://user:pass@localhost:5432/scanandswap"
  echo "   JWT_SECRET=your-secret-here"
  echo ""
  echo "   Copy from .env.example if available."
  exit 1
fi

# 1. Initialize database schema
echo "📦 Step 1: Initializing database schema..."
cd "$BACKEND_DIR"
node -e "import('./src/db/init.js').then(m => m.default ? m.default() : null).then(() => { console.log('  ✓ Schema ready'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })"
echo ""

# 2. Import data (harmful ingredients + companies + OFF products + curated swaps)
echo "📥 Step 2: Importing product data..."
IMPORT_ARGS=""
if [ "$1" = "--full" ]; then
  IMPORT_ARGS="--full"
  echo "   Mode: FULL import (50,000+ products — this takes ~15 minutes)"
elif [[ "$1" == --limit=* ]]; then
  IMPORT_ARGS="$1"
  echo "   Mode: Custom limit (${1#--limit=} products)"
else
  IMPORT_ARGS="--limit=500"
  echo "   Mode: Quick start (500 products for testing)"
fi

node --experimental-modules "$BACKEND_DIR/src/db/import-off.js" $IMPORT_ARGS
echo ""

# 3. Build frontend
echo "🔨 Step 3: Building frontend..."
cd "$FRONTEND_DIR"
npm run build
echo "  ✓ Frontend built"
echo ""

# 4. Summary
echo "========================================="
echo "  ✅ Deploy Complete!"
echo "========================================="
echo ""
echo "  Start the backend:  cd backend && npm start"
echo "  Or for development: cd backend && npm run dev"
echo ""
echo "  The app will be available at:"
echo "  http://localhost:3001"
echo ""
echo "  For production, set up:"
echo "  - HTTPS via nginx/Caddy"  
echo "  - Process manager (pm2)"
echo "  - Render/Railway/Fly.io deployment"
echo ""
echo "  To import more products later:"
echo "  node backend/src/db/import-off.js --limit=50000"
echo ""
