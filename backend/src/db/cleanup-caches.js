// Cache table cleanup. Rows past their TTL are filtered out at query time
// but stay on disk until removed. Run this periodically (cron, or once a
// week manually) to keep table bloat down.
//
// Usage:
//   node src/db/cleanup-caches.js           # delete rows older than each TTL
//   node src/db/cleanup-caches.js --dry-run # report counts only

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

const DRY_RUN = process.argv.includes('--dry-run');

// (table, cache_type filter or '*', TTL in seconds)
const RULES = [
  { table: 'recipe_cache',   type: 'spoonacular_search',  ttlSeconds: 24 * 3600 },
  { table: 'recipe_cache',   type: 'spoonacular_pantry',  ttlSeconds:      3600 },
  { table: 'result_cache',   type: 'spoonacular',         ttlSeconds: 24 * 3600 },
  // Condition-score cache rows past 7 days were already TTL-filtered; clean them up too.
  { table: 'product_condition_scores', type: null,        ttlSeconds: 7 * 24 * 3600 },
];

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — counts only, no deletes\n' : 'Cleaning stale cache rows…\n');

  for (const r of RULES) {
    const where = [`created_at < NOW() - (INTERVAL '1 second' * $1)`];
    const params = [r.ttlSeconds];
    if (r.type) { where.push(`cache_type = $2`); params.push(r.type); }
    else if (r.table === 'product_condition_scores') {
      // Use cached_at for that table.
      where[0] = `cached_at < NOW() - (INTERVAL '1 second' * $1)`;
    }
    const whereSql = where.join(' AND ');

    let result;
    try {
      if (DRY_RUN) {
        result = await pool.query(
          `SELECT COUNT(*)::int AS n FROM ${r.table} WHERE ${whereSql}`, params
        );
        const n = result.rows[0].n;
        console.log(`  ${r.table}${r.type ? ` (type=${r.type})` : ''}: would delete ${n} rows older than ${r.ttlSeconds / 3600}h`);
      } else {
        result = await pool.query(`DELETE FROM ${r.table} WHERE ${whereSql}`, params);
        console.log(`  ${r.table}${r.type ? ` (type=${r.type})` : ''}: deleted ${result.rowCount} rows`);
      }
    } catch (err) {
      console.warn(`  ${r.table}: ${err.message}`);
    }
  }

  await pool.end();
}

main().catch(err => { console.error(err); pool.end().then(() => process.exit(1)); });
