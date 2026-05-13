// Tier-3 fuzzy backfill, chunked by product.id ranges to fit under Render's
// statement timeout.
//
// Strategy: for each chunk of 10K unmatched products, use a LATERAL JOIN
// to find the best fuzzy alias match per product (similarity ≥ threshold).
// The trgm index on brand_aliases makes the per-product lookup cheap.
//
// Higher threshold = fewer false positives. Tests on the curated set
// suggest 0.85 strikes a good balance (catches typos, rejects unrelated
// brands like "Trader's Wood" vs "Trader Joe's").

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  statement_timeout: 90000,
});

const SIMILARITY_THRESHOLD = 0.85;
const CHUNK_SIZE = 10000;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`Tier-3 fuzzy chunked backfill  (threshold=${SIMILARITY_THRESHOLD}, chunk=${CHUNK_SIZE}, dry-run=${DRY_RUN})\n`);

  // Find ID range to scan — only products with company_id IS NULL.
  const range = await pool.query(`
    SELECT MIN(id)::int AS min_id, MAX(id)::int AS max_id, COUNT(*)::int AS unmatched
    FROM products WHERE company_id IS NULL
  `);
  const { min_id, max_id, unmatched } = range.rows[0];
  console.log(`  unmatched products: ${unmatched.toLocaleString()}  (id ${min_id}..${max_id})`);
  if (unmatched === 0) { await pool.end(); return; }

  const totalChunks = Math.ceil((max_id - min_id + 1) / CHUNK_SIZE);
  console.log(`  ~${totalChunks} chunks of ${CHUNK_SIZE} ids each\n`);

  let totalMatched = 0;
  let chunkIdx = 0;
  let failedChunks = 0;
  const startTime = Date.now();

  for (let lo = min_id; lo <= max_id; lo += CHUNK_SIZE) {
    const hi = Math.min(lo + CHUNK_SIZE - 1, max_id);
    chunkIdx++;

    const sql = DRY_RUN
      ? // dry-run: just count what we'd match
        `WITH candidates AS (
           SELECT p.id, normalize_brand(p.brand) AS norm
           FROM products p
           WHERE p.id BETWEEN $1 AND $2
             AND p.company_id IS NULL
             AND p.brand IS NOT NULL AND p.brand != ''
         )
         SELECT COUNT(*)::int AS n FROM candidates c
         JOIN LATERAL (
           SELECT ba.company_id, similarity(ba.alias, c.norm) AS sim
           FROM brand_aliases ba
           WHERE ba.alias % c.norm
           ORDER BY sim DESC LIMIT 1
         ) m ON true
         WHERE m.sim >= $3 AND c.norm != ''`
      : // real run: UPDATE
        `WITH candidates AS (
           SELECT p.id, normalize_brand(p.brand) AS norm
           FROM products p
           WHERE p.id BETWEEN $1 AND $2
             AND p.company_id IS NULL
             AND p.brand IS NOT NULL AND p.brand != ''
         ),
         matched AS (
           SELECT c.id, m.company_id, m.sim
           FROM candidates c
           JOIN LATERAL (
             SELECT ba.company_id, similarity(ba.alias, c.norm) AS sim
             FROM brand_aliases ba
             WHERE ba.alias % c.norm
             ORDER BY sim DESC LIMIT 1
           ) m ON true
           WHERE m.sim >= $3 AND c.norm != ''
         )
         UPDATE products p
         SET company_id = m.company_id,
             company_behavior_score = co.behavior_score
         FROM matched m JOIN companies co ON m.company_id = co.id
         WHERE p.id = m.id AND p.company_id IS NULL`;

    const t = Date.now();
    try {
      const r = await pool.query(sql, [lo, hi, SIMILARITY_THRESHOLD]);
      const matched = DRY_RUN ? r.rows[0].n : r.rowCount;
      totalMatched += matched;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(
        `\r  chunk ${chunkIdx}/${totalChunks}  ids ${lo}-${hi}  matched=${matched}  total=${totalMatched}  fails=${failedChunks}  ${elapsed}s `
      );
    } catch (e) {
      failedChunks++;
      console.warn(`\n  chunk ${chunkIdx} (ids ${lo}-${hi}) failed in ${Math.round((Date.now() - t) / 1000)}s: ${e.message}`);
    }
  }
  console.log();

  if (!DRY_RUN) {
    const after = await pool.query(
      "SELECT COUNT(*) FILTER (WHERE company_id IS NOT NULL)::int AS n FROM products"
    );
    console.log(`\nTotal matched products now: ${after.rows[0].n.toLocaleString()}`);
  }
  console.log(`Failed chunks: ${failedChunks}`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
