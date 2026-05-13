// Retry the aliases that timed out during the chunked backfill, with a
// longer per-statement timeout. Also handles the curly-apostrophe variants
// that share normalized form with straight-apostrophe brands.
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  statement_timeout: 180000,  // 3 min per statement
});

// Aliases that timed out in the previous run (per the log)
const STRAGGLERS = ['wegmans', 'traderjoes', 'simplybalanced', 'sprouts'];

async function main() {
  console.log('Retrying timeout-failed aliases with 3-minute timeout each…\n');
  for (const alias of STRAGGLERS) {
    const aliasInfo = await pool.query(
      `SELECT ba.alias, ba.company_id, c.name, c.behavior_score
       FROM brand_aliases ba JOIN companies c ON ba.company_id = c.id
       WHERE ba.alias = $1`, [alias]
    );
    if (aliasInfo.rows.length === 0) {
      console.log(`  ${alias}: alias not seeded — skipping`);
      continue;
    }
    const info = aliasInfo.rows[0];

    const wouldMatch = await pool.query(
      `SELECT COUNT(*)::int AS n FROM products
       WHERE company_id IS NULL AND brand IS NOT NULL
         AND regexp_replace(lower(brand), '[^a-z0-9]', '', 'g') = $1`,
      [alias]
    );
    console.log(`  ${alias} (${info.name}): ${wouldMatch.rows[0].n} products would match`);

    const t0 = Date.now();
    try {
      const r = await pool.query(
        `UPDATE products
         SET company_id = $1, company_behavior_score = $2
         WHERE company_id IS NULL AND brand IS NOT NULL
           AND regexp_replace(lower(brand), '[^a-z0-9]', '', 'g') = $3`,
        [info.company_id, info.behavior_score, alias]
      );
      console.log(`  ✓ updated ${r.rowCount} in ${Math.round((Date.now() - t0) / 1000)}s\n`);
    } catch (e) {
      console.log(`  ✗ ${e.message}\n`);
    }
  }
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
