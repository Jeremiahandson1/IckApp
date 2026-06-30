// Backfill real 5-dimension scores for products created by the dynamic swap
// discovery engine BEFORE the scoring fix.
//
// The old saveDiscoveries() in swap-discovery.js only estimated processing +
// transparency and left harmful_ingredients_score / banned_elsewhere_score /
// company_behavior_score at the DB default of 50. Since harmful ingredients is
// 40% of the total, those discovered "better alternatives" were never actually
// evaluated on the thing the app exists to measure — their total_score was
// mostly fixed noise.
//
// This re-scores every discovered product (swap_discovery_type IS NOT NULL)
// through the REAL scoreProduct() engine and writes the correct dimensions
// back. It's idempotent — running it again on an already-correct row just
// rewrites the same values — so it's safe to re-run. total_score is a DB
// trigger column and recomputes automatically on UPDATE.
//
// Usage:
//   node src/db/backfill-discovered-swaps.js          # actually update
//   node src/db/backfill-discovered-swaps.js --dry    # report only

import 'dotenv/config';
if (!process.env.NODE_ENV && process.env.DATABASE_URL?.includes('render.com')) {
  process.env.NODE_ENV = 'production';
}
import pg from 'pg';
const { scoreProduct } = await import('../utils/scoring.js');

const DRY = process.argv.includes('--dry');
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

async function main() {
  console.log(`Mode: ${DRY ? 'DRY RUN' : 'WRITE'}\n`);

  const { rows } = await pool.query(`
    SELECT upc, name, brand, total_score AS old_total,
           harmful_ingredients_score AS old_harm,
           processing_score AS old_proc,
           ingredients, nutriscore_grade, nova_group,
           nutrition_facts, certifications, allergens_tags, is_organic, image_url
    FROM products
    WHERE swap_discovery_type IS NOT NULL
  `);
  console.log(`Found ${rows.length} discovered swap products to re-score.\n`);

  let changed = 0, unchanged = 0, failed = 0;

  for (const p of rows) {
    try {
      const fresh = await scoreProduct({
        ingredients: p.ingredients || '',
        brand: p.brand || '',
        nutriscore_grade: p.nutriscore_grade,
        nova_group: p.nova_group,
        nutriments: p.nutrition_facts,
        labels: p.certifications || [],
        allergens_tags: p.allergens_tags || [],
        is_organic: !!p.is_organic,
        image_url: p.image_url,
      });

      const newTotal = Math.round(
        fresh.harmful_ingredients_score * 0.40 +
        fresh.banned_elsewhere_score    * 0.20 +
        fresh.transparency_score        * 0.15 +
        fresh.processing_score          * 0.15 +
        fresh.company_behavior_score    * 0.10
      );

      if (newTotal === (p.old_total ?? 0) &&
          fresh.harmful_ingredients_score === p.old_harm &&
          fresh.processing_score === p.old_proc) {
        unchanged++;
        continue;
      }

      // Show notable swings (either direction) so the run is auditable
      if (Math.abs(newTotal - (p.old_total ?? 0)) >= 5) {
        console.log(`  [${p.upc}] ${(p.brand || '?').slice(0, 20)} — ${(p.name || '?').slice(0, 40)}`);
        console.log(`    total ${p.old_total}->${newTotal} | harm ${p.old_harm}->${fresh.harmful_ingredients_score} | proc ${p.old_proc}->${fresh.processing_score} | ${fresh.harmful_ingredients_found.length} flagged`);
      }

      if (!DRY) {
        await pool.query(
          `UPDATE products SET
             harmful_ingredients_score = $1,
             banned_elsewhere_score    = $2,
             transparency_score        = $3,
             processing_score          = $4,
             company_behavior_score    = $5,
             harmful_ingredients_found = $6,
             updated_at                = NOW()
           WHERE upc = $7`,
          [
            fresh.harmful_ingredients_score,
            fresh.banned_elsewhere_score,
            fresh.transparency_score,
            fresh.processing_score,
            fresh.company_behavior_score,
            JSON.stringify(fresh.harmful_ingredients_found),
            p.upc,
          ]
        );
      }
      changed++;
    } catch (e) {
      failed++;
      console.warn(`  [${p.upc}] re-score failed: ${e.message}`);
    }
  }

  console.log(`\nDone. ${changed} ${DRY ? 'would change' : 'updated'}, ${unchanged} unchanged, ${failed} failed.`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
