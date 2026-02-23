#!/usr/bin/env node
// ============================================================
// BATCH SCORING — Run the Ick scoring engine on all products
// that haven't been properly scored yet.
//
// Run from Render shell:
//   cd /opt/render/project/src/backend
//   node src/db/batch-score.js
//
// What it does:
//   - Reads products in batches of 200
//   - Runs the full scoring engine (nutrition + additives + organic)
//   - Updates nutrition_score, additives_score, organic_bonus
//   - total_score is auto-computed by Postgres (generated column)
//   - Skips products with no ingredients AND no nutriscore_grade
//     (nothing to score — they keep the default 50)
// ============================================================

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
});

const BATCH_SIZE = 200;
const CONCURRENCY = 20; // score 20 products at once within each batch
const REPORT_EVERY = 1000;

// ── STATS ──
const stats = {
  total: 0,
  scored: 0,
  skipped_no_data: 0,
  errors: 0,
  start_time: Date.now(),
};

// ── CACHE harmful ingredients (loaded once) ──
let harmfulIngredients = null;

async function loadHarmfulIngredients() {
  const result = await pool.query('SELECT * FROM harmful_ingredients');
  harmfulIngredients = result.rows;
  console.log(`  ✓ Loaded ${harmfulIngredients.length} harmful ingredients`);
}

// ── SCORING FUNCTIONS (inline to avoid module resolution issues) ──

function nutriscoreGradeToScore(grade) {
  if (!grade) return null;
  const map = { a: 95, b: 75, c: 50, d: 25, e: 10 };
  return map[grade.toLowerCase()] ?? null;
}

function computeNutritionFromNutrients(n) {
  if (!n) return null;
  const energy = n.energy_kcal_100g ?? n['energy-kcal_100g'] ?? null;
  const sugars = n.sugars_100g ?? null;
  const satFat = n['saturated-fat_100g'] ?? n.saturated_fat_100g ?? null;
  const sodium = n.sodium_100g ?? null;
  const fiber = n.fiber_100g ?? null;
  const protein = n.proteins_100g ?? null;

  let dataPoints = 0;
  if (energy !== null) dataPoints++;
  if (sugars !== null) dataPoints++;
  if (satFat !== null) dataPoints++;
  if (sodium !== null) dataPoints++;
  if (dataPoints < 2) return null;

  const energyPts = energy !== null ? Math.min(10, Math.floor(energy / 335)) : 5;
  const sugarPts = sugars !== null ? Math.min(10, Math.floor(sugars / 4.5)) : 5;
  const satFatPts = satFat !== null ? Math.min(10, Math.floor(satFat / 1)) : 5;
  const sodiumPts = sodium !== null ? Math.min(10, Math.floor((sodium * 1000) / 90)) : 5;
  const fiberPts = fiber !== null ? Math.min(5, Math.floor(fiber / 0.9)) : 0;
  const proteinPts = protein !== null ? Math.min(5, Math.floor(protein / 1.6)) : 0;

  const rawScore = (energyPts + sugarPts + satFatPts + sodiumPts) - (fiberPts + proteinPts);
  return Math.max(0, Math.min(100, Math.round(100 - (rawScore + 10) * 2)));
}

function adjustForNova(score, nova) {
  if (!nova || score === null) return score;
  const adj = { 1: 5, 2: 0, 3: -5, 4: -10 };
  return Math.max(0, Math.min(100, score + (adj[nova] ?? 0)));
}

function computeAdditivesScore(ingredientsText) {
  if (!ingredientsText || ingredientsText.length < 3) return { score: 75, found: [] };

  const lower = ingredientsText.toLowerCase();
  const found = [];

  for (const h of harmfulIngredients) {
    const names = [h.name];
    if (h.aliases) {
      const aliases = typeof h.aliases === 'string' ? JSON.parse(h.aliases) : h.aliases;
      names.push(...(Array.isArray(aliases) ? aliases : []));
    }
    for (const name of names) {
      if (!name) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
        found.push({ name: h.name, severity: h.severity });
        break;
      }
    }
  }

  if (found.length === 0) return { score: 100, found: [] };

  const sorted = [...found].sort((a, b) => b.severity - a.severity);
  let penalty = 0;
  sorted.forEach((f, i) => {
    penalty += f.severity * 4 * (1 / (1 + i * 0.3));
  });

  let score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  if (found.some(f => f.severity >= 8)) score = Math.min(score, 25);
  else if (found.some(f => f.severity >= 6)) score = Math.min(score, 55);

  return { score, found };
}

function detectOrganic(isOrganic, allergenTags) {
  if (isOrganic) return 100;
  return 0;
}

// ── SCORE ONE PRODUCT ──
function scoreProduct(product) {
  // Nutrition score
  let nutritionScore = nutriscoreGradeToScore(product.nutriscore_grade);
  if (nutritionScore === null && product.nutrition_facts) {
    const nf = typeof product.nutrition_facts === 'string'
      ? JSON.parse(product.nutrition_facts)
      : product.nutrition_facts;
    nutritionScore = computeNutritionFromNutrients(nf);
  }
  if (nutritionScore === null) nutritionScore = 50;
  nutritionScore = adjustForNova(nutritionScore, product.nova_group);

  // Additives score
  const { score: additivesScore, found } = computeAdditivesScore(product.ingredients || '');

  // Organic bonus
  const organicBonus = detectOrganic(product.is_organic);

  return {
    nutrition_score: Math.round(nutritionScore),
    additives_score: Math.round(additivesScore),
    organic_bonus: Math.round(organicBonus),
    harmful_ingredients_found: JSON.stringify(found),
  };
}

// ── PROCESS A BATCH ──
async function processBatch(products) {
  // Run in chunks of CONCURRENCY
  const chunks = [];
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    chunks.push(products.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (product) => {
      try {
        // Skip if truly no scoreable data
        const hasIngredients = product.ingredients && product.ingredients.length > 5;
        const hasNutriscore = product.nutriscore_grade;
        const hasNutrition = product.nutrition_facts &&
          typeof product.nutrition_facts === 'object' &&
          Object.keys(product.nutrition_facts).length > 0;

        if (!hasIngredients && !hasNutriscore && !hasNutrition) {
          stats.skipped_no_data++;
          return;
        }

        const scores = scoreProduct(product);

        await pool.query(
          `UPDATE products 
           SET nutrition_score = $1,
               additives_score = $2,
               organic_bonus = $3,
               harmful_ingredients_found = $4
           WHERE upc = $5`,
          [
            scores.nutrition_score,
            scores.additives_score,
            scores.organic_bonus,
            scores.harmful_ingredients_found,
            product.upc,
          ]
        );

        stats.scored++;
      } catch (err) {
        stats.errors++;
      }
    }));
  }
}

// ── MAIN ──
async function main() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║     ICK — BATCH PRODUCT SCORING           ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');

  // Verify DB
  try {
    const r = await pool.query('SELECT COUNT(*) as c FROM products');
    console.log(`  ✓ DB connected. Total products: ${r.rows[0].c}`);
  } catch (err) {
    console.error('  ✗ DB connection failed:', err.message);
    process.exit(1);
  }

  // Load harmful ingredients once
  await loadHarmfulIngredients();

  // Count products to score (those with default scores OR unscored)
  // We score ALL products — fast enough and ensures correctness
  const countResult = await pool.query(`
    SELECT COUNT(*) as c FROM products
    WHERE (ingredients IS NOT NULL AND LENGTH(ingredients) > 5)
       OR nutriscore_grade IS NOT NULL
       OR (nutrition_facts IS NOT NULL AND nutrition_facts != '{}')
  `);
  const toScore = parseInt(countResult.rows[0].c);
  console.log(`  Products to score: ${toScore.toLocaleString()}`);
  console.log(`  Batch size: ${BATCH_SIZE} | Concurrency: ${CONCURRENCY}`);
  console.log('');

  // Process in batches using cursor (offset-based)
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await pool.query(
      `SELECT upc, ingredients, nutriscore_grade, nova_group, 
              nutrition_facts, is_organic
       FROM products
       WHERE (ingredients IS NOT NULL AND LENGTH(ingredients) > 5)
          OR nutriscore_grade IS NOT NULL
          OR (nutrition_facts IS NOT NULL AND nutrition_facts != '{}')
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (result.rows.length === 0) {
      hasMore = false;
      break;
    }

    await processBatch(result.rows);

    stats.total += result.rows.length;
    offset += result.rows.length;

    if (stats.total % REPORT_EVERY === 0 || result.rows.length < BATCH_SIZE) {
      const elapsed = ((Date.now() - stats.start_time) / 1000).toFixed(1);
      const rate = Math.round(stats.total / parseFloat(elapsed));
      process.stdout.write(
        `\r  ${stats.total.toLocaleString()} processed | ` +
        `${stats.scored.toLocaleString()} scored | ` +
        `${stats.skipped_no_data.toLocaleString()} skipped | ` +
        `${rate}/sec        `
      );
    }

    if (result.rows.length < BATCH_SIZE) hasMore = false;
  }

  // Final report
  const elapsed = ((Date.now() - stats.start_time) / 1000).toFixed(1);
  console.log('\n');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║           SCORING COMPLETE                 ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log(`  Total processed:  ${stats.total.toLocaleString()}`);
  console.log(`  Scored:           ${stats.scored.toLocaleString()}`);
  console.log(`  Skipped (no data):${stats.skipped_no_data.toLocaleString()}`);
  console.log(`  Errors:           ${stats.errors.toLocaleString()}`);
  console.log(`  Time:             ${elapsed}s`);

  // Show score distribution
  const dist = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE total_score >= 75) as excellent,
      COUNT(*) FILTER (WHERE total_score >= 51 AND total_score < 75) as good,
      COUNT(*) FILTER (WHERE total_score >= 26 AND total_score < 51) as poor,
      COUNT(*) FILTER (WHERE total_score < 26) as avoid,
      COUNT(*) FILTER (WHERE total_score IS NULL) as unscored
    FROM products
  `);
  const d = dist.rows[0];
  console.log('\n  Score distribution:');
  console.log(`  🟢 Excellent (75+): ${parseInt(d.excellent).toLocaleString()}`);
  console.log(`  🟡 Good (51-74):    ${parseInt(d.good).toLocaleString()}`);
  console.log(`  🟠 Poor (26-50):    ${parseInt(d.poor).toLocaleString()}`);
  console.log(`  🔴 Avoid (0-25):    ${parseInt(d.avoid).toLocaleString()}`);
  console.log(`  ⚪ Unscored:        ${parseInt(d.unscored).toLocaleString()}`);

  await pool.end();
  console.log('\n  ✓ Done!\n');
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
