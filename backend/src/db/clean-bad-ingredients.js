// One-shot cleanup: NULL out garbage `ingredients` values in the products table
// so the next scan re-hydrates clean data from Open Food Facts / USDA.
//
// "Garbage" = ingredient text that fails the same looksLikeRealIngredients()
// sanity check used by the scoring engine (no separators on long strings, or
// no recognizable food-list words). This catches OCR noise like
// "75 Salty Portes GOLDEN SRIRACHA TANGY..." that was producing inflated
// "CLEAN" scores on heavily-additive products.
//
// Usage:
//   node src/db/clean-bad-ingredients.js              # actually clean
//   node src/db/clean-bad-ingredients.js --dry-run    # report only, no writes
//   node src/db/clean-bad-ingredients.js --limit=50   # cap rows examined
//
// Safe to re-run. Only touches rows where ingredients is non-empty but bogus.

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  query_timeout: 60000,
});

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

// Same heuristic as backend/src/utils/scoring.js — keep in sync.
// "Innocent until proven garbage" — only flags obvious junk so we don't
// nuke valid single-ingredient ("maple", "pineapple") or non-English lists.
function looksLikeGarbageIngredients(text) {
  if (!text) return false;
  const t = String(text).trim();
  if (t.length === 0) return false;

  if (/^(undefined|null|n\/a|none|tbd|\?|\.+)\s*\.{0,3}$/i.test(t)) return true;

  const letterCount = (t.match(/[A-Za-zÀ-ɏЀ-ӿ؀-ۿ一-鿿]/g) || []).length;
  if (t.length > 10 && letterCount / t.length < 0.4) return true;

  if (/\bNET\s*WT\b|\bSELL\s*BY\b|\bUSE\s*BY\b|\bEXP\.?\s*\d|\bBEST\s*BY\b/i.test(t)) return true;
  if (/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{4}\b/i.test(t)) return true;
  if (/\$\s?\d/.test(t)) return true;

  if (/\b(serving\s*size|calories|carbohydrates?|saturated\s*fat|cholesterol|daily\s*values?|added\s*sugars?)\b/i.test(t)) {
    const commas = (t.match(/,/g) || []).length;
    if (commas < 3) return true;
  }

  if (/\b(\w{3,8})\b\s+\b\1\b/i.test(t)) return true;

  return false;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'CLEANING (writes enabled)'}\n`);

  // Pull rows with non-empty ingredients. We intentionally do not filter in
  // SQL — the heuristic is JS-side so it stays in sync with scoring.js.
  const q = `
    SELECT upc, name, brand, LEFT(ingredients, 200) AS ingredients_preview, LENGTH(ingredients) AS ing_len
    FROM products
    WHERE ingredients IS NOT NULL AND LENGTH(ingredients) > 0
    ${LIMIT ? `LIMIT ${LIMIT}` : ''}
  `;
  const { rows } = await pool.query(q);
  console.log(`Examining ${rows.length} products with ingredient data...\n`);

  const bad = [];
  for (const row of rows) {
    if (looksLikeGarbageIngredients(row.ingredients_preview)) {
      bad.push(row);
    }
  }

  console.log(`Found ${bad.length} products with garbage-looking ingredients (${((bad.length / rows.length) * 100).toFixed(1)}% of examined rows)\n`);

  if (bad.length === 0) {
    console.log('Nothing to clean.');
    await pool.end();
    return;
  }

  // Show the first 20 as a sample
  console.log('Sample (first 20):');
  for (const row of bad.slice(0, 20)) {
    console.log(`  [${row.upc}] ${row.brand || '?'} — ${row.name || '?'}`);
    console.log(`    "${row.ingredients_preview.slice(0, 120).replace(/\s+/g, ' ')}..."`);
  }
  if (bad.length > 20) console.log(`  ... and ${bad.length - 20} more`);
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN — no writes performed. Re-run without --dry-run to clean.');
    await pool.end();
    return;
  }

  // NULL the ingredients on each bad row. Re-score happens automatically on
  // next scan via the existing re-score-on-scan path.
  let cleaned = 0;
  for (const row of bad) {
    await pool.query(
      `UPDATE products SET ingredients = NULL WHERE upc = $1`,
      [row.upc]
    );
    cleaned++;
  }

  console.log(`Cleaned ${cleaned} products. Their ingredient fields are now NULL — next scan will re-hydrate from Open Food Facts.`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
