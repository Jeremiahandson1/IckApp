import pool from '../db/init.js';

/**
 * Ick Scoring Engine v2
 * 
 * Aligned with Yuka methodology:
 *   Nutrition:  60%  (Nutri-Score / nutritional data)
 *   Additives:  30%  (harmful ingredient detection)
 *   Organic:    10%  (organic certification bonus)
 *
 * Key rule: if any high-risk additive (severity >= 8) is present,
 * additives_score is capped at 25 — matching Yuka's cap at 49/100.
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
  const result = await pool.query('SELECT * FROM harmful_ingredients');
  _cachedHarmful = result.rows;
  _harmfulCacheTime = now;
  return _cachedHarmful;
}

async function getCompanies() {
  const now = Date.now();
  if (_cachedCompanies && (now - _companyCacheTime) < CACHE_TTL) return _cachedCompanies;
  const result = await pool.query('SELECT * FROM companies');
  _cachedCompanies = result.rows;
  _companyCacheTime = now;
  return _cachedCompanies;
}

// ============================================================
// NUTRI-SCORE
// ============================================================

/** Convert Nutri-Score grade (a-e) to 0-100 */
function nutriscoreGradeToScore(grade) {
  if (!grade) return null;
  const map = { a: 95, b: 75, c: 50, d: 25, e: 10 };
  return map[grade.toLowerCase()] ?? null;
}

/**
 * Compute nutrition score from raw nutrient values (per 100g).
 * Simplified Nutri-Score: negative points for energy/sugar/satfat/sodium,
 * positive points for fiber/protein.
 */
function computeNutritionFromNutrients(nutriments) {
  if (!nutriments) return null;

  const energy = nutriments.energy_kcal_100g ?? nutriments['energy-kcal_100g'] ?? null;
  const sugars = nutriments.sugars_100g ?? null;
  const satFat = nutriments['saturated-fat_100g'] ?? nutriments.saturated_fat_100g ?? null;
  const sodium = nutriments.sodium_100g ?? null;
  const fiber = nutriments.fiber_100g ?? null;
  const protein = nutriments.proteins_100g ?? null;

  // Need at least 3 of the 4 negative components
  let dataPoints = 0;
  if (energy !== null) dataPoints++;
  if (sugars !== null) dataPoints++;
  if (satFat !== null) dataPoints++;
  if (sodium !== null) dataPoints++;
  if (dataPoints < 3) return null;

  // Negative points (each 0-10)
  const energyPts = energy !== null ? Math.min(10, Math.floor(energy / 335)) : 5;
  const sugarPts = sugars !== null ? Math.min(10, Math.floor(sugars / 4.5)) : 5;
  const satFatPts = satFat !== null ? Math.min(10, Math.floor(satFat / 1)) : 5;
  const sodiumPts = sodium !== null ? Math.min(10, Math.floor((sodium * 1000) / 90)) : 5;

  // Positive points (each 0-5)
  const fiberPts = fiber !== null ? Math.min(5, Math.floor(fiber / 0.9)) : 0;
  const proteinPts = protein !== null ? Math.min(5, Math.floor(protein / 1.6)) : 0;

  const negativeTotal = energyPts + sugarPts + satFatPts + sodiumPts; // 0-40
  const positiveTotal = fiberPts + proteinPts; // 0-10
  const rawScore = negativeTotal - positiveTotal; // -10 to 40

  // Map to 0-100 (lower raw = better)
  return Math.max(0, Math.min(100, Math.round(100 - (rawScore + 10) * 2)));
}

/** Adjust nutrition score based on NOVA processing group */
function adjustForNova(nutritionScore, novaGroup) {
  if (!novaGroup || nutritionScore === null) return nutritionScore;
  const adj = { 1: 5, 2: 0, 3: -5, 4: -10 };
  return Math.max(0, Math.min(100, nutritionScore + (adj[novaGroup] ?? 0)));
}

// ============================================================
// ADDITIVE MATCHING
// ============================================================

function matchesIngredient(ingredientsLower, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(ingredientsLower);
}

async function computeAdditivesScore(ingredientsText) {
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

  let score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  // Cap rule: high-risk additive → max 25; medium-risk → max 55
  if (found.some(f => f.severity >= 8)) score = Math.min(score, 25);
  else if (found.some(f => f.severity >= 6)) score = Math.min(score, 55);

  return { score, found };
}

// ============================================================
// ORGANIC & ALLERGENS
// ============================================================

function detectOrganic(labelsArr, isOrganic) {
  if (isOrganic) return 100;
  if (!labelsArr || !Array.isArray(labelsArr)) return 0;
  const kw = ['en:organic', 'en:usda-organic', 'en:eu-organic', 'en:ab-agriculture-biologique', 'fr:bio'];
  for (const label of labelsArr) {
    const lower = (typeof label === 'string') ? label.toLowerCase() : '';
    if (kw.some(k => lower.includes(k))) return 100;
  }
  return 0;
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
// COMPANY MATCHING (for display only)
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
 * @param {string} opts.nutriscore_grade  - a-e from OFF
 * @param {number} opts.nova_group        - 1-4 from OFF
 * @param {Object} opts.nutriments        - Raw nutrient values from OFF
 * @param {Array}  opts.labels            - Label tags from OFF
 * @param {Array}  opts.allergens_tags    - Allergen tags from OFF
 * @param {boolean} opts.is_organic
 */
export async function scoreProduct(opts = {}) {
  const {
    ingredients = '', brand = '', nutriscore_grade = null,
    nova_group = null, nutriments = null, labels = [],
    allergens_tags = [], is_organic = false,
  } = opts;

  const companies = await getCompanies();

  // ── 1. NUTRITION SCORE (60%) ──
  let nutritionScore = nutriscoreGradeToScore(nutriscore_grade);
  if (nutritionScore === null && nutriments) {
    nutritionScore = computeNutritionFromNutrients(nutriments);
  }
  if (nutritionScore === null) nutritionScore = 50;
  nutritionScore = adjustForNova(nutritionScore, nova_group);

  // ── 2. ADDITIVES SCORE (30%) ──
  const { score: additivesScore, found: harmfulFound } = await computeAdditivesScore(ingredients);

  // ── 3. ORGANIC BONUS (10%) ──
  const organicBonus = detectOrganic(labels, is_organic);

  // ── Company (display only) ──
  const company = matchCompany(brand, companies);

  // ── Allergens ──
  const allergens = extractAllergens(allergens_tags);

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
  }

  return {
    // New scoring model
    nutrition_score: nutritionScore,
    additives_score: additivesScore,
    organic_bonus: organicBonus,

    // Legacy columns (backward compat)
    harmful_ingredients_score: additivesScore,
    banned_elsewhere_score: nutritionScore,
    transparency_score: organicBonus,
    processing_score: nova_group ? ({ 1: 95, 2: 75, 3: 50, 4: 25 }[nova_group] ?? 50) : 50,
    company_behavior_score: company?.behavior_score ?? 50,

    // Data
    harmful_ingredients_found: harmfulFound,
    nutrition_facts: nutritionFacts,
    nutriscore_grade: nutriscore_grade || null,
    nova_group: nova_group || null,
    is_organic: organicBonus > 0,
    allergens_tags: allergens,
    company_name: company?.name || null,
    company_controversies: company?.controversies || null,
  };
}

/** Backward-compatible wrapper for old 3-arg call sites */
export async function scoreProductLegacy(ingredients, brand, category) {
  return scoreProduct({ ingredients, brand });
}
