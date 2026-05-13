// Fix normalize_brand to use unaccent properly.
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  statement_timeout: 600000,
});

// Use a fully-qualified extension call, in case unaccent landed in a non-default schema.
// Use $body$ to avoid escape hell on the regex backreferences.
const FN_SQL = `
CREATE OR REPLACE FUNCTION normalize_brand(s text) RETURNS text AS $body$
  SELECT regexp_replace(
    regexp_replace(
      public.unaccent(lower(coalesce(s, ''))),
      '\\m(inc|llc|ltd|corp|corporation|co|company|usa|us|na|north[ -]america|n[ -]a|brands|foods|group|holdings|gmbh|sa|ag|plc|llp|limited)\\M',
      ' ', 'g'
    ),
    '[^a-z0-9]', '', 'g'
  )
$body$ LANGUAGE SQL IMMUTABLE;
`;

async function main() {
  // Make sure unaccent is installed AND visible
  await pool.query('CREATE EXTENSION IF NOT EXISTS unaccent');

  // Check it works directly
  const u = await pool.query(`SELECT public.unaccent('Nestlé') AS r`);
  console.log('unaccent test:', u.rows[0]);

  // Rebuild the function
  await pool.query(FN_SQL);
  console.log('normalize_brand rebuilt');

  // Rebuild the index
  await pool.query('DROP INDEX IF EXISTS idx_products_brand_norm');
  console.log('old index dropped, building new one (this takes ~2min)…');
  const t = Date.now();
  await pool.query('CREATE INDEX idx_products_brand_norm ON products (normalize_brand(brand))');
  console.log(`  index built in ${Math.round((Date.now() - t) / 1000)}s`);

  // Smoke test
  const test = await pool.query(`
    SELECT normalize_brand('Nestlé USA')         AS nestle,
           normalize_brand('Danone US LLC')      AS danone,
           normalize_brand('Coca-Cola Company')  AS coke,
           normalize_brand('PepsiCo, Inc.')      AS pepsi,
           normalize_brand('Nestle')             AS nestle_no_accent,
           normalize_brand('Häagen-Dazs')        AS haagen
  `);
  console.log('Smoke test:', test.rows[0]);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
