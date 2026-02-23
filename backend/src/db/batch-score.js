#!/usr/bin/env node
// BATCH SCORING v2 — Fast. Uses bulk unnest() updates + indexOf pre-filter.
// Run: cd /opt/render/project/src/backend && node src/db/batch-score.js

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  max: 20,
});

const BATCH_SIZE = 1000;
const WRITE_SIZE = 500;
const REPORT_EVERY = 5000;
const stats = { total: 0, start: Date.now() };
let harmful = [];

async function loadHarmful() {
  const { rows } = await pool.query('SELECT name, aliases, severity FROM harmful_ingredients');
  harmful = rows.map(h => {
    const aliases = h.aliases ? (typeof h.aliases === 'string' ? JSON.parse(h.aliases) : h.aliases) : [];
    const names = [h.name, ...aliases].filter(Boolean);
    const namesLower = names.map(n => n.toLowerCase());
    const pattern = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`\\b(${pattern})\\b`, 'i');
    return { name: h.name, severity: h.severity, namesLower, regex };
  });
  console.log(`  ✓ Loaded ${harmful.length} harmful ingredients`);
}

function nutriscoreToScore(grade) {
  if (!grade) return null;
  return { a: 95, b: 75, c: 50, d: 25, e: 10 }[grade.toLowerCase()] ?? null;
}

function scoreFromNutrients(n) {
  if (!n) return null;
  const energy = n.energy_kcal_100g ?? n['energy-kcal_100g'] ?? null;
  const sugars = n.sugars_100g ?? null;
  const satFat = n['saturated-fat_100g'] ?? n.saturated_fat_100g ?? null;
  const sodium = n.sodium_100g ?? null;
  const fiber = n.fiber_100g ?? null;
  const protein = n.proteins_100g ?? null;
  let pts = 0;
  if (energy !== null) pts++; if (sugars !== null) pts++;
  if (satFat !== null) pts++; if (sodium !== null) pts++;
  if (pts < 2) return null;
  const neg = Math.min(10, Math.floor((energy ?? 500) / 335))
            + Math.min(10, Math.floor((sugars ?? 5) / 4.5))
            + Math.min(10, Math.floor((satFat ?? 2) / 1))
            + Math.min(10, Math.floor(((sodium ?? 0.3) * 1000) / 90));
  const pos = Math.min(5, Math.floor((fiber ?? 0) / 0.9))
            + Math.min(5, Math.floor((protein ?? 0) / 1.6));
  return Math.max(0, Math.min(100, Math.round(100 - (neg - pos + 10) * 2)));
}

function additivesScore(ingredientsText) {
  if (!ingredientsText || ingredientsText.length < 3) return 75;
  const lower = ingredientsText.toLowerCase();
  const found = [];
  for (const h of harmful) {
    if (!h.namesLower.some(n => lower.includes(n))) continue;
    if (h.regex.test(lower)) found.push(h.severity);
  }
  if (found.length === 0) return 100;
  found.sort((a, b) => b - a);
  let penalty = 0;
  found.forEach((sev, i) => { penalty += sev * 4 * (1 / (1 + i * 0.3)); });
  let score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  if (found[0] >= 8) score = Math.min(score, 25);
  else if (found[0] >= 6) score = Math.min(score, 55);
  return score;
}

function scoreProduct(p) {
  let nutrition = nutriscoreToScore(p.nutriscore_grade);
  if (nutrition === null && p.nutrition_facts) {
    const nf = typeof p.nutrition_facts === 'string' ? JSON.parse(p.nutrition_facts) : p.nutrition_facts;
    nutrition = scoreFromNutrients(nf);
  }
  if (nutrition === null) nutrition = 50;
  if (p.nova_group) {
    const adj = { 1: 5, 2: 0, 3: -5, 4: -10 }[p.nova_group] ?? 0;
    nutrition = Math.max(0, Math.min(100, nutrition + adj));
  }
  return {
    upc: p.upc,
    nutrition: Math.round(nutrition),
    additives: Math.round(additivesScore(p.ingredients || '')),
    organic: p.is_organic ? 100 : 0,
  };
}

async function bulkUpdate(scores) {
  if (!scores.length) return;
  await pool.query(`
    UPDATE products AS p SET
      nutrition_score = v.nutrition,
      additives_score = v.additives,
      organic_bonus   = v.organic
    FROM unnest($1::text[], $2::int[], $3::int[], $4::int[])
      AS v(upc, nutrition, additives, organic)
    WHERE p.upc = v.upc
  `, [scores.map(s=>s.upc), scores.map(s=>s.nutrition), scores.map(s=>s.additives), scores.map(s=>s.organic)]);
}

async function main() {
  console.log('\n  ╔══════════════════════════════════════════╗');
  console.log('  ║  ICK — BATCH PRODUCT SCORING v2 (FAST)  ║');
  console.log('  ╚══════════════════════════════════════════╝\n');
  console.log(`  Fetch: ${BATCH_SIZE}/batch | Write: ${WRITE_SIZE}/SQL call`);

  await pool.query('SELECT 1');
  console.log('  ✓ DB connected');
  await loadHarmful();

  const { rows: [{ c: toScore }] } = await pool.query(`SELECT COUNT(*) as c FROM products`);
  const total = parseInt(toScore);
  console.log(`  Products to score: ${total.toLocaleString()}\n`);

  let lastId = 0;
  while (true) {
    const { rows } = await pool.query(`
      SELECT id, upc, ingredients, nutriscore_grade, nova_group, nutrition_facts, is_organic
      FROM products
      WHERE id > $1
      ORDER BY id
      LIMIT $2
    `, [lastId, BATCH_SIZE]);

    if (!rows.length) break;

    const scores = rows.map(scoreProduct);
    for (let i = 0; i < scores.length; i += WRITE_SIZE) {
      await bulkUpdate(scores.slice(i, i + WRITE_SIZE));
    }

    stats.total += rows.length;
    lastId = rows[rows.length - 1].id;

    if (stats.total % REPORT_EVERY === 0 || rows.length < BATCH_SIZE) {
      const elapsed = (Date.now() - stats.start) / 1000;
      const rate = Math.round(stats.total / elapsed);
      const eta = rate > 0 ? Math.round((total - stats.total) / rate) : 0;
      const etaStr = eta > 3600 ? `${Math.round(eta/3600)}h` : eta > 60 ? `${Math.round(eta/60)}m` : `${eta}s`;
      process.stdout.write(`\r  ${stats.total.toLocaleString()} / ${total.toLocaleString()} | ${rate}/sec | ETA ${etaStr}        `);
    }

    if (rows.length < BATCH_SIZE) break;
  }

  const elapsed = ((Date.now() - stats.start) / 1000).toFixed(1);
  console.log(`\n\n  ✓ Done. Scored ${stats.total.toLocaleString()} products in ${elapsed}s\n`);

  const { rows: [d] } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE total_score >= 75) as excellent,
      COUNT(*) FILTER (WHERE total_score >= 51 AND total_score < 75) as good,
      COUNT(*) FILTER (WHERE total_score >= 26 AND total_score < 51) as poor,
      COUNT(*) FILTER (WHERE total_score < 26) as avoid
    FROM products WHERE total_score IS NOT NULL
  `);
  console.log('  Score distribution:');
  console.log(`  🟢 Excellent (75+): ${parseInt(d.excellent).toLocaleString()}`);
  console.log(`  🟡 Good (51-74):    ${parseInt(d.good).toLocaleString()}`);
  console.log(`  🟠 Poor (26-50):    ${parseInt(d.poor).toLocaleString()}`);
  console.log(`  🔴 Avoid (0-25):    ${parseInt(d.avoid).toLocaleString()}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
