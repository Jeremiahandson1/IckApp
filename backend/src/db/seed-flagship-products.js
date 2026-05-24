// Seed the specific products called out by name on the marketing site so
// scanning/searching them always returns a real product — closes the
// "marketing says Doritos has Red 40, but scanning Doritos says Product Not
// Found" credibility gap from the site audit.
//
// For each flagship: search Open Food Facts by name + brand, pick the top
// US-region result that has real ingredient data, score it with the live
// 5-dimension scorer, and upsert into the products table by UPC.
//
// Safe to re-run. Each upsert refreshes both the row and its score.
//
// Usage:
//   node src/db/seed-flagship-products.js          # seed all flagships
//   node src/db/seed-flagship-products.js --dry    # report what would change

import 'dotenv/config';
import pg from 'pg';
import fetch from 'node-fetch';

// scoring.js -> init.js gates SSL on NODE_ENV=production. Render requires
// SSL — without this, the shared pool fails with "SSL/TLS required".
// Set the env var BEFORE the dynamic import below so init.js sees it.
if (!process.env.NODE_ENV && process.env.DATABASE_URL?.includes('render.com')) {
  process.env.NODE_ENV = 'production';
}
const { scoreProduct } = await import('../utils/scoring.js');

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  query_timeout: 30000,
});

const DRY = process.argv.includes('--dry');

// Products explicitly named on the homepage banned-ingredients section.
// brand_match is a case-insensitive substring filter against OFF's brands
// field — keeps us from picking a no-name "Doritos-style" knockoff.
const FLAGSHIPS = [
  // name_must (optional) forces the OFF product_name to contain this string —
  // prevents e.g. searching 'pepsi' returning the Aquafina sibling product.
  // ingredients_override (optional) replaces OFF's ingredient text when OFF's
  // entry has sparse/summary ingredients ("Tortilla Chips") that would
  // produce a falsely-clean score. Pulled from current US package labels.
  { name: 'Doritos Nacho Cheese',         search: 'doritos nacho cheese flavored tortilla', brand_match: 'doritos',     name_must: 'doritos',
    ingredients_override: 'Whole Corn, Vegetable Oil (Corn, Canola, and/or Sunflower Oil), Salt, Cheddar Cheese (Milk, Cheese Cultures, Salt, Enzymes), Maltodextrin (Made from Corn), Whey, Monosodium Glutamate, Buttermilk, Romano Cheese (Part-Skim Cow\'s Milk, Cheese Cultures, Salt, Enzymes), Whey Protein Concentrate, Onion Powder, Corn Flour, Natural and Artificial Flavor, Dextrose, Tomato Powder, Lactose, Spices, Lactic Acid, Artificial Color (Including Yellow 6, Yellow 5, Red 40), Citric Acid, Sugar, Garlic Powder, Skim Milk, Red and Green Bell Pepper Powder, Disodium Inosinate, Disodium Guanylate.' },
  { name: 'Doritos Cool Ranch',           search: 'doritos cool ranch',           brand_match: 'doritos',     name_must: 'doritos' },
  { name: 'Cheetos Crunchy',              search: 'cheetos crunchy',              brand_match: 'cheetos',     name_must: 'cheetos' },
  { name: 'Froot Loops',                  search: 'froot loops',                  brand_match: 'froot loops', name_must: 'froot loops' },
  { name: 'Pop-Tarts Frosted Strawberry', search: 'pop tarts strawberry',         brand_match: 'pop',         name_must: 'pop' },
  { name: 'Mountain Dew Original',        search: 'mountain dew',                 brand_match: 'mountain dew', name_must: 'mountain dew' },
  { name: 'Skittles Original',            search: 'skittles original',            brand_match: 'skittles',    name_must: 'skittles' },
  { name: "M&M's Milk Chocolate",         search: "m&m milk chocolate",           brand_match: 'm&m',         name_must: 'm&m' },
  { name: 'Jell-O Strawberry',            search: 'jello strawberry gelatin',     brand_match: 'jell',        name_must: 'jell' },
  { name: 'Cheez-It Original',            search: 'cheez it crackers original',   brand_match: 'cheez',       name_must: 'cheez' },
  { name: 'Ritz Crackers',                search: 'ritz crackers original nabisco', brand_match: 'ritz',      name_must: 'ritz' },
  { name: 'Coca-Cola Classic',            search: 'coca-cola classic',            brand_match: 'coca',        name_must: 'coca' },
  { name: 'Pepsi Cola',                   search: 'pepsi cola soda',              brand_match: 'pepsi',       name_must: 'pepsi' },
  { name: 'Lucky Charms',                 search: 'lucky charms marshmallow cereal', brand_match: 'lucky',    name_must: 'lucky charms' },
  { name: "Cap'n Crunch Original",        search: "captain crunch original cereal", brand_match: 'crunch',    name_must: 'crunch' },
];

async function searchOFF(query, brandMatch, nameMust) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=true&page_size=15&fields=code,product_name,brands,image_url,nutriscore_grade,nova_group,ingredients_text,ingredients_text_en,nutriments,allergens_tags,labels_tags,countries_tags`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Ick/2.0 flagship-seed' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const bm = brandMatch.toLowerCase();
    const nm = nameMust ? nameMust.toLowerCase() : null;
    const candidates = (data.products || []).filter(p => {
      if (!p.code) return false;
      const name = (p.product_name || p.product_name_en || '').toLowerCase();
      const brands = (p.brands || '').toLowerCase();
      if (!name) return false;
      const brandOk = brands.includes(bm) || name.includes(bm);
      if (!brandOk) return false;
      if (nm && !name.includes(nm)) return false;
      return true;
    });
    // Prefer entries with ingredient data
    const withIngredients = candidates.filter(p => (p.ingredients_text || p.ingredients_text_en || '').length > 10);
    // Prefer US-region entries
    const usFirst = (arr) => [
      ...arr.filter(p => (p.countries_tags || []).some(c => /united-states|usa/i.test(c))),
      ...arr.filter(p => !(p.countries_tags || []).some(c => /united-states|usa/i.test(c))),
    ];
    return usFirst(withIngredients)[0] || usFirst(candidates)[0] || null;
  } catch (e) {
    console.warn(`  OFF search failed: ${e.message}`);
    return null;
  }
}

async function upsertProduct(label, off, ingredientsOverride) {
  const ingredients = ingredientsOverride || off.ingredients_text || off.ingredients_text_en || '';
  const brand = (off.brands || '').split(',')[0].trim();
  const productName = off.product_name || off.product_name_en || label;

  const scored = await scoreProduct({
    ingredients,
    brand,
    nutriscore_grade: off.nutriscore_grade || null,
    nova_group: off.nova_group || null,
    nutriments: off.nutriments || null,
    labels: off.labels_tags || [],
    allergens_tags: off.allergens_tags || [],
    is_organic: false,
    image_url: off.image_url || null,
  });

  console.log(`  [${off.code}] ${brand || '?'} — ${productName}`);
  console.log(`    H:${scored.harmful_ingredients_score} B:${scored.banned_elsewhere_score} T:${scored.transparency_score} P:${scored.processing_score} C:${scored.company_behavior_score}  found=${scored.harmful_ingredients_found.length} flagged`);

  if (DRY) return;

  await pool.query(
    `INSERT INTO products (
       upc, name, brand, image_url, ingredients,
       harmful_ingredients_score, banned_elsewhere_score, transparency_score,
       processing_score, company_behavior_score,
       harmful_ingredients_found, nutrition_facts, allergens_tags,
       nutriscore_grade, nova_group, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, NOW())
     ON CONFLICT (upc) DO UPDATE SET
       name = EXCLUDED.name,
       brand = EXCLUDED.brand,
       image_url = COALESCE(EXCLUDED.image_url, products.image_url),
       ingredients = EXCLUDED.ingredients,
       harmful_ingredients_score = EXCLUDED.harmful_ingredients_score,
       banned_elsewhere_score    = EXCLUDED.banned_elsewhere_score,
       transparency_score        = EXCLUDED.transparency_score,
       processing_score          = EXCLUDED.processing_score,
       company_behavior_score    = EXCLUDED.company_behavior_score,
       harmful_ingredients_found = EXCLUDED.harmful_ingredients_found,
       nutrition_facts           = EXCLUDED.nutrition_facts,
       allergens_tags            = EXCLUDED.allergens_tags,
       nutriscore_grade          = EXCLUDED.nutriscore_grade,
       nova_group                = EXCLUDED.nova_group,
       updated_at                = NOW()`,
    [
      off.code,
      productName,
      brand,
      off.image_url || null,
      ingredients,
      scored.harmful_ingredients_score,
      scored.banned_elsewhere_score,
      scored.transparency_score,
      scored.processing_score,
      scored.company_behavior_score,
      JSON.stringify(scored.harmful_ingredients_found),
      JSON.stringify(scored.nutrition_facts || {}),
      JSON.stringify(scored.allergens_tags || []),
      off.nutriscore_grade || null,
      off.nova_group || null,
    ]
  );
}

async function main() {
  console.log(`Seeding ${FLAGSHIPS.length} flagship products${DRY ? ' (DRY RUN)' : ''}...\n`);

  let seeded = 0;
  let skipped = 0;
  for (const f of FLAGSHIPS) {
    console.log(`• ${f.name}`);
    const off = await searchOFF(f.search, f.brand_match, f.name_must);
    if (!off) {
      console.log(`    ✗ no OFF match`);
      skipped++;
      continue;
    }
    try {
      await upsertProduct(f.name, off, f.ingredients_override);
      seeded++;
    } catch (e) {
      console.log(`    ✗ upsert failed: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\nDone. ${seeded} ${DRY ? 'would be' : ''} seeded, ${skipped} skipped.`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
