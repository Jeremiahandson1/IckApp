// Enrich Wikibooks-sourced recipes with images via MediaWiki API.
//
// Wikibooks Cookbook pages don't populate the PageImages extension, so we
// can't use the prop=pageimages shortcut. Instead we use prop=images (lists
// every file referenced on the page), filter to JPG/PNG, score by name
// overlap with the recipe title, and resolve the chosen file's URL via
// imageinfo.
//
// Two API passes:
//   1. Fetch image lists in batches of 50 recipes
//   2. Resolve URLs in batches of 50 file titles via prop=imageinfo
//
// Idempotent: only touches rows where image_url IS NULL.

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

const API = 'https://en.wikibooks.org/w/api.php';
const USER_AGENT = 'IckThatIsh-RecipeImporter/1.0 (https://ickthatish.com; hello@ickthatish.com)';
const THUMB_WIDTH = 600;
const DELAY_MS = 250;
const BATCH = 50;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`MediaWiki API ${r.status}`);
  return r.json();
}

// Files that show up everywhere and aren't recipe photos. Tune as we see more.
const SKIP_PATTERNS = [
  /\b(2o5dots|edit-?icon|spoon|knife|fork|stub|wiki[-_]?logo)\b/i,
  /^File:(Oven|Stove|Pan|Pot|Bowl|Cup|Plate|Knife|Spoon|Fork)\.(jpe?g|png)$/i,
];

function isCandidateImage(title) {
  if (!/\.(jpe?g|png)$/i.test(title)) return false;
  return !SKIP_PATTERNS.some(p => p.test(title));
}

// Pick the best image for a recipe: prefer files whose filename shares words
// with the recipe name. Fallback to the first non-skipped image.
function pickBestImage(recipeName, imageTitles) {
  const tokens = recipeName.toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3);

  let best = null;
  let bestScore = -1;
  for (const t of imageTitles) {
    const lower = t.toLowerCase();
    const score = tokens.reduce((s, tok) => s + (lower.includes(tok) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

async function fetchImageListsBatch(recipes) {
  const titles = recipes.map(r => `Cookbook:${r.name}`).join('|');
  const data = await apiGet({
    action: 'query',
    prop: 'images',
    imlimit: '50',
    titles,
  });

  // Map API title → row (account for MediaWiki normalization)
  const normalize = new Map();
  for (const n of (data.query?.normalized || [])) normalize.set(n.to, n.from);
  const byTitle = new Map();
  for (const r of recipes) byTitle.set(`Cookbook:${r.name}`, r);

  const results = []; // {row, chosenImage}
  for (const page of (data.query?.pages || [])) {
    const apiTitle = page.title;
    const originalTitle = normalize.get(apiTitle) || apiTitle;
    const row = byTitle.get(originalTitle) || byTitle.get(apiTitle);
    if (!row) continue;

    const candidates = (page.images || [])
      .map(i => i.title)
      .filter(isCandidateImage);

    const chosen = candidates.length > 0 ? pickBestImage(row.name, candidates) : null;
    results.push({ row, chosenImage: chosen });
  }
  return results;
}

async function resolveImageUrlsBatch(fileTitles) {
  if (fileTitles.length === 0) return new Map();
  const data = await apiGet({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(THUMB_WIDTH),
    titles: fileTitles.join('|'),
  });
  const urlMap = new Map();
  const normalize = new Map();
  for (const n of (data.query?.normalized || [])) normalize.set(n.to, n.from);

  for (const page of (data.query?.pages || [])) {
    const ip = page.imageinfo?.[0];
    if (!ip) continue;
    const url = ip.thumburl || ip.url;
    if (!url) continue;
    const apiTitle = page.title;
    const original = normalize.get(apiTitle) || apiTitle;
    urlMap.set(original, url);
    urlMap.set(apiTitle, url);
  }
  return urlMap;
}

async function main() {
  console.log('Enriching Wikibooks recipes with images (via prop=images + imageinfo)…');
  const todo = await pool.query(
    `SELECT id, name FROM recipes
     WHERE source = 'wikibooks' AND image_url IS NULL
     ORDER BY id`
  );
  console.log(`  ${todo.rows.length} rows need images`);

  // PHASE 1: pick best file title per recipe
  const picks = []; // {row, chosenImage}
  for (let i = 0; i < todo.rows.length; i += BATCH) {
    const batch = todo.rows.slice(i, i + BATCH);
    try {
      const batchPicks = await fetchImageListsBatch(batch);
      picks.push(...batchPicks);
    } catch (err) {
      console.warn(`\n  phase1 batch ${i / BATCH + 1} failed: ${err.message}`);
    }
    const done = Math.min(i + BATCH, todo.rows.length);
    process.stdout.write(`\r  phase 1/2: scanned ${done}/${todo.rows.length}`);
    await sleep(DELAY_MS);
  }
  console.log();

  // PHASE 2: dedupe file titles, batch-resolve URLs
  const fileTitles = [...new Set(picks.filter(p => p.chosenImage).map(p => p.chosenImage))];
  console.log(`  ${fileTitles.length} unique file titles to resolve URLs for`);
  const urlMap = new Map();
  for (let i = 0; i < fileTitles.length; i += BATCH) {
    const batch = fileTitles.slice(i, i + BATCH);
    try {
      const m = await resolveImageUrlsBatch(batch);
      for (const [k, v] of m) urlMap.set(k, v);
    } catch (err) {
      console.warn(`\n  phase2 batch ${i / BATCH + 1} failed: ${err.message}`);
    }
    const done = Math.min(i + BATCH, fileTitles.length);
    process.stdout.write(`\r  phase 2/2: resolved ${done}/${fileTitles.length}`);
    await sleep(DELAY_MS);
  }
  console.log();

  // PHASE 3: write URLs back to DB
  let updated = 0, noUrl = 0, noFile = 0;
  for (const { row, chosenImage } of picks) {
    if (!chosenImage) { noFile++; continue; }
    const url = urlMap.get(chosenImage);
    if (!url) { noUrl++; continue; }
    try {
      await pool.query(
        `UPDATE recipes SET image_url = $1 WHERE id = $2 AND image_url IS NULL`,
        [url, row.id]
      );
      updated++;
    } catch {
      noUrl++;
    }
  }

  console.log(`\nDone. updated=${updated}  no_file=${noFile}  no_url=${noUrl}`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
