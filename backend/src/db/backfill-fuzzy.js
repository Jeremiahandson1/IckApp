// Tier-3 fuzzy backfill — for the ~400K products with brand strings that
// didn't match any alias exactly, try pg_trgm similarity against
// brand_aliases.alias with a conservative threshold.
//
// STATUS: written but the initial DISTINCT scan over 845K rows times out
// at Render's tier statement_timeout. To make this work you'd need either
// (a) a DB plan upgrade with more memory/IO, or (b) chunk the work by
// product.id ranges (say 50K at a time). Architecture is in place —
// see normalize_brand() function and the per-alias loop logic below.
//
// Conservative threshold (0.85) — risks false positives if too low. At
// 0.85 we mostly catch typos and trivial variants:
//   "Pepsico" → "pepsico"   (sim 1.0)
//   "Lay's"   → "lays"      (sim 1.0)
//   "KitKats" → "kitkat"    (sim ~0.86)
//
// Things at 0.70 would be too loose (e.g. "Traders Choice" would match
// "trader joe's" at ~0.75 — not actually the same brand).
//
// Idempotent — only touches products with company_id IS NULL.

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  statement_timeout: 60000,
});

const SIMILARITY_THRESHOLD = 0.85;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`Tier-3 fuzzy backfill  (threshold=${SIMILARITY_THRESHOLD}, dry-run=${DRY_RUN})\n`);

  // Pull distinct unmatched normalized brands with their product counts.
  console.log('Loading distinct unmatched brand strings…');
  const t0 = Date.now();
  const distinctRes = await pool.query(`
    SELECT normalize_brand(brand) AS norm,
           MIN(brand) AS sample_brand,
           COUNT(*)::int AS product_count
    FROM products
    WHERE company_id IS NULL
      AND brand IS NOT NULL AND brand != ''
    GROUP BY normalize_brand(brand)
    HAVING normalize_brand(brand) != ''
    ORDER BY product_count DESC
  `);
  const distincts = distinctRes.rows;
  console.log(`  ${distincts.length} distinct unmatched normalized brands  (${Date.now() - t0}ms)`);

  // For each, find best fuzzy alias match (with similarity > threshold).
  let withMatch = 0;
  let noMatch = 0;
  const updates = []; // {norm, sample, count, alias, company_id, sim}

  for (let i = 0; i < distincts.length; i++) {
    const { norm, sample_brand, product_count } = distincts[i];
    try {
      const match = await pool.query(
        `SELECT ba.alias, ba.company_id, c.behavior_score, c.name,
                similarity(ba.alias, $1) AS sim
         FROM brand_aliases ba JOIN companies c ON ba.company_id = c.id
         WHERE ba.alias % $1
         ORDER BY sim DESC LIMIT 1`,
        [norm]
      );
      if (match.rows.length > 0 && match.rows[0].sim >= SIMILARITY_THRESHOLD) {
        const m = match.rows[0];
        updates.push({ norm, sample: sample_brand, count: product_count, ...m });
        withMatch++;
      } else {
        noMatch++;
      }
    } catch { noMatch++; }

    if ((i + 1) % 500 === 0 || i + 1 === distincts.length) {
      process.stdout.write(`\r  scanned ${i + 1}/${distincts.length}  fuzzy-matches=${withMatch}`);
    }
  }
  console.log();

  console.log(`\nFuzzy matches found:        ${withMatch}`);
  console.log(`Distinct brands w/o match:  ${noMatch}`);
  console.log(`Potential products covered: ${updates.reduce((s, u) => s + u.count, 0)}`);

  console.log('\nSample matches:');
  for (const u of updates.slice(0, 12)) {
    console.log(`  '${u.sample}' (${u.count} products) → ${u.name} via '${u.alias}' (sim ${Number(u.sim).toFixed(2)})`);
  }

  if (DRY_RUN) {
    console.log('\n(dry-run — no updates)');
    await pool.end();
    return;
  }

  // Apply updates per normalized brand
  console.log('\nApplying updates…');
  let updatedProducts = 0;
  for (const u of updates) {
    try {
      const r = await pool.query(
        `UPDATE products SET company_id = $1, company_behavior_score = $2
         WHERE company_id IS NULL AND normalize_brand(brand) = $3`,
        [u.company_id, u.behavior_score, u.norm]
      );
      updatedProducts += r.rowCount;
    } catch (e) {
      console.warn(`  '${u.sample}' failed: ${e.message}`);
    }
  }
  console.log(`✓ updated ${updatedProducts} products via fuzzy match`);

  const after = await pool.query("SELECT COUNT(*) FILTER (WHERE company_id IS NOT NULL)::int AS n FROM products");
  console.log(`Total matched products now: ${after.rows[0].n.toLocaleString()}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
