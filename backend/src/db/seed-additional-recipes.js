// One-shot: seed the 37 branded-replacement recipes from additional-recipes.cjs.
// Idempotent via ON CONFLICT (name) DO NOTHING.
import pg from 'pg';
import 'dotenv/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const additionalRecipes = require('./additional-recipes.cjs');

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  console.log(`Seeding ${additionalRecipes.length} additional curated recipes…`);
  let inserted = 0, duplicate = 0;
  for (const r of additionalRecipes) {
    try {
      const result = await pool.query(
        `INSERT INTO recipes (
          name, description, replaces_category, replaces_products,
          prep_time_minutes, cook_time_minutes, total_time_minutes, servings, difficulty,
          estimated_cost, cost_per_serving, ingredients, instructions, tips,
          health_benefits, vs_store_bought, kid_friendly, allergens, dietary_tags,
          source
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9,
          $10, $11, $12::jsonb, $13::jsonb, $14::jsonb,
          $15::jsonb, $16, $17, $18::jsonb, $19::jsonb, $20
        ) ON CONFLICT (name) DO NOTHING
          RETURNING id`,
        [
          r.name, r.description, r.replaces_category,
          JSON.stringify(r.replaces_products || []),
          r.prep_time_minutes, r.cook_time_minutes, r.total_time_minutes,
          r.servings, r.difficulty,
          r.estimated_cost, r.cost_per_serving,
          JSON.stringify(r.ingredients || []),
          JSON.stringify(r.instructions || []),
          JSON.stringify(r.tips || []),
          JSON.stringify(r.health_benefits || []),
          r.vs_store_bought, r.kid_friendly,
          JSON.stringify(r.allergens || []),
          JSON.stringify(r.dietary_tags || []),
          'curated',
        ]
      );
      if (result.rows.length > 0) inserted++; else duplicate++;
    } catch (err) {
      console.warn(`  ${r.name}: ${err.message}`);
    }
  }
  console.log(`Done. inserted=${inserted} duplicate=${duplicate}`);

  const totals = await pool.query(
    `SELECT source, COUNT(*)::int AS n FROM recipes GROUP BY source ORDER BY n DESC`);
  console.log('Final source distribution:');
  for (const row of totals.rows) console.log(' ', row);

  await pool.end();
}

main().catch(err => { console.error(err); pool.end().then(() => process.exit(1)); });
