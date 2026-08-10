// Force re-score of products whose ingredient text contains non-English
// additive names. After adding multilingual aliases, products previously
// scored as "no harmful additives detected" need their stored scores
// updated — the running backend's 5-min in-memory cache may serve stale
// aliases for up to 5 min after deploy.
//
// This script bypasses the cache (fresh node process) and writes correct
// scores back to the DB so the audit sees correct values immediately.
//
// Filter: products with ingredient text containing one of the multilingual
// markers (colorante, rojo allura, amarillo, amarelo, jaune, rouge, blu
// brillante, glutamato monosódico, etc.).
//
// Usage:
//   npm run db:rescore-multilingual            # actually update
//   npm run db:rescore-multilingual -- --dry   # report only

import 'dotenv/config';
if (!process.env.NODE_ENV && process.env.DATABASE_URL?.includes('render.com')) {
  process.env.NODE_ENV = 'production';
}
import pg from 'pg';
const { scoreProduct, weightedTotal } = await import('../utils/scoring.js');

const DRY = process.argv.includes('--dry');
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

// SQL ILIKE patterns for ingredient text that LIKELY contains a
// multilingual additive that needs re-scoring. Cast-a-wide-net so we
// don't miss anything; the actual re-score uses the full matcher.
const MARKERS = [
  '%colorante%',          // Spanish "coloring agent" — common prefix
  '%rojo allura%',
  '%amarillo crepúsculo%',
  '%amarillo ocaso%',
  '%azul brillante%',
  '%rouge allura%',
  '%jaune orange%',
  '%vermelho allura%',
  '%amarelo crepúsculo%',
  '%glutamato monosódico%',
  '%nitrito de sodio%',
  '%benzoato de sodio%',
  '%dióxido de titanio%',
  '%dioxyde de titane%',
  '%titandioxid%',
  '%jarabe de maíz%',
  '%sirop de glucose-fructose%',
  '%tartrazina%',
  '%butilhidroxianisol%',
  '%butilhidroxitolueno%',
  '%bromato de potasio%',
];

async function main() {
  console.log(`Mode: ${DRY ? 'DRY RUN' : 'WRITE'}\n`);

  // Build a single WHERE clause: ingredients ILIKE ANY of the markers
  const orClauses = MARKERS.map((_, i) => `ingredients ILIKE $${i + 1}`).join(' OR ');
  const q = `
    SELECT upc, name, brand, total_score AS old_total,
           harmful_ingredients_score AS old_harm,
           banned_elsewhere_score AS old_banned,
           ingredients, nutriscore_grade, nova_group,
           nutrition_facts, certifications, allergens_tags, is_organic, image_url
    FROM products
    WHERE ingredients IS NOT NULL AND (${orClauses})
  `;
  const { rows } = await pool.query(q, MARKERS);
  console.log(`Found ${rows.length} products with non-English additive markers.\n`);

  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const p of rows) {
    try {
      const fresh = await scoreProduct({
        ingredients: p.ingredients,
        brand: p.brand || '',
        nutriscore_grade: p.nutriscore_grade,
        nova_group: p.nova_group,
        nutriments: p.nutrition_facts,
        labels: p.certifications || [],
        allergens_tags: p.allergens_tags || [],
        is_organic: !!p.is_organic,
        image_url: p.image_url,
      });
      // null when any dimension is unknown — the product ends up UNSCORED.
      const newTotal = weightedTotal(fresh);

      const delta = newTotal == null ? null : newTotal - (p.old_total ?? 0);
      if (delta === 0 && fresh.harmful_ingredients_score === p.old_harm) {
        unchanged++;
        continue;
      }

      if (delta == null || delta < -5) {
        // Big drop — print these so we can see the wins
        console.log(`  [${p.upc}] ${(p.brand || '?').slice(0, 20)} — ${(p.name || '?').slice(0, 40)}`);
        console.log(`    ${p.old_total}/100 -> ${newTotal == null ? 'UNSCORED' : `${newTotal}/100`} (harm ${p.old_harm}->${fresh.harmful_ingredients_score ?? 'unknown'}, +${fresh.harmful_ingredients_found.length} flagged)`);
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
