// Direct-insert seed for products explicitly called out on the homepage
// that don't exist in Open Food Facts (so the on-scan OFF/USDA/FatSecret
// fallback returns "Product Not Found"). Inserts known-good ingredient
// data taken from current US package labels, lets the live 5-dimension
// scorer assign scores, and writes to the products table by UPC.
//
// Each entry can include multiple UPC variants for the same product so
// scanning any of them returns a real result.
//
// Idempotent — uses INSERT ... ON CONFLICT (upc) DO UPDATE.

import 'dotenv/config';
if (!process.env.NODE_ENV && process.env.DATABASE_URL?.includes('render.com')) {
  process.env.NODE_ENV = 'production';
}
import pg from 'pg';
const { scoreProduct, weightedTotal } = await import('../utils/scoring.js');

const DRY = process.argv.includes('--dry');
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

// Products called out by name on the homepage that need guaranteed coverage.
// upcs: list of variant UPCs (different sizes/packages of same product).
// ingredients: current US package label text.
const DIRECT = [
  {
    name: 'Mountain Dew Citrus Soda',
    brand: 'Mountain Dew',
    upcs: ['012000001529', '0012000001529', '012000001031', '0012000001031', '012000809972', '0012000809972'],
    image_url: null,
    ingredients: 'Carbonated water, high fructose corn syrup, concentrated orange juice, citric acid, natural flavor, sodium benzoate (preserves freshness), caffeine, sodium citrate, erythorbic acid (preserves freshness), gum arabic, calcium disodium EDTA (to protect flavor), Yellow 5.',
    nutriscore_grade: 'e',
    nova_group: 4,
    allergens_tags: [],
  },
  {
    name: 'Doritos Nacho Cheese Flavored Tortilla Chips',
    brand: 'Frito-Lay',
    upcs: ['028400064545', '0028400064545', '028400089449', '0028400089449', '028400420532', '0028400420532'],
    image_url: null,
    ingredients: 'Whole Corn, Vegetable Oil (Corn, Canola, and/or Sunflower Oil), Salt, Cheddar Cheese (Milk, Cheese Cultures, Salt, Enzymes), Maltodextrin (Made from Corn), Whey, Monosodium Glutamate, Buttermilk, Romano Cheese (Part-Skim Cow\'s Milk, Cheese Cultures, Salt, Enzymes), Whey Protein Concentrate, Onion Powder, Corn Flour, Natural and Artificial Flavor, Dextrose, Tomato Powder, Lactose, Spices, Lactic Acid, Artificial Color (Including Yellow 6, Yellow 5, Red 40), Citric Acid, Sugar, Garlic Powder, Skim Milk, Red and Green Bell Pepper Powder, Disodium Inosinate, Disodium Guanylate.',
    nutriscore_grade: 'd',
    nova_group: 4,
    allergens_tags: ['en:milk'],
  },
  {
    name: 'Pop-Tarts Frosted Strawberry',
    brand: 'Pop-Tarts',
    upcs: ['038000123771', '0038000123771', '038000138515', '0038000138515', '038000223006', '0038000223006'],
    image_url: null,
    ingredients: 'Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Vitamin B1 [Thiamin Mononitrate], Vitamin B2 [Riboflavin], Folic Acid), Corn Syrup, High Fructose Corn Syrup, Dextrose, Soybean and Palm Oil (with TBHQ for Freshness), Sugar, Cracker Meal, Contains Two Percent or Less of Wheat Starch, Salt, Dried Strawberries, Dried Pears, Dried Apples, Leavening (Baking Soda, Sodium Acid Pyrophosphate, Monocalcium Phosphate), Citric Acid, Milled Corn, Gelatin, Modified Wheat Starch, Soy Lecithin, Xanthan Gum, Modified Corn Starch, Caramel Color, Vitamin A Palmitate, Niacinamide, Reduced Iron, Pyridoxine Hydrochloride (Vitamin B6), Riboflavin (Vitamin B2), Thiamin Hydrochloride (Vitamin B1), Red 40, Yellow 6, Blue 1.',
    nutriscore_grade: 'e',
    nova_group: 4,
    allergens_tags: ['en:gluten', 'en:soybeans', 'en:wheat'],
  },
  {
    name: 'Ritz Original Crackers',
    brand: 'Ritz',
    upcs: ['044000032029', '0044000032029', '044000028589', '0044000028589'],
    image_url: null,
    ingredients: 'Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamin Mononitrate {Vitamin B1}, Riboflavin {Vitamin B2}, Folic Acid), Vegetable Oil (Soybean, Palm, and/or Canola Oil), Sugar, Salt, Leavening (Baking Soda and/or Calcium Phosphate), High Fructose Corn Syrup, Soy Lecithin, Natural Flavor.',
    nutriscore_grade: 'd',
    nova_group: 4,
    allergens_tags: ['en:gluten', 'en:soybeans', 'en:wheat'],
  },
  {
    name: 'Lucky Charms Cereal',
    brand: 'General Mills',
    upcs: ['016000275867', '0016000275867', '016000487970', '0016000487970'],
    image_url: null,
    ingredients: 'Whole Grain Oats, Sugar, Corn Syrup, Modified Corn Starch, Dextrose, Salt, Gelatin, Trisodium Phosphate, Color Added, Natural and Artificial Flavor, Yellow 5, Yellow 6, Red 40, Blue 1, Vitamin E (Mixed Tocopherols) Added to Preserve Freshness, BHT Added to Preserve Freshness.',
    nutriscore_grade: 'd',
    nova_group: 4,
    allergens_tags: [],
  },
];

async function main() {
  console.log(`Direct-seeding ${DIRECT.length} flagship products (each with multiple UPC variants)${DRY ? ' [DRY RUN]' : ''}...\n`);

  let total_upserted = 0;
  for (const item of DIRECT) {
    const scored = await scoreProduct({
      ingredients: item.ingredients,
      brand: item.brand,
      nutriscore_grade: item.nutriscore_grade,
      nova_group: item.nova_group,
      nutriments: null,
      labels: [],
      allergens_tags: item.allergens_tags,
      is_organic: false,
      image_url: item.image_url,
    });

    const total = weightedTotal(scored);

    console.log(`• ${item.brand} — ${item.name}`);
    console.log(`    score=${total ?? 'UNSCORED'} (H:${scored.harmful_ingredients_score} B:${scored.banned_elsewhere_score} T:${scored.transparency_score} P:${scored.processing_score} C:${scored.company_behavior_score}) flagged=[${scored.harmful_ingredients_found.map(f=>f.name).join(', ')}]`);
    console.log(`    upcs: ${item.upcs.join(', ')}`);

    if (DRY) continue;

    // Resolve company_id via brand_aliases so the product page shows the
    // parent company name + controversies instead of "Company not identified".
    let companyId = null;
    const brandNorm = (item.brand || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\b(inc|llc|ltd|corp|corporation|co|company|usa|us|na|brands|foods|group|holdings|gmbh|sa|ag|plc|llp|limited)\b/gi, ' ')
      .replace(/[^a-z0-9]/g, '');
    if (brandNorm) {
      const r = await pool.query(
        `SELECT company_id FROM brand_aliases WHERE alias = $1 LIMIT 1`,
        [brandNorm]
      );
      if (r.rows.length > 0) companyId = r.rows[0].company_id;
    }
    if (companyId) console.log(`    company_id=${companyId} (matched alias '${brandNorm}')`);
    else console.log(`    company_id=NULL (no alias match for '${brandNorm}')`);

    for (const upc of item.upcs) {
      await pool.query(
        `INSERT INTO products (
           upc, name, brand, company_id, image_url, ingredients,
           harmful_ingredients_score, banned_elsewhere_score, transparency_score,
           processing_score, company_behavior_score,
           harmful_ingredients_found, allergens_tags,
           nutriscore_grade, nova_group, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, NOW())
         ON CONFLICT (upc) DO UPDATE SET
           name = EXCLUDED.name,
           brand = EXCLUDED.brand,
           company_id = COALESCE(EXCLUDED.company_id, products.company_id),
           ingredients = EXCLUDED.ingredients,
           harmful_ingredients_score = EXCLUDED.harmful_ingredients_score,
           banned_elsewhere_score    = EXCLUDED.banned_elsewhere_score,
           transparency_score        = EXCLUDED.transparency_score,
           processing_score          = EXCLUDED.processing_score,
           company_behavior_score    = EXCLUDED.company_behavior_score,
           harmful_ingredients_found = EXCLUDED.harmful_ingredients_found,
           allergens_tags            = EXCLUDED.allergens_tags,
           nutriscore_grade          = EXCLUDED.nutriscore_grade,
           nova_group                = EXCLUDED.nova_group,
           updated_at                = NOW()`,
        [
          upc, item.name, item.brand, companyId, item.image_url, item.ingredients,
          scored.harmful_ingredients_score,
          scored.banned_elsewhere_score,
          scored.transparency_score,
          scored.processing_score,
          scored.company_behavior_score,
          JSON.stringify(scored.harmful_ingredients_found),
          JSON.stringify(item.allergens_tags || []),
          item.nutriscore_grade,
          item.nova_group,
        ]
      );
      total_upserted++;
    }
  }

  console.log(`\nDone. ${total_upserted} UPC variants ${DRY ? 'would be' : ''} upserted across ${DIRECT.length} products.`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
