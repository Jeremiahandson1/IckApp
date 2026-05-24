// Add Spanish / French / Portuguese / German / Italian aliases to common
// harmful ingredients so products with non-English ingredient data score
// correctly. Before this fix, Open Food Facts records sourced from
// non-English regions (e.g. Doritos Nacho Cheese with "colorante rojo 40,
// colorante amarillo 5, ...") matched zero entries in our harmful_ingredients
// table and scored as falsely clean (Harmful 100, Banned-Elsewhere 100).
//
// Strategy: UPDATE the existing JSONB aliases column for each named
// ingredient by merging in additional language variants. Idempotent —
// duplicates are deduped on insert.
//
// Run with:
//   npm run db:add-multilingual-aliases
// then either wait 5 min for the in-memory cache to expire, or restart the
// backend so the next /scan re-fetches the new alias list.

import 'dotenv/config';
import pg from 'pg';

if (!process.env.NODE_ENV && process.env.DATABASE_URL?.includes('render.com')) {
  process.env.NODE_ENV = 'production';
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

// Multilingual aliases for the most-commonly-encountered harmful additives.
// Keyed by the canonical English `name` column in harmful_ingredients.
const ADDITIONS = {
  'Red 40': [
    'rojo 40', 'rojo allura', 'rojo allura ac', 'colorante rojo 40',
    'rouge allura ac', 'rouge 40', 'rouge allura',
    'vermelho 40', 'vermelho allura',
    'allurarot ac', 'rot 40',
    'rosso allura ac', 'rosso 40',
  ],
  'Yellow 5': [
    'amarillo 5', 'tartrazina', 'colorante amarillo 5',
    'jaune 5',
    'amarelo 5',
    'tartrazin', 'gelb 5',
    'giallo 5',
  ],
  'Yellow 6': [
    'amarillo 6', 'amarillo ocaso', 'amarillo crepúsculo', 'colorante amarillo 6',
    'jaune orange S', 'jaune 6',
    'amarelo 6', 'amarelo crepúsculo',
    'gelborange S', 'gelb 6',
    'giallo tramonto', 'giallo 6',
  ],
  'Blue 1': [
    'azul 1', 'azul brillante FCF', 'colorante azul 1',
    'bleu brillant FCF', 'bleu 1',
    'azul brilhante FCF',
    'brillantblau FCF', 'blau 1',
    'blu brillante FCF', 'blu 1',
  ],
  'Blue 2': [
    'azul 2', 'indigotina',
    'indigotine', 'bleu 2',
    'indigotina',
  ],
  'High Fructose Corn Syrup': [
    'jarabe de maíz de alta fructosa', 'jarabe de maíz alto en fructosa', 'jarabe de glucosa-fructosa',
    'sirop de maïs à haute teneur en fructose', 'sirop de glucose-fructose',
    'xarope de milho de alta frutose',
    'Glukose-Fructose-Sirup',
    'sciroppo di mais ad alto fruttosio',
  ],
  'Aspartame': [
    'aspartamo',
    'aspartam',
  ],
  'Sucralose': [
    'sucralosa',
  ],
  'Sodium Nitrite': [
    'nitrito de sodio',
    'nitrite de sodium',
    'nitrito de sódio',
    'Natriumnitrit',
    'nitrito di sodio',
  ],
  'BHA': [
    'butilhidroxianisol',
    'butylhydroxyanisole',
    'idrossianisolo butilato',
  ],
  'BHT': [
    'butilhidroxitolueno',
    'butylhydroxytoluène',
    'idrossitoluene butilato',
  ],
  'TBHQ': [
    'butilhidroquinona terciaria', 'TBHQ',
    'butylhydroquinone tertiaire',
  ],
  'Potassium Bromate': [
    'bromato de potasio',
    'bromate de potassium',
    'bromato de potássio',
    'Kaliumbromat',
  ],
  'Azodicarbonamide': [
    'azodicarbonamida',
    'azodicarbonamide',
  ],
  'Carrageenan': [
    'carragenina', 'carragenano',
    'carraghénane', 'carraghénine',
    'carragenina',
    'Carrageen',
    'carragenina',
  ],
  'Propyl Paraben': [
    'propilparabeno', 'parabeno de propilo',
    'propylparabène',
  ],
  'Titanium Dioxide': [
    'dióxido de titanio',
    'dioxyde de titane',
    'dióxido de titânio',
    'Titandioxid',
    'biossido di titanio',
  ],
  'Sodium Benzoate': [
    'benzoato de sodio',
    'benzoate de sodium',
    'benzoato de sódio',
    'Natriumbenzoat',
    'benzoato di sodio',
  ],
  'MSG': [
    'glutamato monosódico', 'glutamato de sodio',
    'glutamate monosodique',
    'glutamato monossódico',
    'Mononatriumglutamat',
    'glutammato monosodico',
  ],
  'Artificial Vanilla': [
    'vainilla artificial', 'vainillina',
    'vanille artificielle', 'vanilline',
    'baunilha artificial', 'vanilina',
  ],
};

async function main() {
  console.log('Adding multilingual aliases to harmful_ingredients...\n');

  let updated = 0;
  let skipped = 0;
  let aliasesAdded = 0;

  for (const [name, additions] of Object.entries(ADDITIONS)) {
    // Fetch existing aliases
    const { rows } = await pool.query(
      `SELECT id, aliases FROM harmful_ingredients WHERE name = $1`,
      [name]
    );
    if (rows.length === 0) {
      console.log(`  ✗ '${name}' not found in DB, skipping`);
      skipped++;
      continue;
    }
    const existing = rows[0].aliases ?
      (typeof rows[0].aliases === 'string' ? JSON.parse(rows[0].aliases) : rows[0].aliases) :
      [];

    // Merge dedupe, case-insensitive
    const existingLower = new Set(existing.map(a => a.toLowerCase()));
    const newOnes = additions.filter(a => !existingLower.has(a.toLowerCase()));
    if (newOnes.length === 0) {
      console.log(`  - '${name}' already has all aliases`);
      continue;
    }

    const merged = [...existing, ...newOnes];
    await pool.query(
      `UPDATE harmful_ingredients SET aliases = $1::jsonb WHERE id = $2`,
      [JSON.stringify(merged), rows[0].id]
    );
    console.log(`  ✓ '${name}' +${newOnes.length} aliases (now ${merged.length})`);
    updated++;
    aliasesAdded += newOnes.length;
  }

  console.log(`\nDone. ${updated} ingredients updated, ${aliasesAdded} new aliases added, ${skipped} skipped.`);
  console.log('\nThe in-memory cache in scoring.js has a 5-minute TTL. Either wait,');
  console.log('restart the backend, or any product re-scored after expiry picks them up.');
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
