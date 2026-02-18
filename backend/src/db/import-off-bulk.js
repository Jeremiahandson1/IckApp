#!/usr/bin/env node
// ============================================================
// BULK OPEN FOOD FACTS IMPORT
// Downloads the full OFF database dump (TSV), streams it,
// filters to US products, and batch-inserts into Postgres.
// 
// Run on Render shell:
//   cd /opt/render/project/src/backend
//   node src/db/import-off-bulk.js
//
// No extra dependencies — uses only Node.js built-ins + pg.
// ============================================================

import { createReadStream, createWriteStream, existsSync, statSync, unlinkSync } from 'fs';
import { createInterface } from 'readline';
import { createGunzip } from 'zlib';
import https from 'https';
import http from 'http';
import pg from 'pg';

const { Pool } = pg;

// ── CONFIG ──
const CSV_URL = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
const LOCAL_FILE = '/tmp/off-products.csv.gz';
const BATCH_SIZE = 500;
const REPORT_EVERY = 5000;
const FILTER_US = true;
const MAX_PRODUCTS = 0;  // 0 = no limit

// ── DB CONNECTION ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') 
    ? { rejectUnauthorized: false } 
    : undefined,
  max: 5,
});

// ── STATS ──
let stats = {
  total_rows: 0,
  skipped_no_code: 0,
  skipped_no_name: 0,
  skipped_non_us: 0,
  imported: 0,
  errors: 0,
  batches: 0,
  start_time: Date.now(),
};

// ============================================================
// DOWNLOAD
// ============================================================
function downloadFile(url, dest) {
  if (existsSync(dest)) {
    const size = statSync(dest).size;
    if (size > 100_000_000) {
      console.log(`  Using cached file (${(size / 1e9).toFixed(2)} GB)`);
      return Promise.resolve();
    }
    unlinkSync(dest);
  }

  console.log(`  Downloading from OFF...`);
  console.log('  This is ~2-3 GB — expect 5-15 minutes on Render...');

  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    let downloaded = 0;
    let lastReport = 0;

    const doRequest = (reqUrl) => {
      const proto = reqUrl.startsWith('https') ? https : http;
      proto.get(reqUrl, { 
        headers: { 'User-Agent': 'Ick/2.0 (bulk-import)' },
        timeout: 600000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const totalSize = parseInt(res.headers['content-length'] || '0');
        
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          const mb = downloaded / 1e6;
          if (mb - lastReport > 100) {
            const pct = totalSize ? ` (${((downloaded/totalSize)*100).toFixed(0)}%)` : '';
            process.stdout.write(`\r  ${mb.toFixed(0)} MB downloaded${pct}        `);
            lastReport = mb;
          }
        });

        res.pipe(file);
        file.on('finish', () => {
          console.log(`\n  Download complete: ${(downloaded / 1e9).toFixed(2)} GB`);
          file.close(resolve);
        });
        res.on('error', reject);
      }).on('error', reject);
    };

    doRequest(url);
  });
}

// ============================================================
// TAB-SEPARATED LINE PARSER (no external deps)
// ============================================================
function parseTsvLine(line, headers) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\t' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);

  const row = {};
  for (let i = 0; i < headers.length && i < fields.length; i++) {
    row[headers[i]] = fields[i];
  }
  return row;
}

// ============================================================
// BATCH INSERT
// ============================================================
async function insertBatch(batch) {
  if (batch.length === 0) return;

  const values = [];
  const placeholders = [];
  let idx = 1;

  for (const p of batch) {
    placeholders.push(
      `($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10})`
    );
    values.push(
      p.upc, p.name, p.brand, p.category, p.image_url, p.ingredients,
      p.nutriscore_grade, p.nova_group, p.is_organic,
      JSON.stringify(p.allergens_tags), JSON.stringify(p.nutrition_facts)
    );
    idx += 11;
  }

  const query = `
    INSERT INTO products (upc, name, brand, category, image_url, ingredients,
      nutriscore_grade, nova_group, is_organic, allergens_tags, nutrition_facts)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (upc) DO UPDATE SET
      name = COALESCE(NULLIF(EXCLUDED.name, ''), products.name),
      brand = COALESCE(NULLIF(EXCLUDED.brand, ''), products.brand),
      category = COALESCE(NULLIF(EXCLUDED.category, ''), products.category),
      image_url = COALESCE(EXCLUDED.image_url, products.image_url),
      ingredients = COALESCE(NULLIF(EXCLUDED.ingredients, ''), products.ingredients),
      nutriscore_grade = COALESCE(EXCLUDED.nutriscore_grade, products.nutriscore_grade),
      nova_group = COALESCE(EXCLUDED.nova_group, products.nova_group),
      is_organic = EXCLUDED.is_organic OR products.is_organic,
      allergens_tags = CASE WHEN EXCLUDED.allergens_tags != '[]'::jsonb THEN EXCLUDED.allergens_tags ELSE products.allergens_tags END,
      nutrition_facts = CASE WHEN EXCLUDED.nutrition_facts != '{}'::jsonb THEN EXCLUDED.nutrition_facts ELSE products.nutrition_facts END
  `;

  try {
    await pool.query(query, values);
    stats.imported += batch.length;
    stats.batches++;
  } catch (err) {
    // Batch failed — insert one by one to salvage what we can
    let ok = 0;
    for (const p of batch) {
      try {
        await pool.query(`
          INSERT INTO products (upc, name, brand, category, image_url, ingredients,
            nutriscore_grade, nova_group, is_organic, allergens_tags, nutrition_facts)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (upc) DO UPDATE SET
            name = COALESCE(NULLIF(EXCLUDED.name, ''), products.name),
            brand = COALESCE(NULLIF(EXCLUDED.brand, ''), products.brand),
            image_url = COALESCE(EXCLUDED.image_url, products.image_url),
            ingredients = COALESCE(NULLIF(EXCLUDED.ingredients, ''), products.ingredients),
            nutriscore_grade = COALESCE(EXCLUDED.nutriscore_grade, products.nutriscore_grade),
            nova_group = COALESCE(EXCLUDED.nova_group, products.nova_group)
        `, [p.upc, p.name, p.brand, p.category, p.image_url, p.ingredients,
            p.nutriscore_grade, p.nova_group, p.is_organic,
            JSON.stringify(p.allergens_tags), JSON.stringify(p.nutrition_facts)]);
        ok++;
      } catch (e) {
        stats.errors++;
      }
    }
    stats.imported += ok;
    stats.batches++;
  }
}

// ============================================================
// PARSE ROW → PRODUCT
// ============================================================
function parseRow(row) {
  const code = (row.code || '').trim().replace(/[^0-9]/g, '');
  if (!code || code.length < 8) { stats.skipped_no_code++; return null; }

  const name = (row.product_name || '').trim();
  if (!name || name.length < 2) { stats.skipped_no_name++; return null; }

  if (FILTER_US) {
    const countries = (row.countries_tags || row.countries_en || row.countries || '').toLowerCase();
    if (!countries.includes('united-states') && !countries.includes('en:us') && !countries.includes('united states')) {
      stats.skipped_non_us++;
      return null;
    }
  }

  let upc = code;
  if (upc.length < 13) upc = upc.padStart(13, '0');
  if (upc.length > 13) upc = upc.slice(0, 13);

  const brand = (row.brands || '').trim().slice(0, 255) || null;
  const rawCat = (row.categories_tags || row.main_category || '').split(',')[0]?.trim() || '';
  const category = rawCat.replace(/^en:/, '').slice(0, 100) || null;
  const imageUrl = (row.image_url || row.image_front_url || '').trim() || null;
  const ingredients = (row.ingredients_text || row.ingredients_text_en || '').trim() || null;
  
  const grade = (row.nutriscore_grade || '').trim().toLowerCase();
  const nutriscore_grade = ['a','b','c','d','e'].includes(grade) ? grade : null;
  
  const novaStr = (row.nova_group || '').trim();
  const nova_group = ['1','2','3','4'].includes(novaStr) ? parseInt(novaStr) : null;
  
  const labels = (row.labels_tags || row.labels || '').toLowerCase();
  const is_organic = labels.includes('organic') || labels.includes('bio');

  const allergens_tags = (row.allergens_tags || '').split(',').map(a => a.trim()).filter(Boolean);

  const nutrition_facts = {};
  const nmap = {
    'energy-kcal_100g': 'energy_kcal_100g',
    'fat_100g': 'fat_100g', 'saturated-fat_100g': 'saturated_fat_100g',
    'carbohydrates_100g': 'carbohydrates_100g', 'sugars_100g': 'sugars_100g',
    'fiber_100g': 'fiber_100g', 'proteins_100g': 'proteins_100g',
    'sodium_100g': 'sodium_100g', 'salt_100g': 'salt_100g',
  };
  for (const [csv, db] of Object.entries(nmap)) {
    const v = parseFloat(row[csv]);
    if (!isNaN(v) && v >= 0 && v < 10000) nutrition_facts[db] = v;
  }

  return {
    upc, name: name.slice(0, 255), brand, category, image_url: imageUrl,
    ingredients, nutriscore_grade, nova_group, is_organic, allergens_tags, nutrition_facts
  };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║   ICK — BULK OPEN FOOD FACTS IMPORT       ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');

  // DB check
  try {
    const r = await pool.query('SELECT COUNT(*) as c FROM products');
    console.log(`  ✓ DB connected. Current products: ${r.rows[0].c}`);
  } catch (err) {
    console.error('  ✗ DB connection failed:', err.message);
    process.exit(1);
  }

  // Ensure columns exist
  try {
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS swap_discovery_type VARCHAR(50);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS swap_discovered_at TIMESTAMP;
    `);
  } catch (e) {}

  // Download or stream
  console.log('\n  ── Step 1: Get Data ──');
  
  let inputStream;
  
  // Check if file already exists (manual download)
  if (existsSync(LOCAL_FILE) && statSync(LOCAL_FILE).size > 100_000_000) {
    console.log(`  Using existing file (${(statSync(LOCAL_FILE).size / 1e9).toFixed(2)} GB)`);
    inputStream = createReadStream(LOCAL_FILE).pipe(createGunzip());
  } else {
    // Try downloading to disk first
    let useDisk = true;
    try {
      // Check available space in /tmp
      const { execSync } = await import('child_process');
      const dfOut = execSync('df -m /tmp 2>/dev/null').toString();
      const avail = parseInt(dfOut.split('\n')[1]?.split(/\s+/)[3] || '0');
      if (avail < 3000) {
        console.log(`  ⚠ Only ${avail}MB free in /tmp — streaming directly from URL`);
        useDisk = false;
      }
    } catch (e) {
      // Can't check disk — try streaming
      useDisk = false;
    }

    if (useDisk) {
      try {
        await downloadFile(CSV_URL, LOCAL_FILE);
        inputStream = createReadStream(LOCAL_FILE).pipe(createGunzip());
      } catch (err) {
        console.log(`  ⚠ Download failed — falling back to direct stream`);
        useDisk = false;
      }
    }
    
    if (!useDisk) {
      console.log('  Streaming directly from OFF (slower but no disk needed)...');
      inputStream = await new Promise((resolve, reject) => {
        const doReq = (url) => {
          const proto = url.startsWith('https') ? https : http;
          proto.get(url, { 
            headers: { 'User-Agent': 'Ick/2.0 (bulk-import)' },
            timeout: 600000
          }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              doReq(res.headers.location);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }
            resolve(res.pipe(createGunzip()));
          }).on('error', reject);
        };
        doReq(CSV_URL);
      });
    }
  }

  // Import
  console.log('\n  ── Step 2: Import ──');
  console.log(`  Mode: ${FILTER_US ? 'US products only' : 'ALL countries'}`);
  console.log(`  Batch: ${BATCH_SIZE} rows per INSERT`);
  if (MAX_PRODUCTS > 0) console.log(`  Limit: ${MAX_PRODUCTS}`);
  console.log('');

  let headers = null;
  let batch = [];
  let done = false;

  const rl = createInterface({
    input: inputStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (done) break;

    // First line = headers
    if (!headers) {
      headers = line.split('\t').map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
      console.log(`  Found ${headers.length} columns`);
      
      const expected = ['code', 'product_name', 'brands', 'countries_tags'];
      const missing = expected.filter(h => !headers.includes(h));
      if (missing.length > 0) {
        console.warn(`  ⚠ Missing columns: ${missing.join(', ')}`);
        console.log(`  First 15 headers: ${headers.slice(0, 15).join(', ')}`);
      }
      continue;
    }

    stats.total_rows++;

    const row = parseTsvLine(line, headers);
    const product = parseRow(row);
    
    if (product) batch.push(product);

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      batch = [];
    }

    if (stats.total_rows % REPORT_EVERY === 0) {
      const elapsed = (Date.now() - stats.start_time) / 1000;
      const rate = Math.round(stats.total_rows / elapsed);
      process.stdout.write(
        `\r  ${stats.total_rows.toLocaleString()} scanned | ` +
        `${stats.imported.toLocaleString()} imported | ` +
        `${stats.skipped_non_us.toLocaleString()} non-US | ` +
        `${rate}/sec        `
      );
    }

    if (MAX_PRODUCTS > 0 && stats.imported >= MAX_PRODUCTS) {
      console.log(`\n  Reached limit of ${MAX_PRODUCTS}.`);
      done = true;
    }
  }

  // Flush remaining
  if (batch.length > 0) await insertBatch(batch);

  // Final report
  const elapsed = ((Date.now() - stats.start_time) / 1000).toFixed(1);

  console.log('\n');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║            IMPORT COMPLETE                 ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log(`  Rows scanned:    ${stats.total_rows.toLocaleString()}`);
  console.log(`  Imported:        ${stats.imported.toLocaleString()}`);
  console.log(`  Non-US skipped:  ${stats.skipped_non_us.toLocaleString()}`);
  console.log(`  No barcode:      ${stats.skipped_no_code.toLocaleString()}`);
  console.log(`  No name:         ${stats.skipped_no_name.toLocaleString()}`);
  console.log(`  Errors:          ${stats.errors.toLocaleString()}`);
  console.log(`  Time:            ${elapsed}s`);

  const finalCount = await pool.query('SELECT COUNT(*) as c FROM products');
  console.log(`\n  Total products in DB: ${finalCount.rows[0].c.toLocaleString()}`);

  try { if (existsSync(LOCAL_FILE)) { unlinkSync(LOCAL_FILE); console.log('  ✓ Temp file cleaned up'); } } catch(e) {}

  await pool.end();
  console.log('  ✓ Done!\n');
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
