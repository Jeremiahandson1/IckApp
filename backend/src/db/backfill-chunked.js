// Chunked product backfill — one alias per UPDATE statement.
//
// The bulk JOIN+UPDATE keeps timing out on Render's tier because the single
// transaction touches too many rows. This script loops aliases, doing a
// small targeted UPDATE per alias. Each UPDATE benefits from the
// idx_products_brand_norm functional index, so per-alias is sub-second.
//
// Idempotent — only touches rows where company_id IS NULL.

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  statement_timeout: 60000,  // 60s per single-alias UPDATE
});

async function main() {
  console.log('Loading aliases…');
  const aliases = await pool.query(`
    SELECT ba.alias, ba.company_id, c.behavior_score
    FROM brand_aliases ba JOIN companies c ON ba.company_id = c.id
    ORDER BY ba.alias
  `);
  console.log(`  ${aliases.rows.length} aliases to process\n`);

  let totalUpdated = 0;
  let aliasesWithHits = 0;
  let aliasesNoHits = 0;
  let aliasesFailed = 0;
  const startTime = Date.now();

  for (let i = 0; i < aliases.rows.length; i++) {
    const { alias, company_id, behavior_score } = aliases.rows[i];
    try {
      const r = await pool.query(
        `UPDATE products
         SET company_id = $1, company_behavior_score = $2
         WHERE company_id IS NULL
           AND brand IS NOT NULL AND brand != ''
           AND regexp_replace(lower(brand), '[^a-z0-9]', '', 'g') = $3`,
        [company_id, behavior_score, alias]
      );
      if (r.rowCount > 0) {
        totalUpdated += r.rowCount;
        aliasesWithHits++;
      } else {
        aliasesNoHits++;
      }
    } catch (err) {
      aliasesFailed++;
      console.warn(`\n  alias='${alias}' failed: ${err.message}`);
    }

    if ((i + 1) % 25 === 0 || i + 1 === aliases.rows.length) {
      const elapsedMin = Math.round((Date.now() - startTime) / 1000 / 60 * 10) / 10;
      process.stdout.write(
        `\r  ${i + 1}/${aliases.rows.length}  updated=${totalUpdated}  with-hits=${aliasesWithHits}  no-hits=${aliasesNoHits}  fails=${aliasesFailed}  ${elapsedMin}min`
      );
    }
  }
  console.log();

  const final = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE company_id IS NOT NULL)::int AS matched,
           COUNT(*) FILTER (WHERE company_id IS NULL AND brand IS NOT NULL AND brand != '')::int AS still_unmatched_with_brand,
           COUNT(*)::int AS total
    FROM products
  `);
  const f = final.rows[0];
  console.log(`\nFinal coverage:`);
  console.log(`  matched:    ${f.matched} / ${f.total} (${((f.matched / f.total) * 100).toFixed(1)}% of catalog)`);
  console.log(`  unmatched but has brand: ${f.still_unmatched_with_brand}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
