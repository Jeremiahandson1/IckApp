// Seed companies + brand_aliases from the brand-portfolios dataset.
//
// For each parent in PORTFOLIOS:
//   1. Upsert the company by name (ON CONFLICT (name) DO NOTHING — preserve
//      any existing behavior_score / controversies set by the original seed).
//   2. Insert every brand + alias into brand_aliases mapping to that company.
//      Normalized aliases (lowercase + alphanumeric only) ensure consistent
//      lookups regardless of casing or punctuation in the source data.
//
// Idempotent — safe to re-run.

import pg from 'pg';
import 'dotenv/config';
import { PORTFOLIOS } from '../data/brand-portfolios.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  query_timeout: 30000,
});

// Mirror the matcher's suffix-stripping so seeded aliases collapse the
// same way as runtime brand strings.
const SEED_SUFFIX_RE = /\b(inc|llc|ltd|corp|corporation|co|company|usa|us|na|north[\s-]america|n[\s-]a|brands|foods|group|holdings|gmbh|s[\s-]a|sa|ag|plc|llp|limited)\b/gi;

function normalizeAlias(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents
    .replace(SEED_SUFFIX_RE, ' ')
    .replace(/[^a-z0-9]/g, '');
}

async function upsertCompany(p) {
  // Insert if missing; if exists, leave its behavior_score / controversies alone.
  const result = await pool.query(
    `INSERT INTO companies (name, behavior_score, controversies)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO NOTHING
     RETURNING id`,
    [p.parent, p.behavior_score, (p.controversies || []).join('; ')]
  );
  if (result.rows.length > 0) return result.rows[0].id;

  // Already existed — fetch its id
  const existing = await pool.query(`SELECT id FROM companies WHERE name = $1`, [p.parent]);
  return existing.rows[0].id;
}

async function insertAlias(alias, displayAlias, companyId) {
  const norm = normalizeAlias(alias);
  if (!norm) return false;
  const result = await pool.query(
    `INSERT INTO brand_aliases (alias, alias_display, company_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (alias) DO NOTHING
     RETURNING alias`,
    [norm, displayAlias, companyId]
  );
  return result.rows.length > 0;
}

async function main() {
  console.log(`Seeding ${PORTFOLIOS.length} brand portfolios…\n`);

  let companiesAdded = 0;
  let aliasesAdded = 0;
  let aliasesSkipped = 0;

  for (const p of PORTFOLIOS) {
    const companyId = await upsertCompany(p);

    // Aliases for the parent name itself
    if (await insertAlias(p.parent, p.parent, companyId)) aliasesAdded++;
    else aliasesSkipped++;
    for (const a of (p.parent_aliases || [])) {
      if (await insertAlias(a, a, companyId)) aliasesAdded++;
      else aliasesSkipped++;
    }

    // Brands and their aliases
    for (const brand of p.brands) {
      if (await insertAlias(brand.name, brand.name, companyId)) aliasesAdded++;
      else aliasesSkipped++;
      for (const a of (brand.aliases || [])) {
        if (await insertAlias(a, brand.name, companyId)) aliasesAdded++;
        else aliasesSkipped++;
      }
    }

    process.stdout.write(`\r  ${p.parent.padEnd(36)}  → company id=${companyId}`);
    process.stdout.write('\n');
  }

  console.log(`\nSeeding complete:`);
  console.log(`  aliases added:    ${aliasesAdded}`);
  console.log(`  aliases skipped:  ${aliasesSkipped} (already existed)`);

  const counts = await pool.query(`
    SELECT COUNT(*)::int AS total_aliases,
           COUNT(DISTINCT company_id)::int AS distinct_companies
    FROM brand_aliases`);
  console.log(`\nFinal: ${counts.rows[0].total_aliases} aliases across ${counts.rows[0].distinct_companies} companies`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
