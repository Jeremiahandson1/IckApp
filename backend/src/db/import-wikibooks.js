#!/usr/bin/env node
/**
 * Wikibooks Cookbook importer.
 *
 * Pulls recipes from en.wikibooks.org Category:Recipes via the MediaWiki API,
 * parses the structured wikitext templates ({{recipesummary}}, {{Nutrition Summary}},
 * ==Ingredients==, ==Procedure==) and inserts them into the recipes table.
 *
 * License: Wikibooks content is CC-BY-SA 4.0. Each imported row carries a
 * source_url and source_attribution string so we can credit upstream.
 *
 * Usage:
 *   node src/db/import-wikibooks.js                # full run (~3,700 recipes)
 *   node src/db/import-wikibooks.js --limit=10     # test with 10
 *   node src/db/import-wikibooks.js --dry-run      # parse but don't insert
 */

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

const API = 'https://en.wikibooks.org/w/api.php';
const USER_AGENT = 'IckThatIsh-RecipeImporter/1.0 (https://ickthatish.com; hello@ickthatish.com)';
const REQUEST_DELAY_MS = 250; // be polite to Wikimedia
const BATCH_SIZE = 20;        // pages fetched per API call (revisions endpoint allows 50)
const ATTRIBUTION = 'Wikibooks Cookbook (en.wikibooks.org) — CC BY-SA 4.0';

// ── CLI args ──
const args = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  acc[k] = v === undefined ? true : v;
  return acc;
}, {});
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const DRY_RUN = !!args['dry-run'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`MediaWiki API ${r.status}: ${url}`);
  return r.json();
}

// ── List all recipe pages (paginated) ──
async function* listRecipes() {
  let cont = null;
  while (true) {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: 'Category:Recipes',
      cmtype: 'page',
      cmlimit: '500',
      cmprop: 'ids|title',
    };
    if (cont) params.cmcontinue = cont;
    const data = await apiGet(params);
    for (const m of data.query.categorymembers) {
      // Only include the Cookbook: namespace (some categories cross-link)
      if (m.title.startsWith('Cookbook:')) {
        yield { pageid: m.pageid, title: m.title };
      }
    }
    if (!data.continue?.cmcontinue) break;
    cont = data.continue.cmcontinue;
    await sleep(REQUEST_DELAY_MS);
  }
}

// ── Batch-fetch wikitext for N pages at once ──
async function fetchWikitextBatch(pageids) {
  const data = await apiGet({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    pageids: pageids.join('|'),
  });
  const out = {};
  for (const page of data.query.pages) {
    const wt = page.revisions?.[0]?.slots?.main?.content;
    if (wt) out[page.pageid] = { title: page.title, wikitext: wt };
  }
  return out;
}

// ── Wikitext cleaners ──

function cleanWikitext(s) {
  if (!s) return '';
  return s
    // [[Cookbook:Pasta|egg noodles]] → egg noodles
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1')
    // [[Cookbook:Salt]] → Salt
    .replace(/\[\[(?:Cookbook:)?([^\]|]+)\]\]/g, '$1')
    // {{convert|8|oz|g|abbr=on}} → 8 oz   (take first 2 args as value+unit)
    .replace(/\{\{convert\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1 $2')
    // Strip remaining simple inline templates {{foo}} or {{foo|bar}}
    .replace(/\{\{[^{}]*\}\}/g, '')
    // Bold/italic
    .replace(/'''([^']+)'''/g, '$1')
    .replace(/''([^']+)''/g, '$1')
    // HTML refs & comments
    .replace(/<ref[^>]*>.*?<\/ref>/gis, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<!--.*?-->/gs, '')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Extract a top-level template's params (handles nested braces shallowly)
function extractTemplate(wikitext, name) {
  const re = new RegExp(`\\{\\{${name}\\s*([^}]*(?:\\{\\{[^}]*\\}\\}[^}]*)*)\\}\\}`, 'i');
  const m = re.exec(wikitext);
  if (!m) return null;
  const body = m[1];
  const params = {};
  // Split top-level | (not inside nested {{...}})
  let depth = 0;
  let buf = '';
  const parts = [];
  for (const ch of body) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === '|' && depth === 0) { parts.push(buf); buf = ''; }
    else buf += ch;
  }
  parts.push(buf);
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const k = part.slice(0, eq).trim().toLowerCase();
      const v = part.slice(eq + 1).trim();
      if (k) params[k] = v;
    }
  }
  return params;
}

function extractSection(wikitext, headings) {
  // headings = array of keyword prefixes (e.g. 'Procedure' also matches '==Procedure (brief)==').
  // We match the FIRST heading that starts with the keyword and return its body
  // up to the next top-level heading.
  for (const h of headings) {
    const re = new RegExp(`==\\s*${h}\\b[^=\\n]*==\\s*\\n([\\s\\S]*?)(?=\\n==[^=]|$)`, 'i');
    const m = re.exec(wikitext);
    if (m) return m[1];
  }
  return null;
}

function parseList(section, marker) {
  if (!section) return [];
  return section
    .split('\n')
    .map(line => line.trim())
    // Accept "* foo", "*foo", "** foo" (sub-bullet — flatten), and same for "#".
    // We only count lines whose FIRST char is the marker.
    .filter(line => line.startsWith(marker))
    // Strip leading run of the marker char (and one optional space) before clean.
    .map(line => cleanWikitext(line.replace(new RegExp(`^\\${marker}+\\s*`), '')))
    .filter(Boolean);
}

// Try to split "8 oz wide egg noodles" into { amount: "8 oz", item: "wide egg noodles" }
const UNIT_RE = /^([\d./¼½¾⅓⅔⅕⅖⅗⅘⅛⅜⅝⅞]+(?:\s*[-–to ]+\s*[\d./]+)?\s*(?:teaspoons?|tablespoons?|tbsps?|tsps?|cups?|ounces?|oz|fl\s*oz|lbs?|pounds?|grams?|g|kg|ml|liters?|l|cans?|packages?|pkg|pkgs?|cloves?|sprigs?|stalks?|slices?|pieces?|pinch(?:es)?|dash(?:es)?|drops?|sticks?|inch(?:es)?|small|large|medium|big)\b\s*(?:of\s+)?)(.+)$/i;
const PLAIN_QTY_RE = /^([\d./¼½¾⅓⅔⅕⅖⅗⅘⅛⅜⅝⅞]+(?:\s+[\d./]+)?)\s+(.+)$/;

function splitIngredient(line) {
  let m = UNIT_RE.exec(line);
  if (m) return { amount: m[1].trim(), item: m[2].trim() };
  m = PLAIN_QTY_RE.exec(line);
  if (m) return { amount: m[1].trim(), item: m[2].trim() };
  return { item: line };
}

// ── Field converters ──

function parseTimeToMinutes(str) {
  if (!str) return null;
  const cleaned = String(str).toLowerCase();
  let total = 0;
  const h = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  const m = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (h) total += parseFloat(h[1]) * 60;
  if (m) total += parseFloat(m[1]);
  if (!h && !m) {
    const n = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (n) total = parseFloat(n[1]); // assume minutes
  }
  return total > 0 ? Math.round(total) : null;
}

function parseDifficulty(val) {
  if (!val) return null;
  const n = parseInt(val, 10);
  if (Number.isFinite(n)) {
    if (n <= 2) return 'Easy';
    if (n === 3) return 'Medium';
    return 'Hard';
  }
  const s = String(val).toLowerCase().trim();
  if (s.startsWith('easy')) return 'Easy';
  if (s.startsWith('med')) return 'Medium';
  if (s.startsWith('hard') || s.startsWith('diff')) return 'Hard';
  return null;
}

// Parse {{Nutrition Summary|Cals=487|Sodium=825 mg|...}} into our nutrition_facts shape.
// Values come with units we strip ("825 mg" → 825).
function parseNutritionTemplate(params) {
  if (!params) return null;
  const num = (v) => {
    if (!v) return null;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const nf = {
    calories:      num(params.cals || params.calories),
    fat:           num(params.totalfat || params.fat),
    saturated_fat: num(params.satfat || params.saturatedfat),
    carbs:         num(params.carbs || params.carbohydrates),
    sugars:        num(params.sugars),
    fiber:         num(params.fiber),
    protein:       num(params.protein),
    sodium:        num(params.sodium),     // mg
    cholesterol:   num(params.cholesterol),
  };
  // Drop nulls; if everything is null, return null
  const filtered = Object.fromEntries(Object.entries(nf).filter(([, v]) => v != null));
  return Object.keys(filtered).length > 0 ? filtered : null;
}

// ── Main parser per page ──

function parseRecipePage(title, wikitext) {
  const summary = extractTemplate(wikitext, 'recipesummary') || {};
  const nutrition = extractTemplate(wikitext, 'Nutrition Summary');

  const ingredientsSection = extractSection(wikitext, ['Ingredients', 'Special equipment and ingredients']);
  const procedureSection = extractSection(wikitext, [
    'Procedure', 'Directions', 'Instructions', 'Method', 'Preparation', 'Steps', 'How to',
  ]);

  const ingredients = parseList(ingredientsSection, '*').map(splitIngredient);
  const instructions = parseList(procedureSection, '#');

  // Require at least 2 ingredients and 1 instruction step for a usable recipe
  if (ingredients.length < 2 || instructions.length < 1) return null;

  const cleanTitle = title.replace(/^Cookbook:\s*/, '').trim();
  const servings = parseInt(summary.servings || '', 10) || null;
  const totalMin = parseTimeToMinutes(summary.time);

  return {
    name: cleanTitle,
    description: null,
    replaces_category: summary.category ? summary.category.replace(/\s+recipes?$/i, '').toLowerCase() : null,
    prep_time_minutes: null,
    cook_time_minutes: null,
    total_time_minutes: totalMin,
    servings,
    difficulty: parseDifficulty(summary.difficulty),
    estimated_cost: null,
    cost_per_serving: null,
    ingredients,
    instructions,
    tips: [],
    health_benefits: [],
    vs_store_bought: null,
    image_url: null,
    video_url: null,
    kid_friendly: false, // don't assume — leave for user to opt in
    allergens: [],
    dietary_tags: [],
    nutrition_facts: parseNutritionTemplate(nutrition),
    source: 'wikibooks',
    source_url: `https://en.wikibooks.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    source_attribution: ATTRIBUTION,
  };
}

async function insertRecipe(r) {
  if (DRY_RUN) return 'dry-run';
  try {
    const result = await pool.query(
      `INSERT INTO recipes (
        name, description, replaces_category, prep_time_minutes, cook_time_minutes,
        total_time_minutes, servings, difficulty, ingredients, instructions, tips,
        health_benefits, vs_store_bought, image_url, kid_friendly, allergens, dietary_tags,
        nutrition_facts, source, source_url, source_attribution
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb,
        $12::jsonb, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20, $21
      ) ON CONFLICT (name) DO NOTHING
        RETURNING id`,
      [
        r.name, r.description, r.replaces_category, r.prep_time_minutes, r.cook_time_minutes,
        r.total_time_minutes, r.servings, r.difficulty,
        JSON.stringify(r.ingredients), JSON.stringify(r.instructions), JSON.stringify(r.tips),
        JSON.stringify(r.health_benefits), r.vs_store_bought, r.image_url, r.kid_friendly,
        JSON.stringify(r.allergens), JSON.stringify(r.dietary_tags),
        r.nutrition_facts ? JSON.stringify(r.nutrition_facts) : null,
        r.source, r.source_url, r.source_attribution,
      ]
    );
    return result.rows.length > 0 ? 'inserted' : 'duplicate';
  } catch (err) {
    return `error:${err.message}`;
  }
}

// ── Metadata enrichment ──
// The "15 subcategories" of Category:Recipes are mostly taxonomy facets
// (Kid-friendly, Vegan, Gluten-free, etc.) — they tag the same recipes from
// different angles. After the main insert pass we walk these facet categories
// and update kid_friendly + dietary_tags on existing rows.

const FACET_CATEGORIES = [
  { cat: 'Category:Kid-friendly recipes', column: 'kid_friendly', value: true },
  { cat: 'Category:Vegan recipes',        tag: 'vegan' },
  { cat: 'Category:Vegetarian recipes',   tag: 'vegetarian' },
  { cat: 'Category:Gluten-free recipes',  tag: 'gluten-free' },
  { cat: 'Category:Low-sodium recipes',   tag: 'low-sodium' },
  { cat: 'Category:Low-GI recipes',       tag: 'low-glycemic' },
  { cat: 'Category:Pescatarian recipes',  tag: 'pescatarian' },
  { cat: 'Category:Kosher recipes',       tag: 'kosher' },
  { cat: 'Category:Halal recipes',        tag: 'halal' },
  { cat: 'Category:Raw recipes',          tag: 'raw' },
  { cat: 'Category:Atkins recipes',       tag: 'atkins' },
  { cat: 'Category:Featured recipes',     tag: 'featured' },
];

async function listCategoryTitles(category) {
  const titles = [];
  let cont = null;
  while (true) {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: 'page',
      cmlimit: '500',
      cmprop: 'title',
    };
    if (cont) params.cmcontinue = cont;
    const data = await apiGet(params);
    for (const m of data.query.categorymembers) {
      if (m.title.startsWith('Cookbook:')) {
        titles.push(m.title.replace(/^Cookbook:\s*/, '').trim());
      }
    }
    if (!data.continue?.cmcontinue) break;
    cont = data.continue.cmcontinue;
    await sleep(REQUEST_DELAY_MS);
  }
  return titles;
}

async function enrichMetadata() {
  if (DRY_RUN) {
    console.log('  (dry-run) skipping metadata enrichment');
    return;
  }
  console.log('\nEnriching metadata from facet categories...');
  for (const facet of FACET_CATEGORIES) {
    let titles;
    try {
      titles = await listCategoryTitles(facet.cat);
    } catch (err) {
      console.warn(`  ${facet.cat}: list failed (${err.message})`);
      continue;
    }
    if (titles.length === 0) {
      console.log(`  ${facet.cat}: 0 members`);
      continue;
    }

    let updated = 0;
    if (facet.column === 'kid_friendly') {
      // Simple boolean update — only touch wikibooks-sourced rows.
      const result = await pool.query(
        `UPDATE recipes SET kid_friendly = $1
         WHERE source = 'wikibooks' AND name = ANY($2::text[])`,
        [facet.value, titles]
      );
      updated = result.rowCount;
    } else if (facet.tag) {
      // Append tag if not already present.
      const result = await pool.query(
        `UPDATE recipes
         SET dietary_tags = COALESCE(dietary_tags, '[]'::jsonb) || $1::jsonb
         WHERE source = 'wikibooks'
           AND name = ANY($2::text[])
           AND NOT (COALESCE(dietary_tags, '[]'::jsonb) @> $1::jsonb)`,
        [JSON.stringify([facet.tag]), titles]
      );
      updated = result.rowCount;
    }
    console.log(`  ${facet.cat}: ${titles.length} members → ${updated} rows updated`);
    await sleep(REQUEST_DELAY_MS);
  }
}

// ── Main ──

async function main() {
  console.log(`Wikibooks Cookbook importer  (limit=${LIMIT === Infinity ? 'all' : LIMIT}, dry-run=${DRY_RUN})`);

  // 1. Enumerate all recipe page IDs
  const pages = [];
  for await (const p of listRecipes()) {
    pages.push(p);
    if (pages.length >= LIMIT) break;
  }
  console.log(`  enumerated ${pages.length} recipe pages`);

  // 2. Batch-fetch wikitext and process
  let inserted = 0, duplicate = 0, skipped = 0, errors = 0;
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    let batchData;
    try {
      batchData = await fetchWikitextBatch(batch.map(p => p.pageid));
    } catch (err) {
      console.warn(`  batch ${i / BATCH_SIZE + 1} fetch failed: ${err.message}`);
      errors += batch.length;
      await sleep(REQUEST_DELAY_MS * 2);
      continue;
    }

    for (const p of batch) {
      const entry = batchData[p.pageid];
      if (!entry) { skipped++; if (args.verbose) console.warn(`\n  skip (no wikitext): ${p.title}`); continue; }
      try {
        const recipe = parseRecipePage(entry.title, entry.wikitext);
        if (!recipe) {
          skipped++;
          if (args.verbose) {
            const hasIng = /==\s*(Ingredients|Special equipment and ingredients)\s*==/i.test(entry.wikitext);
            const hasProc = /==\s*(Procedure|Directions|Instructions|Method)\s*==/i.test(entry.wikitext);
            console.warn(`\n  skip ${p.title}  (ing-section=${hasIng}, proc-section=${hasProc})`);
          }
          continue;
        }
        const result = await insertRecipe(recipe);
        if (result === 'inserted')      inserted++;
        else if (result === 'duplicate') duplicate++;
        else if (result === 'dry-run')   inserted++; // count as if inserted in dry-run
        else                             { errors++; console.warn(`  ${p.title}: ${result}`); }
      } catch (err) {
        errors++;
        console.warn(`  parse error ${p.title}: ${err.message}`);
      }
    }

    const done = Math.min(i + BATCH_SIZE, pages.length);
    process.stdout.write(`\r  processed ${done}/${pages.length}  (inserted=${inserted} dup=${duplicate} skip=${skipped} err=${errors})`);

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nDone with main import. inserted=${inserted} duplicate=${duplicate} skipped=${skipped} errors=${errors}`);

  // Phase 2: metadata enrichment from facet subcategories
  await enrichMetadata();

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  pool.end().then(() => process.exit(1));
});
