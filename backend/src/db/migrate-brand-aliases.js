// Schema migration for the Company Behavior rebuild.
//
// Adds:
//   - pg_trgm extension (for fuzzy brand matching)
//   - brand_aliases table mapping normalized aliases → company_id
//   - GIN trigram index on brand_aliases.alias for fast similarity search
//   - btree index on products.company_id for joins
//
// Idempotent — all statements use IF NOT EXISTS.
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
  query_timeout: 60000,
});

const steps = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,

  `CREATE TABLE IF NOT EXISTS brand_aliases (
     alias        VARCHAR(255) PRIMARY KEY,            -- normalized: lowercase, alphanumeric only
     alias_display VARCHAR(255) NOT NULL,              -- original form for display
     company_id   INT REFERENCES companies(id) ON DELETE CASCADE,
     created_at   TIMESTAMP DEFAULT NOW()
   )`,

  `CREATE INDEX IF NOT EXISTS idx_brand_aliases_company ON brand_aliases(company_id)`,

  // Trigram index for fuzzy matching. Use the operator class so pg_trgm % works.
  `CREATE INDEX IF NOT EXISTS idx_brand_aliases_trgm ON brand_aliases USING gin (alias gin_trgm_ops)`,

  // Help joins from products back to companies via the (currently unused) FK.
  `CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id)`,
];

async function main() {
  console.log('Running brand-aliases schema migration…');
  for (let i = 0; i < steps.length; i++) {
    const sql = steps[i];
    const preview = sql.replace(/\s+/g, ' ').slice(0, 70);
    const t0 = Date.now();
    try {
      await pool.query(sql);
      console.log(`  ✓ [${i + 1}/${steps.length}] ${Date.now() - t0}ms  ${preview}…`);
    } catch (e) {
      console.error(`  ✗ [${i + 1}/${steps.length}] ${e.message}`);
    }
  }

  // Verify
  const exts = await pool.query(`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`);
  console.log('  pg_trgm installed:', exts.rows.length > 0);
  const tbl = await pool.query(`SELECT to_regclass('public.brand_aliases') AS t`);
  console.log('  brand_aliases table:', tbl.rows[0].t || 'MISSING');

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
