// Dedup companies table.
//
// History: the original seed.js created ONE company row per known brand
// (Coca-Cola, Mondelez, Mars Inc., Mars Inc, Heinz, etc.) regardless of
// whether they share a parent. After the brand-portfolios rebuild we
// model parents correctly (e.g. "The Coca-Cola Company" owns "Coca-Cola"
// as a brand, not as a separate company). The old per-brand rows are
// orphaned and confusing.
//
// Strategy:
//   For each company row that has zero linked products AND zero
//   brand_aliases pointing to it, check whether its name normalizes to
//   an existing alias that points to a different company. If yes, the
//   row is a redundant duplicate — delete it. If no, leave it alone
//   (legitimate small/independent brand we just haven't classified).
//
// Idempotent and safe — only touches rows with 0 products + 0 aliases.

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no deletes\n' : 'Deduping companies table…\n');

  // Find all orphan companies
  const orphans = await pool.query(`
    SELECT c.id, c.name
    FROM companies c
    LEFT JOIN products p ON p.company_id = c.id
    LEFT JOIN brand_aliases ba ON ba.company_id = c.id
    GROUP BY c.id, c.name
    HAVING COUNT(p.id) = 0 AND COUNT(ba.alias) = 0
  `);
  console.log(`Found ${orphans.rows.length} orphan companies (0 products + 0 aliases)\n`);

  let mergedCount = 0;
  let keptCount = 0;
  const merges = []; // {orphan, parent}

  for (const orphan of orphans.rows) {
    // Does the orphan's name match an existing alias pointing to a different company?
    const match = await pool.query(
      `SELECT c.id, c.name FROM brand_aliases ba
       JOIN companies c ON ba.company_id = c.id
       WHERE ba.alias = normalize_brand($1)
         AND c.id != $2
       LIMIT 1`,
      [orphan.name, orphan.id]
    );

    if (match.rows.length > 0) {
      // Redundant — same brand already covered by a different company via alias
      merges.push({ orphan, parent: match.rows[0] });
      mergedCount++;
    } else {
      keptCount++;
    }
  }

  console.log(`Will merge (delete orphan, brand covered elsewhere):  ${mergedCount}`);
  console.log(`Will keep (legitimate independent / unclassified):     ${keptCount}\n`);

  if (mergedCount > 0) {
    console.log('Sample merges:');
    for (const { orphan, parent } of merges.slice(0, 15)) {
      console.log(`  ${orphan.name.padEnd(28)} → already covered by ${parent.name}`);
    }
    if (merges.length > 15) console.log(`  …and ${merges.length - 15} more`);
  }

  if (DRY_RUN) {
    console.log('\n(dry-run — no deletes performed)');
    await pool.end();
    return;
  }

  // Execute deletes
  console.log('\nDeleting orphan rows…');
  let deleted = 0;
  for (const { orphan } of merges) {
    try {
      const r = await pool.query(`DELETE FROM companies WHERE id = $1`, [orphan.id]);
      deleted += r.rowCount;
    } catch (e) {
      console.warn(`  failed to delete ${orphan.name}: ${e.message}`);
    }
  }
  console.log(`✓ deleted ${deleted} orphan companies`);

  const finalCount = await pool.query('SELECT COUNT(*)::int AS n FROM companies');
  console.log(`Final companies count: ${finalCount.rows[0].n}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
