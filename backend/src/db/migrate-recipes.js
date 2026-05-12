// Standalone migration: only the new columns + recipe_cache table.
// Avoids running the full init.js (which is timing out against prod DB).
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
});

const steps = [
  `ALTER TABLE product_condition_scores ADD COLUMN IF NOT EXISTS rules_version VARCHAR(20)`,
  `CREATE TABLE IF NOT EXISTS recipe_cache (
     cache_key VARCHAR(128) PRIMARY KEY,
     cache_type VARCHAR(32) NOT NULL,
     data JSONB NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_recipe_cache_type ON recipe_cache(cache_type, created_at)`,
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'curated'`,
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url TEXT`,
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_attribution TEXT`,
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition_facts JSONB`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_source ON recipes(source)`,
  `UPDATE conditions SET sub_types = '["general","ckd-3-4","dialysis","stones"]'
     WHERE slug = 'kidney' AND (sub_types IS NULL OR sub_types::text = 'null')`,
];

async function run() {
  console.log('Running targeted recipe + condition migrations against prod…');
  for (let i = 0; i < steps.length; i++) {
    const sql = steps[i];
    const preview = sql.replace(/\s+/g, ' ').slice(0, 80);
    try {
      const start = Date.now();
      const result = await pool.query(sql);
      const took = Date.now() - start;
      console.log(`  ✓ [${i + 1}/${steps.length}] ${took}ms  ${preview}…`);
      if (result.rowCount != null && /^UPDATE|^INSERT|^DELETE/i.test(sql)) {
        console.log(`     rows affected: ${result.rowCount}`);
      }
    } catch (e) {
      console.error(`  ✗ [${i + 1}/${steps.length}] ${e.message}`);
      console.error(`     SQL: ${preview}…`);
    }
  }

  // Verify columns
  console.log('\nVerifying schema:');
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'recipes'
      AND column_name IN ('source', 'source_url', 'source_attribution', 'nutrition_facts')
    ORDER BY column_name`);
  console.log('  recipes columns:', cols.rows.map(r => r.column_name).join(', ') || '(none)');

  const cache = await pool.query(`SELECT to_regclass('public.recipe_cache') as t`);
  console.log('  recipe_cache table:', cache.rows[0].t || 'MISSING');

  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err);
  pool.end().then(() => process.exit(1));
});
