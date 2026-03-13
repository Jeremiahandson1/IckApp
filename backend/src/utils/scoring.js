import pool from '../db/init.js';

/**
 * Ick Scoring Engine — 5-Dimension Model
 *
 * | Dimension             | Weight | Column                     |
 * |-----------------------|--------|----------------------------|
 * | Harmful Ingredients   | 40%    | harmful_ingredients_score  |
 * | Banned Elsewhere      | 20%    | banned_elsewhere_score     |
 * | Transparency          | 15%    | transparency_score         |
 * | Processing            | 15%    | processing_score           |
 * | Company Behavior      | 10%    | company_behavior_score     |
 *
 * total_score = weighted sum of the 5 above (computed column in DB).
 * Nutri-Score and NOVA are stored for display only — they do NOT drive total_score.
 */

// ============================================================
// CACHES
// ============================================================

let _cachedHarmful = null;
let _cachedCompanies = null;
let _harmfulCacheTime = 0;
let _companyCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getHarmfulIngredients() {
  const now = Date.now();
  if (_cachedHarmful && (now - _harmfulCacheTime) < CACHE_TTL) return _cachedHarmful;
  const result = await pool.query('SELECT name, aliases, severity, category, health_effects, banned_in, why_used, source_url FROM harmful_ingredients');
  _cachedHarmful = result.rows;
  _harmfulCacheTime = now;
  return _cachedHarmful;
}

async function getCompanies() {
  const now = Date.now();
  if (_cachedCompanies && (now - _companyCacheTime) < CACHE_TTL) return _cachedCompanies;
  const result = await pool.query('SELECT name, parent_company, behavior_score, controversies, transparency_rating FROM companies');
  _cachedCompanies = result.rows;
  _companyCacheTime = now;
  return _cachedCompanies;
}

// ============================================================
// SHARED HELPERS
// ============================================================

function matchesIngredient(ingredientsLower, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(ingredientsLower);
}

function clamp(val) {
  return Math.max(0, Math.min(100, Math.round(val)));
}

// ============================================================
// DIMENSION 1: HARMFUL INGREDIENTS (40%)
// ============================================================

async function computeHarmfulIngredientsScore(ingredientsText) {
  if (!ingredientsText || ingredientsText.length < 3) {
    return { score: 75, found: [] };
  }

  const ingredientsLower = ingredientsText.toLowerCase();
  const harmfulList = await getHarmfulIngredients();
  const found = [];

  for (const h of harmfulList) {
    const names = [h.name];
    if (h.aliases) {
      const aliases = typeof h.aliases === 'string' ? JSON.parse(h.aliases) : h.aliases;
      names.push(...aliases);
    }

    for (const name of names) {
      if (matchesIngredient(ingredientsLower, name)) {
        found.push({
          name: h.name,
          severity: h.severity,
          category: h.category,
          health_effects: h.health_effects,
          why_used: h.why_used,
          source_url: h.source_url || null,
          banned_in: typeof h.banned_in === 'string' ? JSON.parse(h.banned_in) : (h.banned_in || [])
        });
        break;
      }
    }
  }

  if (found.length === 0) return { score: 100, found: [] };

  // Severity-weighted penalty with diminishing returns
  const sortedFound = [...found].sort((a, b) => b.severity - a.severity);
  let penalty = 0;
  sortedFound.forEach((f, i) => {
    penalty += f.severity * 4 * (1 / (1 + i * 0.3));
  });

  let score = clamp(100 - penalty);

  // Cap rule: high-risk additive → max 25; medium-risk → max 55
  if (found.some(f => f.severity >= 8)) score = Math.min(score, 25);
  else if (found.some(f => f.severity >= 6)) score = Math.min(score, 55);

  return { score, found };
}

// ============================================================
// DIMENSION 2: BANNED ELSEWHERE (20%)
// ============================================================

function computeBannedElsewhereScore(harmfulFound) {
  if (!harmfulFound || harmfulFound.length === 0) return 100;

  const bannedIngredients = harmfulFound.filter(h => {
    const bans = Array.isArray(h.banned_in) ? h.banned_in : [];
    return bans.length > 0;
  });

  if (bannedIngredients.length === 0) return 100;

  // Each banned ingredient deducts points based on how many countries banned it
  let penalty = 0;
  for (const h of bannedIngredients) {
    const banCount = h.banned_in.length;
    // More bans = worse. 1 ban = -10, 2 = -18, 3+ = -25 per ingredient
    const ingredientPenalty = banCount >= 3 ? 25 : banCount >= 2 ? 18 : 10;
    // Scale by severity
    penalty += ingredientPenalty * (h.severity / 10);
  }

  return clamp(100 - penalty);
}

// ============================================================
// DIMENSION 3: TRANSPARENCY (15%)
// ============================================================

function computeTransparencyScore(opts) {
  const { ingredients, nutriments, allergens_tags, image_url, brand, nutriscore_grade } = opts;
  let score = 0;

  // Has ingredients listed? (+35)
  if (ingredients && ingredients.length > 10) score += 35;
  else if (ingredients && ingredients.length > 0) score += 15;

  // Has nutrition data? (+30)
  if (nutriments) {
    let nutrientCount = 0;
    const n = nutriments;
    if (n.energy_kcal_100g != null || n['energy-kcal_100g'] != null) nutrientCount++;
    if (n.fat_100g != null) nutrientCount++;
    if (n['saturated-fat_100g'] != null || n.saturated_fat_100g != null) nutrientCount++;
    if (n.sugars_100g != null) nutrientCount++;
    if (n.fiber_100g != null) nutrientCount++;
    if (n.proteins_100g != null) nutrientCount++;
    if (n.sodium_100g != null) nutrientCount++;

    if (nutrientCount >= 5) score += 30;
    else if (nutrientCount >= 3) score += 20;
    else if (nutrientCount >= 1) score += 10;
  }

  // Has allergen data? (+10)
  if (allergens_tags && allergens_tags.length > 0) score += 10;

  // Has image? (+10)
  if (image_url) score += 10;

  // Has brand? (+5)
  if (brand && brand !== 'Unknown Brand' && brand !== 'Unknown') score += 5;

  // Has Nutri-Score grade? (+10)
  if (nutriscore_grade) score += 10;

  return clamp(score);
}

// ============================================================
// DIMENSION 4: PROCESSING (15%)
// ============================================================

function computeProcessingScore(opts) {
  const { nova_group, ingredients } = opts;
  const nova = Number(nova_group);

  // If we have NOVA group, use it as a starting point
  if (nova >= 1 && nova <= 4) {
    const novaScores = { 1: 95, 2: 75, 3: 45, 4: 15 };
    let score = novaScores[nova] ?? 50;

    if (ingredients) {
      const il = ingredients.toLowerCase();
      const ultraMarkers = [
        'high fructose corn syrup', 'hydrogenated', 'partially hydrogenated',
        'modified starch', 'maltodextrin', 'dextrose', 'artificial flavor',
        'artificial colour', 'artificial color', 'sodium benzoate',
        'potassium sorbate', 'polysorbate', 'carrageenan',
        'sodium nitrite', 'sodium nitrate', 'tbhq', 'bht', 'bha',
      ];
      const markerCount = ultraMarkers.filter(m => il.includes(m)).length;

      // Fine-tune within NOVA 4 based on ingredients
      if (nova === 4) {
        if (markerCount >= 4) score = 5;
        else if (markerCount >= 2) score = 10;
      }

      // Override NOVA 3 ("processed") when ingredients are actually simple.
      // OFF classifies things like "chickpeas, sea salt" as NOVA 3 just because
      // salt was added, but these are minimally processed whole foods.
      if (nova === 3 && markerCount === 0) {
        const commaCount = (ingredients.match(/,/g) || []).length;
        if (commaCount <= 5) score = 75;       // few simple ingredients → treat as NOVA 2
        else if (commaCount <= 10) score = 60;  // moderate but still no ultra markers
      }
    }

    return clamp(score);
  }

  // No NOVA group — estimate from ingredients
  if (!ingredients || ingredients.length < 3) return 50;

  const il = ingredients.toLowerCase();
  const ultraMarkers = [
    'high fructose corn syrup', 'hydrogenated', 'partially hydrogenated',
    'modified starch', 'maltodextrin', 'dextrose', 'artificial flavor',
    'artificial colour', 'artificial color', 'sodium benzoate',
    'potassium sorbate', 'polysorbate', 'carrageenan',
    'sodium nitrite', 'sodium nitrate', 'tbhq', 'bht', 'bha',
    'mono and diglycerides', 'soy lecithin', 'xanthan gum',
    'cellulose', 'propylene glycol',
  ];

  const markerCount = ultraMarkers.filter(m => il.includes(m)).length;

  if (markerCount >= 5) return 10;
  if (markerCount >= 3) return 25;
  if (markerCount >= 2) return 40;
  if (markerCount >= 1) return 55;

  // Count total ingredient count as a proxy
  const commaCount = (ingredients.match(/,/g) || []).length;
  if (commaCount > 20) return 35;
  if (commaCount > 12) return 55;
  if (commaCount > 5) return 70;
  return 85;
}

// ============================================================
// DIMENSION 5: COMPANY BEHAVIOR (10%)
// ============================================================

function computeCompanyBehaviorScore(brand, companies) {
  const company = matchCompany(brand, companies);
  if (!company) return 50; // Unknown company = neutral

  // Use the behavior_score from the companies table (0-100)
  if (company.behavior_score != null) {
    return clamp(company.behavior_score);
  }

  // If no behavior_score, check controversies
  if (company.controversies) {
    const controversies = typeof company.controversies === 'string'
      ? company.controversies : JSON.stringify(company.controversies);
    if (controversies.length > 200) return 25;
    if (controversies.length > 50) return 40;
  }

  return 50;
}

// ============================================================
// DISPLAY-ONLY: Nutri-Score, NOVA, Organic, Allergens, Nutrition Facts
// ============================================================

/** Convert Nutri-Score grade (a-e) to 0-100 — for display only */
function nutriscoreGradeToScore(grade) {
  if (!grade) return null;
  const map = { a: 95, b: 75, c: 50, d: 25, e: 10 };
  return map[grade.toLowerCase()] ?? null;
}

function detectOrganic(labelsArr, isOrganic) {
  if (isOrganic) return true;
  if (!labelsArr || !Array.isArray(labelsArr)) return false;
  const kw = ['en:organic', 'en:usda-organic', 'en:eu-organic', 'en:ab-agriculture-biologique', 'fr:bio'];
  for (const label of labelsArr) {
    const lower = (typeof label === 'string') ? label.toLowerCase() : '';
    if (kw.some(k => lower.includes(k))) return true;
  }
  return false;
}

function extractAllergens(allergenTags) {
  if (!allergenTags || !Array.isArray(allergenTags)) return [];
  const map = {
    'en:gluten': 'Gluten', 'en:milk': 'Milk', 'en:eggs': 'Eggs',
    'en:fish': 'Fish', 'en:crustaceans': 'Shellfish', 'en:soybeans': 'Soy',
    'en:peanuts': 'Peanuts', 'en:nuts': 'Tree Nuts', 'en:celery': 'Celery',
    'en:mustard': 'Mustard', 'en:sesame-seeds': 'Sesame', 'en:lupin': 'Lupin',
    'en:molluscs': 'Mollusks', 'en:sulphur-dioxide-and-sulphites': 'Sulfites',
    'en:wheat': 'Wheat',
  };
  const result = [];
  for (const tag of allergenTags) {
    const lower = typeof tag === 'string' ? tag.toLowerCase() : '';
    if (map[lower]) result.push(map[lower]);
    else if (lower.startsWith('en:')) {
      result.push(lower.replace('en:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    }
  }
  return [...new Set(result)];
}

// ============================================================
// COMPANY MATCHING
// ============================================================

function matchCompany(brand, companies) {
  if (!brand) return null;
  const brandLower = brand.toLowerCase().split(',')[0].trim();
  let m = companies.find(c => c.name.toLowerCase() === brandLower);
  if (m) return m;
  m = companies.find(c => {
    const cl = c.name.toLowerCase();
    return brandLower.includes(cl) || cl.includes(brandLower);
  });
  if (m) return m;
  m = companies.find(c => {
    if (!c.parent_company) return false;
    const pl = c.parent_company.toLowerCase();
    return brandLower.includes(pl) || pl.includes(brandLower);
  });
  return m || null;
}

// ============================================================
// MAIN SCORING FUNCTION
// ============================================================

/**
 * @param {Object} opts
 * @param {string} opts.ingredients
 * @param {string} opts.brand
 * @param {string} opts.nutriscore_grade  - a-e from OFF (display only)
 * @param {number} opts.nova_group        - 1-4 from OFF
 * @param {Object} opts.nutriments        - Raw nutrient values from OFF
 * @param {Array}  opts.labels            - Label tags from OFF
 * @param {Array}  opts.allergens_tags    - Allergen tags from OFF
 * @param {boolean} opts.is_organic
 * @param {string} opts.image_url
 */
export async function scoreProduct(opts = {}) {
  const {
    ingredients = '', brand = '', nutriscore_grade = null,
    nova_group = null, nutriments = null, labels = [],
    allergens_tags = [], is_organic = false, image_url = null,
  } = opts;

  const companies = await getCompanies();

  // ── DIMENSION 1: Harmful Ingredients (40%) ──
  const { score: harmfulIngredientsScore, found: harmfulFound } =
    await computeHarmfulIngredientsScore(ingredients);

  // ── DIMENSION 2: Banned Elsewhere (20%) ──
  const bannedElsewhereScore = computeBannedElsewhereScore(harmfulFound);

  // ── DIMENSION 3: Transparency (15%) ──
  const transparencyScore = computeTransparencyScore({
    ingredients, nutriments, allergens_tags, image_url, brand, nutriscore_grade,
  });

  // ── DIMENSION 4: Processing (15%) ──
  const processingScore = computeProcessingScore({ nova_group, ingredients });

  // ── DIMENSION 5: Company Behavior (10%) ──
  const companyBehaviorScore = computeCompanyBehaviorScore(brand, companies);

  // ── Display-only data ──
  const company = matchCompany(brand, companies);
  const allergens = extractAllergens(allergens_tags);
  const isOrganic = detectOrganic(labels, is_organic);

  // ── Nutrition facts for display ──
  const nutritionFacts = {};
  if (nutriments) {
    const n = nutriments;
    const kcal = n.energy_kcal_100g ?? n['energy-kcal_100g'];
    if (kcal != null) nutritionFacts.calories = Math.round(kcal);
    if (n.fat_100g != null) nutritionFacts.fat = Math.round(n.fat_100g * 10) / 10;
    const sf = n['saturated-fat_100g'] ?? n.saturated_fat_100g;
    if (sf != null) nutritionFacts.saturated_fat = Math.round(sf * 10) / 10;
    if (n.carbohydrates_100g != null) nutritionFacts.carbs = Math.round(n.carbohydrates_100g * 10) / 10;
    if (n.sugars_100g != null) nutritionFacts.sugars = Math.round(n.sugars_100g * 10) / 10;
    if (n.fiber_100g != null) nutritionFacts.fiber = Math.round(n.fiber_100g * 10) / 10;
    if (n.proteins_100g != null) nutritionFacts.protein = Math.round(n.proteins_100g * 10) / 10;
    if (n.sodium_100g != null) nutritionFacts.sodium = Math.round(n.sodium_100g * 1000);
    if (n.salt_100g != null) nutritionFacts.salt = Math.round(n.salt_100g * 10) / 10;
    const tf = n['trans-fat_100g'] ?? n.trans_fat_100g;
    if (tf != null) nutritionFacts.trans_fat = Math.round(tf * 10) / 10;
    if (n.potassium_100g != null) nutritionFacts.potassium = Math.round(n.potassium_100g);
    if (n.added_sugars_100g != null) nutritionFacts.added_sugars = Math.round(n.added_sugars_100g * 10) / 10;
  }

  return {
    // 5-dimension scores (these drive total_score via DB generated column)
    harmful_ingredients_score: harmfulIngredientsScore,
    banned_elsewhere_score: bannedElsewhereScore,
    transparency_score: transparencyScore,
    processing_score: processingScore,
    company_behavior_score: companyBehaviorScore,

    // Data
    harmful_ingredients_found: harmfulFound,
    nutrition_facts: nutritionFacts,
    nutriscore_grade: nutriscore_grade || null,
    nova_group: nova_group || null,
    is_organic: isOrganic,
    allergens_tags: allergens,
    company_name: company?.name || null,
    company_controversies: company?.controversies || null,
  };
}
