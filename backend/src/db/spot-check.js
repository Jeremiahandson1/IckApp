// Spot-check the recipe import: row counts, sources, tags, sample data.
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

async function q(label, sql, params = []) {
  const r = await pool.query(sql, params);
  console.log(`\n── ${label} ──`);
  if (r.rows.length === 0) {
    console.log('  (no rows)');
  } else {
    for (const row of r.rows) console.log(' ', row);
  }
}

async function main() {
  await q('Total recipes by source', `
    SELECT source, COUNT(*)::int AS count
    FROM recipes GROUP BY source ORDER BY count DESC`);

  await q('Recipes with nutrition_facts', `
    SELECT
      COUNT(*) FILTER (WHERE nutrition_facts IS NOT NULL)::int AS with_nutrition,
      COUNT(*) FILTER (WHERE nutrition_facts IS NULL)::int AS without_nutrition
    FROM recipes WHERE source = 'wikibooks'`);

  await q('Dietary-tag distribution (wikibooks)', `
    SELECT tag, COUNT(*)::int AS count FROM (
      SELECT jsonb_array_elements_text(dietary_tags) AS tag
      FROM recipes WHERE source = 'wikibooks'
    ) t GROUP BY tag ORDER BY count DESC`);

  await q('Kid-friendly count', `
    SELECT COUNT(*)::int AS kid_friendly_count
    FROM recipes WHERE source = 'wikibooks' AND kid_friendly = true`);

  await q('Random sample (3 recipes)', `
    SELECT name, total_time_minutes, servings, difficulty,
           jsonb_array_length(ingredients) AS ing_count,
           jsonb_array_length(instructions) AS step_count,
           dietary_tags, source_url
    FROM recipes
    WHERE source = 'wikibooks'
    ORDER BY random() LIMIT 3`);

  await q('Recipe with full nutrition (random sample)', `
    SELECT name, nutrition_facts
    FROM recipes
    WHERE source = 'wikibooks' AND nutrition_facts IS NOT NULL
    ORDER BY random() LIMIT 1`);

  await q('Source attribution check', `
    SELECT DISTINCT source_attribution
    FROM recipes WHERE source = 'wikibooks' LIMIT 3`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  pool.end().then(() => process.exit(1));
});
