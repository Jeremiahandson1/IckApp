// Repair the companies table: it's missing a PRIMARY KEY because 9 pairs of
// rows share IDs (sequence got reset at some point in prod history). This is
// what's blocking the brand_aliases FK migration.
//
// Strategy:
//   1. For each duplicate id, keep the row with the lowest ctid and reassign
//      the other(s) a fresh sequence value.
//   2. Bump the sequence past max(id).
//   3. Add the PRIMARY KEY constraint.

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  query_timeout: 30000,
});

async function main() {
  console.log('Repairing companies table primary key…\n');

  // 1. Show the dupes for the record
  const before = await pool.query(`
    SELECT id, COUNT(*) AS n, ARRAY_AGG(name ORDER BY created_at, name) AS names
    FROM companies GROUP BY id HAVING COUNT(*) > 1 ORDER BY id
  `);
  console.log(`Duplicate ids: ${before.rows.length}`);
  for (const r of before.rows) console.log(`  id=${r.id}: ${r.names.join(' / ')}`);

  // 2. For each duplicate, reassign the SECOND occurrence (and beyond) to a new id.
  //    Use ctid as a stable per-row identifier.
  const reassign = await pool.query(`
    WITH dupes AS (
      SELECT ctid,
             ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at NULLS LAST, name) AS rn
      FROM companies
    )
    UPDATE companies c
    SET id = nextval('companies_id_seq')
    FROM dupes d
    WHERE c.ctid = d.ctid AND d.rn > 1
    RETURNING c.id, c.name
  `);
  console.log(`\nReassigned ${reassign.rowCount} rows to new ids:`);
  for (const r of reassign.rows) console.log(`  → id=${r.id}: ${r.name}`);

  // 3. Bump sequence past max(id) to avoid future collisions
  const bump = await pool.query(
    `SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies) + 1, false) AS next_val`
  );
  console.log(`\nSequence bumped to: ${bump.rows[0].next_val}`);

  // 4. Verify uniqueness, then add the PK
  const stillDupes = await pool.query(
    `SELECT id, COUNT(*) FROM companies GROUP BY id HAVING COUNT(*) > 1`
  );
  if (stillDupes.rows.length > 0) {
    console.error('Still have duplicate ids — aborting before adding PK');
    process.exit(1);
  }

  try {
    await pool.query(`ALTER TABLE companies ADD PRIMARY KEY (id)`);
    console.log('✓ PRIMARY KEY (id) added to companies');
  } catch (e) {
    console.error(`✗ Failed to add PK: ${e.message}`);
  }

  // 5. Verify
  const final = await pool.query(`
    SELECT contype, conname FROM pg_constraint WHERE conrelid = 'companies'::regclass ORDER BY contype
  `);
  console.log('\nFinal companies constraints:');
  for (const r of final.rows) console.log(`  ${r.contype}: ${r.conname}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
