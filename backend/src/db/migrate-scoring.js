/**
 * One-time migration: convert total_score from old Yuka formula to 5-dimension model.
 *
 * This is intentionally NOT part of initDatabase() because it rewrites every row
 * in the products table (DROP + ADD GENERATED STORED column + rebuild index).
 * On large tables (100k+ rows) this takes minutes and would block server startup.
 *
 * Usage:
 *   node backend/src/db/migrate-scoring.js
 *
 * Safe to run multiple times — skips if already on the 5-dimension formula.
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const t0 = Date.now();

  // 1. Migrate health_effects column type if needed
  const typeCheck = await pool.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'harmful_ingredients' AND column_name = 'health_effects'
  `);
  if (typeCheck.rows.length && typeCheck.rows[0].data_type !== 'text') {
    console.log('Converting harmful_ingredients.health_effects to TEXT...');
    await pool.query(`ALTER TABLE harmful_ingredients ALTER COLUMN health_effects TYPE TEXT USING health_effects::TEXT`);
    console.log('  done');
  } else {
    console.log('harmful_ingredients.health_effects already TEXT — skipped');
  }

  // 2. Migrate total_score generated column formula
  const colCheck = await pool.query(`
    SELECT pg_get_expr(adbin, adrelid) as expr
    FROM pg_attrdef
    JOIN pg_attribute ON pg_attribute.attnum = pg_attrdef.adnum
      AND pg_attribute.attrelid = pg_attrdef.adrelid
    WHERE pg_attribute.attrelid = 'products'::regclass
      AND pg_attribute.attname = 'total_score'
  `);

  const currentExpr = colCheck.rows[0]?.expr || '';
  const needsMigration = currentExpr.includes('nutrition_score')
    || currentExpr.includes('additives_score')
    || currentExpr.includes('organic_bonus');

  if (!needsMigration) {
    console.log('total_score already uses 5-dimension formula — skipped');
  } else {
    const countRes = await pool.query(`SELECT COUNT(*) FROM products`);
    console.log(`Migrating total_score on ${countRes.rows[0].count} products to 5-dimension formula...`);
    console.log('  (this rewrites every row — may take a few minutes on large tables)');

    await pool.query(`
      ALTER TABLE products DROP COLUMN total_score;
      ALTER TABLE products ADD COLUMN total_score INT GENERATED ALWAYS AS (
        ROUND(
          harmful_ingredients_score * 0.40 +
          banned_elsewhere_score * 0.20 +
          transparency_score * 0.15 +
          processing_score * 0.15 +
          company_behavior_score * 0.10
        )
      ) STORED;
      CREATE INDEX IF NOT EXISTS idx_products_score ON products(total_score);
    `);
    console.log('  ✓ total_score migrated to 5-dimension formula');
  }

  console.log(`Migration completed in ${Date.now() - t0}ms`);
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
