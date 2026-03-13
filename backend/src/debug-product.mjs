import pool from './db/init.js';
import { scoreProduct } from './utils/scoring.js';

// Find ALL ginger chew products
const r = await pool.query("SELECT id,upc,name,brand,nova_group,ingredients,processing_score,company_behavior_score,total_score,swap_discovery_type FROM products WHERE LOWER(name) LIKE '%ginger%chew%' OR LOWER(name) LIKE '%prince%peace%'");
console.log('=== GINGER CHEW PRODUCTS IN DB ===');
for (const p of r.rows) {
  console.log(`UPC: ${p.upc} | Name: ${p.name} | Brand: ${p.brand}`);
  console.log(`  nova_group: ${p.nova_group} (type: ${typeof p.nova_group})`);
  console.log(`  ingredients: ${(p.ingredients||'').substring(0,80)}`);
  console.log(`  processing_score: ${p.processing_score} | company: ${p.company_behavior_score} | total: ${p.total_score}`);
  console.log(`  swap_discovery_type: ${p.swap_discovery_type}`);

  // Re-score it right now
  const fresh = await scoreProduct({
    nova_group: p.nova_group,
    ingredients: p.ingredients || '',
    brand: p.brand || '',
    nutriscore_grade: null,
    nutriments: null,
    labels: [],
    allergens_tags: [],
    image_url: null,
  });
  console.log(`  FRESH SCORE: processing=${fresh.processing_score} company=${fresh.company_behavior_score}`);

  // Force update DB
  await pool.query(
    'UPDATE products SET processing_score=$1, company_behavior_score=$2 WHERE id=$3',
    [fresh.processing_score, fresh.company_behavior_score, p.id]
  );

  // Read back total
  const updated = await pool.query('SELECT total_score,processing_score,company_behavior_score FROM products WHERE id=$1', [p.id]);
  console.log(`  AFTER UPDATE: processing=${updated.rows[0].processing_score} total=${updated.rows[0].total_score}`);
  console.log('---');
}

// Check companies count
const cc = await pool.query('SELECT COUNT(*) FROM companies');
console.log('Total companies:', cc.rows[0].count);

// Check Prince of Peace
const pp = await pool.query("SELECT name,behavior_score FROM companies WHERE LOWER(name) LIKE '%prince%'");
console.log('Prince of Peace company:', pp.rows);

// Clear swap cache for these products
await pool.query("DELETE FROM result_cache WHERE cache_type='swaps'");
console.log('Cleared swap cache');

process.exit(0);
