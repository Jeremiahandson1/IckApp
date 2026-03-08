/**
 * One-time migration: convert total_score to trigger-based regular column
 * and backfill with the 5-dimension formula.
 *
 * Also converts health_effects column type if needed.
 *
 * Usage:
 *   node backend/src/db/migrate-scoring.js
 *
 * Safe to run multiple times — skips steps that are already done.
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

  // 2. Create trigger function (idempotent)
  await pool.query(`
    CREATE OR REPLACE FUNCTION compute_total_score()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.total_score := ROUND(
        NEW.harmful_ingredients_score * 0.40 +
        NEW.banned_elsewhere_score * 0.20 +
        NEW.transparency_score * 0.15 +
        NEW.processing_score * 0.15 +
        NEW.company_behavior_score * 0.10
      );
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);

  // 3. Check if total_score is GENERATED STORED — if so, convert to regular
  const genCheck = await pool.query(`
    SELECT 1 FROM pg_attrdef
    WHERE adrelid = 'products'::regclass
      AND adnum = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'products'::regclass AND attname = 'total_score'
      )
  `);

  if (genCheck.rows.length > 0) {
    const countRes = await pool.query(`SELECT COUNT(*) FROM products`);
    console.log(`Converting total_score on ${countRes.rows[0].count} products from GENERATED to trigger-based...`);

    await pool.query(`
      ALTER TABLE products DROP COLUMN total_score;
      ALTER TABLE products ADD COLUMN total_score INT;
    `);
    console.log('  ✓ Column converted (metadata-only, instant)');
  } else {
    console.log('total_score already a regular column — skipped conversion');
  }

  // 4. Ensure trigger exists
  await pool.query(`
    DROP TRIGGER IF EXISTS trg_total_score ON products;
    CREATE TRIGGER trg_total_score
      BEFORE INSERT OR UPDATE ON products
      FOR EACH ROW
      EXECUTE FUNCTION compute_total_score();
  `);

  // 5. Backfill all rows
  const countRes = await pool.query(`SELECT COUNT(*) FROM products WHERE total_score IS NULL OR total_score = 0`);
  const needsBackfill = parseInt(countRes.rows[0].count);
  if (needsBackfill > 0) {
    console.log(`Backfilling ${needsBackfill} rows...`);
    await pool.query(`
      UPDATE products SET total_score = ROUND(
        harmful_ingredients_score * 0.40 +
        banned_elsewhere_score * 0.20 +
        transparency_score * 0.15 +
        processing_score * 0.15 +
        company_behavior_score * 0.10
      )
    `);
    console.log('  ✓ Backfill complete');
  } else {
    console.log('All rows already have total_score — skipped backfill');
  }

  await pool.query('CREATE INDEX IF NOT EXISTS idx_products_score ON products(total_score)');

  console.log(`Migration completed in ${Date.now() - t0}ms`);
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
