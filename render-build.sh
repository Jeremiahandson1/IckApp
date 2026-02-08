#!/bin/bash
# ═══════════════════════════════════════════
# Ick — Render Build Script
# Build only. DB work happens at runtime (start.sh).
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

echo ""
echo "═══════════════════════════════════════"
echo "  ✓ Build complete!"
echo "═══════════════════════════════════════"
