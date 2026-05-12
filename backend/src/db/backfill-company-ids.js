// Backfill products.company_id and products.company_behavior_score using the
// new brand_aliases-driven matcher.
//
// Strategy:
//   1. Pull DISTINCT brand strings from products that have NULL company_id.
//   2. Match each distinct brand once via matchCompanyByBrand().
//   3. Bulk UPDATE products by brand → company_id + behavior_score.
//
// This is 50–500× faster than per-product matching since most catalogs have
// many fewer distinct brands than products.

import pg from 'pg';
import 'dotenv/config';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { matchCompanyByBrand } = await import('../utils/companyMatcher.js');

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  query_timeout: 60000,
});

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — matching only, no UPDATEs\n' : 'Backfilling products with company_id…\n');

  // Pull distinct brands, sorted by frequency so we report the impact quickly.
  console.log('Loading distinct brands…');
  const t0 = Date.now();
  const brandResult = await pool.query(`
    SELECT brand, COUNT(*)::int AS product_count
    FROM products
    WHERE company_id IS NULL AND brand IS NOT NULL AND brand != ''
    GROUP BY brand
    ORDER BY product_count DESC
  `);
  const brands = brandResult.rows;
  console.log(`  ${brands.length} distinct brands across ${brands.reduce((s, r) => s + r.product_count, 0)} products  (${Date.now() - t0}ms)\n`);

  let matched = 0;
  let unmatched = 0;
  let productsMatched = 0;

  // Walk brands; match each ONCE; collect updates.
  const updates = new Map(); // brand → company_id

  for (let i = 0; i < brands.length; i++) {
    const { brand, product_count } = brands[i];
    let match;
    try {
      match = await matchCompanyByBrand(brand);
    } catch (err) {
      console.warn(`\n  match error for '${brand}': ${err.message}`);
      unmatched++;
      continue;
    }
    if (match && match.company_id) {
      updates.set(brand, { company_id: match.company_id, behavior_score: match.behavior_score });
      matched++;
      productsMatched += product_count;
    } else {
      unmatched++;
    }

    if ((i + 1) % 250 === 0 || i + 1 === brands.length) {
      process.stdout.write(
        `\r  matched ${matched}/${i + 1} brands  (${productsMatched} products covered)`
      );
    }
  }
  console.log();

  console.log(`\nMatch results:`);
  console.log(`  brands matched:   ${matched} / ${brands.length}  (${((matched / brands.length) * 100).toFixed(1)}%)`);
  console.log(`  products covered: ${productsMatched} / ${brands.reduce((s, r) => s + r.product_count, 0)}`);

  if (DRY_RUN) {
    console.log('\n(dry-run — no DB writes)');
    await pool.end();
    return;
  }

  // Bulk UPDATE: batch by company_id since lots of brands map to the same company.
  console.log(`\nWriting ${updates.size} brand→company links to products…`);
  let updatedProducts = 0;
  let batchCount = 0;
  const byCompany = new Map(); // company_id → [{ brand, behavior_score }]
  for (const [brand, info] of updates) {
    if (!byCompany.has(info.company_id)) byCompany.set(info.company_id, []);
    byCompany.get(info.company_id).push({ brand, behavior_score: info.behavior_score });
  }

  for (const [companyId, items] of byCompany) {
    const brands = items.map(i => i.brand);
    const score = items[0].behavior_score; // same company, same score
    try {
      const r = await pool.query(
        `UPDATE products
         SET company_id = $1,
             company_behavior_score = COALESCE($2, company_behavior_score)
         WHERE brand = ANY($3::text[]) AND company_id IS NULL`,
        [companyId, score, brands]
      );
      updatedProducts += r.rowCount;
      batchCount++;
      if (batchCount % 5 === 0) {
        process.stdout.write(`\r  ${batchCount}/${byCompany.size} company batches done (${updatedProducts} products updated)`);
      }
    } catch (err) {
      console.warn(`\n  UPDATE failed for company ${companyId}: ${err.message}`);
    }
  }
  console.log();

  // Final stats
  const final = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE company_id IS NOT NULL)::int AS with_company,
      COUNT(*) FILTER (WHERE company_id IS NULL)::int AS without_company,
      COUNT(DISTINCT company_behavior_score)::int AS distinct_scores
    FROM products
  `);
  console.log(`\nFinal product coverage:`);
  console.log(`  with company_id:    ${final.rows[0].with_company}`);
  console.log(`  without company_id: ${final.rows[0].without_company}`);
  console.log(`  distinct behavior scores: ${final.rows[0].distinct_scores}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
