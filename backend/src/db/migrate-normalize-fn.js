// Add a normalize_brand() SQL function that mirrors the JS matcher's
// normalization (lowercase, strip diacritics+suffixes, alphanumeric only),
// then rebuild the functional index on products to use it.
//
// After this, brand strings like "Danone US LLC" → "danone" both server-side
// (UPDATE / SELECT queries) and client-side (scoring.js / companyMatcher.js).

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  statement_timeout: 300000,
});

const steps = [
  // Define the function. IMMUTABLE so the planner can use it in a functional index.
  // PostgreSQL ARE regex uses \m (start-of-word) and \M (end-of-word).
  `CREATE OR REPLACE FUNCTION normalize_brand(s text) RETURNS text AS $$
     SELECT regexp_replace(
       regexp_replace(
         lower(coalesce(s, '')),
         '\\m(inc|llc|ltd|corp|corporation|co|company|usa|us|na|north[ -]america|n[ -]a|brands|foods|group|holdings|gmbh|sa|ag|plc|llp|limited)\\M',
         ' ', 'g'
       ),
       '[^a-z0-9]', '', 'g'
     )
   $$ LANGUAGE SQL IMMUTABLE`,

  // Drop the old index that uses the no-suffix-stripping expression.
  `DROP INDEX IF EXISTS idx_products_brand_norm`,

  // Build a new functional index that uses the normalize_brand() function.
  `CREATE INDEX IF NOT EXISTS idx_products_brand_norm ON products (normalize_brand(brand))`,
];

async function main() {
  console.log('Adding normalize_brand() function + rebuilding index…\n');
  for (let i = 0; i < steps.length; i++) {
    const sql = steps[i];
    const preview = sql.replace(/\s+/g, ' ').slice(0, 80);
    const t0 = Date.now();
    try {
      await pool.query(sql);
      console.log(`  ✓ [${i + 1}/${steps.length}] ${Date.now() - t0}ms  ${preview}…`);
    } catch (e) {
      console.error(`  ✗ [${i + 1}/${steps.length}] ${e.message}`);
    }
  }

  // Smoke-test the function
  const test = await pool.query(`
    SELECT
      normalize_brand('Danone US LLC')     AS danone_llc,
      normalize_brand('PepsiCo, Inc.')      AS pepsi_inc,
      normalize_brand('Nestlé USA')         AS nestle_usa,
      normalize_brand('Kraft Foods Group')  AS kraft_grp,
      normalize_brand('General Mills, Inc.') AS gm_inc
  `);
  console.log('\nFunction smoke-test:');
  console.log(' ', test.rows[0]);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
