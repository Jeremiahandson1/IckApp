#!/usr/bin/env node
// BATCH SCORING v3 — 5-Dimension Model. Uses bulk unnest() updates.
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
let companies = [];

async function loadHarmful() {
  const { rows } = await pool.query('SELECT name, aliases, severity, banned_in FROM harmful_ingredients');
  harmful = rows.map(h => {
    const aliases = h.aliases ? (typeof h.aliases === 'string' ? JSON.parse(h.aliases) : h.aliases) : [];
    const names = [h.name, ...aliases].filter(Boolean);
    const namesLower = names.map(n => n.toLowerCase());
    const pattern = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`\\b(${pattern})\\b`, 'i');
    const bannedIn = h.banned_in ? (typeof h.banned_in === 'string' ? JSON.parse(h.banned_in) : h.banned_in) : [];
    return { name: h.name, severity: h.severity, namesLower, regex, bannedIn };
  });
  console.log(`  ✓ Loaded ${harmful.length} harmful ingredients`);
}

async function loadCompanies() {
  const { rows } = await pool.query('SELECT name, parent_company, behavior_score, controversies FROM companies');
  companies = rows;
  console.log(`  ✓ Loaded ${companies.length} companies`);
}

function clamp(val) { return Math.max(0, Math.min(100, Math.round(val))); }

// ── Dimension 1: Harmful Ingredients (40%) ──
function harmfulScore(ingredientsText) {
  if (!ingredientsText || ingredientsText.length < 3) return { score: 75, found: [] };
  const lower = ingredientsText.toLowerCase();
  const found = [];
  for (const h of harmful) {
    if (!h.namesLower.some(n => lower.includes(n))) continue;
    if (h.regex.test(lower)) found.push({ severity: h.severity, bannedIn: h.bannedIn });
  }
  if (found.length === 0) return { score: 100, found: [] };
  found.sort((a, b) => b.severity - a.severity);
  let penalty = 0;
  found.forEach((f, i) => { penalty += f.severity * 4 * (1 / (1 + i * 0.3)); });
  let score = clamp(100 - penalty);
  if (found[0].severity >= 8) score = Math.min(score, 25);
  else if (found[0].severity >= 6) score = Math.min(score, 55);
  return { score, found };
}

// ── Dimension 2: Banned Elsewhere (20%) ──
function bannedScore(foundHarmful) {
  if (!foundHarmful || foundHarmful.length === 0) return 100;
  const banned = foundHarmful.filter(h => h.bannedIn && h.bannedIn.length > 0);
  if (banned.length === 0) return 100;
  let penalty = 0;
  for (const h of banned) {
    const banCount = h.bannedIn.length;
    const ingredientPenalty = banCount >= 3 ? 25 : banCount >= 2 ? 18 : 10;
    penalty += ingredientPenalty * (h.severity / 10);
  }
  return clamp(100 - penalty);
}

// ── Dimension 3: Transparency (15%) ──
function transparencyScore(p) {
  let score = 0;
  if (p.ingredients && p.ingredients.length > 10) score += 35;
  else if (p.ingredients && p.ingredients.length > 0) score += 15;

  if (p.nutrition_facts) {
    let nf;
    try { nf = typeof p.nutrition_facts === 'string' ? JSON.parse(p.nutrition_facts) : p.nutrition_facts; }
    catch { nf = null; }
    if (nf) {
      const count = Object.keys(nf).filter(k => nf[k] != null).length;
      if (count >= 5) score += 30;
      else if (count >= 3) score += 20;
      else if (count >= 1) score += 10;
    }
  }

  if (p.image_url) score += 10;
  if (p.brand && p.brand !== 'Unknown Brand' && p.brand !== 'Unknown') score += 5;
  if (p.nutriscore_grade) score += 10;
  // allergen data: +10 — check from DB
  // (batch doesn't have easy access, approximate)
  score += 10; // assume allergen data exists for most OFF products
  return clamp(score);
}

// ── Dimension 4: Processing (15%) ──
function processingScore(p) {
  if (p.nova_group) {
    const novaScores = { 1: 95, 2: 75, 3: 45, 4: 15 };
    let score = novaScores[p.nova_group] ?? 50;
    if (p.nova_group === 4 && p.ingredients) {
      const il = p.ingredients.toLowerCase();
      const markers = [
        'high fructose corn syrup', 'hydrogenated', 'partially hydrogenated',
        'modified starch', 'maltodextrin', 'dextrose', 'artificial flavor',
        'artificial colour', 'artificial color', 'sodium benzoate',
        'potassium sorbate', 'polysorbate', 'carrageenan',
        'sodium nitrite', 'sodium nitrate', 'tbhq', 'bht', 'bha',
      ];
      const count = markers.filter(m => il.includes(m)).length;
      if (count >= 4) score = 5;
      else if (count >= 2) score = 10;
    }
    return clamp(score);
  }
  if (!p.ingredients || p.ingredients.length < 3) return 50;
  const il = p.ingredients.toLowerCase();
  const markers = [
    'high fructose corn syrup', 'hydrogenated', 'partially hydrogenated',
    'modified starch', 'maltodextrin', 'dextrose', 'artificial flavor',
    'artificial colour', 'artificial color', 'sodium benzoate',
    'potassium sorbate', 'polysorbate', 'carrageenan',
    'sodium nitrite', 'sodium nitrate', 'tbhq', 'bht', 'bha',
    'mono and diglycerides', 'soy lecithin', 'xanthan gum',
    'cellulose', 'propylene glycol',
  ];
  const count = markers.filter(m => il.includes(m)).length;
  if (count >= 5) return 10;
  if (count >= 3) return 25;
  if (count >= 2) return 40;
  if (count >= 1) return 55;
  const commas = (p.ingredients.match(/,/g) || []).length;
  if (commas > 20) return 35;
  if (commas > 12) return 55;
  if (commas > 5) return 70;
  return 85;
}

// ── Dimension 5: Company Behavior (10%) ──
function companyScore(brand) {
  if (!brand) return 50;
  const bl = brand.toLowerCase().split(',')[0].trim();
  const match = companies.find(c => {
    const cl = c.name.toLowerCase();
    return cl === bl || bl.includes(cl) || cl.includes(bl);
  }) || companies.find(c => {
    if (!c.parent_company) return false;
    const pl = c.parent_company.toLowerCase();
    return bl.includes(pl) || pl.includes(bl);
  });
  if (!match) return 50;
  if (match.behavior_score != null) return clamp(match.behavior_score);
  if (match.controversies) {
    const c = typeof match.controversies === 'string' ? match.controversies : JSON.stringify(match.controversies);
    if (c.length > 200) return 25;
    if (c.length > 50) return 40;
  }
  return 50;
}

function scoreProduct(p) {
  const { score: hiScore, found } = harmfulScore(p.ingredients || '');
  return {
    upc: p.upc,
    harmful: hiScore,
    banned: bannedScore(found),
    transparency: transparencyScore(p),
    processing: processingScore(p),
    company: companyScore(p.brand),
  };
}

async function bulkUpdate(scores) {
  if (!scores.length) return;
  await pool.query(`
    UPDATE products AS p SET
      harmful_ingredients_score = v.harmful,
      banned_elsewhere_score   = v.banned,
      transparency_score       = v.transparency,
      processing_score         = v.processing,
      company_behavior_score   = v.company
    FROM unnest($1::text[], $2::int[], $3::int[], $4::int[], $5::int[], $6::int[])
      AS v(upc, harmful, banned, transparency, processing, company)
    WHERE p.upc = v.upc
  `, [
    scores.map(s=>s.upc), scores.map(s=>s.harmful), scores.map(s=>s.banned),
    scores.map(s=>s.transparency), scores.map(s=>s.processing), scores.map(s=>s.company),
  ]);
}

async function main() {
  console.log('\n  ╔══════════════════════════════════════════╗');
  console.log('  ║  ICK — BATCH SCORING v3 (5-DIMENSION)   ║');
  console.log('  ╚══════════════════════════════════════════╝\n');
  console.log(`  Fetch: ${BATCH_SIZE}/batch | Write: ${WRITE_SIZE}/SQL call`);

  await pool.query('SELECT 1');
  console.log('  ✓ DB connected');
  await loadHarmful();
  await loadCompanies();

  const { rows: [{ count: totalStr }] } = await pool.query('SELECT COUNT(*) FROM products');
  const total = parseInt(totalStr);
  console.log(`  Products to score: ${total.toLocaleString()}\n`);

  // Resume from checkpoint if available
  const CHECKPOINT_FILE = '/tmp/batch-score-checkpoint.txt';
  let lastId = 0;
  try {
    const { readFileSync } = await import('fs');
    const saved = readFileSync(CHECKPOINT_FILE, 'utf8').trim();
    if (saved) {
      lastId = parseInt(saved);
      console.log(`  ↩ Resuming from id ${lastId.toLocaleString()}\n`);
    }
  } catch {}

  while (true) {
    const { rows } = await pool.query(`
      SELECT id, upc, ingredients, brand, nutriscore_grade, nova_group, nutrition_facts,
             is_organic, image_url
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

    if (stats.total % 10000 === 0) {
      try {
        const { writeFileSync } = await import('fs');
        writeFileSync(CHECKPOINT_FILE, String(lastId));
      } catch {}
    }

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
