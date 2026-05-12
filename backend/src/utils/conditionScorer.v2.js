/**
 * Condition Scorer v2 — guideline-grounded health-condition scoring
 *
 * Every rule traces to a published clinical guideline. Per-100g nutrient
 * normalization. Sub-type / stage aware where the underlying guidelines
 * differ by stage (kidney) or sub-diagnosis (thyroid).
 *
 * NOT MEDICAL ADVICE. Informational only. Rules reflect general dietary
 * guidance from professional societies; they do not account for individual
 * medications, comorbidities, labs, or clinical context. Users should
 * defer to their physician, endocrinologist, nephrologist, or registered
 * dietitian for condition-specific guidance.
 *
 * Sources referenced inline by short tag — full citations at bottom of file.
 */

// Rules version is checked against cached scores in product_condition_scores.
// Bump on any change to the rule set so old cached rows expire.
//
//   2.0.0 — initial v2 release
//   2.1.0 — added mixed-evidence Hashimoto/Hypo rules + capped condition
//           scores at the product's general score
export const RULES_VERSION = '2.1.0';

export const DISCLAIMER =
  'Informational only — not medical advice. Consult your clinician or registered dietitian for condition-specific dietary guidance.';

// ────────────────────────────────────────────────────────────────────────────
// Ingredient text utilities
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalize ingredient text for matching: lowercase, collapse whitespace,
 * strip percentage suffixes and parenthetical-only annotations that confuse
 * word-boundary regex. Keep commas/semicolons as token separators.
 */
function normalizeText(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/\([^()]*%[^()]*\)/g, ' ') // drop "(2%)" annotations
    .replace(/[_*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escape regex metacharacters. */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word (token-aware) match. Allows hyphens and spaces inside the
 * candidate term. Treats word boundaries on either side to avoid matches
 * like "soy" inside "soybean" (but we explicitly include "soybean" as an
 * alias when it matters).
 */
function hasIngredient(text, term) {
  if (!text || !term) return false;
  const escaped = escapeRegex(term);
  // word boundary, allowing the term itself to contain spaces/hyphens
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
}

function hasAny(text, terms) {
  return terms.some((t) => hasIngredient(text, t));
}

function firstMatch(text, terms) {
  return terms.find((t) => hasIngredient(text, t)) || null;
}

// ────────────────────────────────────────────────────────────────────────────
// Nutrient normalization
//
// Our DB stores nutrition_facts in two slightly different shapes depending on
// the source path:
//   - OFF flow (scoring.js):  `sodium`, `saturated_fat`, ... in mg / g per 100g
//   - USDA flow (usda.js):    `sodium_100g`, `saturated_fat_100g`, ...
//
// We unify here so each scorer reads a single canonical shape.
// All units: g per 100g for macros, mg per 100g for sodium/potassium.
// ────────────────────────────────────────────────────────────────────────────

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pick(nf, ...keys) {
  for (const k of keys) {
    const v = num(nf[k]);
    if (v != null) return v;
  }
  return null;
}

/**
 * Return canonical per-100g nutrient object. Any field may be null if the
 * underlying product is missing that data point. Scorers must handle nulls.
 */
function readPer100g(nfRaw) {
  let nf = nfRaw || {};
  if (typeof nf === 'string') {
    try { nf = JSON.parse(nf); } catch { nf = {}; }
  }
  return {
    energy_kcal: pick(nf, 'calories', 'energy_kcal_100g'),
    fat_g: pick(nf, 'fat', 'fat_100g'),
    saturated_fat_g: pick(nf, 'saturated_fat', 'saturated_fat_100g'),
    trans_fat_g: pick(nf, 'trans_fat', 'trans_fat_100g'),
    carbs_g: pick(nf, 'carbs', 'carbohydrates', 'carbohydrates_100g'),
    sugars_g: pick(nf, 'sugars', 'sugars_100g'),
    added_sugars_g: pick(nf, 'added_sugars', 'added_sugars_100g'),
    fiber_g: pick(nf, 'fiber', 'fiber_100g'),
    protein_g: pick(nf, 'protein', 'proteins', 'proteins_100g'),
    sodium_mg: pick(nf, 'sodium', 'sodium_100g'),
    potassium_mg: pick(nf, 'potassium', 'potassium_100g'),
  };
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ────────────────────────────────────────────────────────────────────────────
// Citation registry (short tag → full reference)
// ────────────────────────────────────────────────────────────────────────────

const SOURCES = {
  CDF: 'Celiac Disease Foundation — Sources of Gluten',
  FDA_GF: 'FDA 21 CFR §101.91 — Gluten-Free Labeling Final Rule (2013)',
  AHA_2021: 'AHA 2021 Dietary Guidance to Improve Cardiovascular Health',
  AHA_TRANS: 'AHA 2017 Presidential Advisory — Dietary Fats and CVD',
  AHA_SUGAR: 'AHA 2016 Scientific Statement — Added Sugars and CVD',
  FSA_TRAFFIC: 'UK FSA Front-of-Pack Traffic-Light Nutritional Labelling',
  IARC_MEAT: 'IARC Monograph 114 — Red and Processed Meat (2018)',
  ADA_2024: 'ADA Standards of Care in Diabetes — 2024',
  ADA_NUTRITION: 'ADA/AACE Nutrition Therapy Consensus 2019',
  KDOQI_2020: 'KDOQI 2020 Clinical Practice Guideline for Nutrition in CKD',
  NKF_PHOS: 'National Kidney Foundation — Phosphorus Additives in Food',
  AUA_STONES: 'AUA/EAU Medical Management of Kidney Stones (2014)',
  ATA_HYPO: 'ATA Guidelines for Treatment of Hypothyroidism (2014)',
  ATA_HYPER: 'ATA Guidelines for Hyperthyroidism and Other Causes of Thyrotoxicosis (2016)',
  AACE_THYROID: 'AACE/ACE Clinical Practice Guidelines for Hypothyroidism (2012)',
  // Mixed-evidence sources — used for rules with biological mechanism + clinical
  // signal but without a major society guideline endorsement. Flagged on
  // returned objects with `evidence: 'mixed'` so the UI can distinguish them.
  NIH_SELENIUM: 'NIH ODS — Selenium and thyroid function (Antioxid Redox Signal 2012; Thyroid Res 2017)',
  AUTOIMMUNE_DIET: 'Reviews on dietary patterns in autoimmune thyroiditis — anti-inflammatory pattern, omega-3, ultra-processed food (Endocrine 2020; Front Endocrinol 2021)',
  GLUTEN_HASHIMOTO: 'Mixed evidence for gluten-free trials in Hashimoto\'s — Krysiak et al. Exp Clin Endocrinol Diabetes 2019; small RCTs only, no society endorsement',
};

// ────────────────────────────────────────────────────────────────────────────
// CELIAC — guideline: FDA GF Final Rule + Celiac Disease Foundation
//
// The clinical truth is binary: gluten in any quantity is unsafe for celiac
// disease (FDA GF claim requires <20 ppm). We model "score" as a confidence
// of safety: 0 = definitely contains gluten, 100 = certified GF or no
// gluten-containing ingredient detected.
// ────────────────────────────────────────────────────────────────────────────

// Wheat and wheat relatives (all contain gluten)
const WHEAT_TERMS = [
  'wheat', 'wheat flour', 'whole wheat', 'whole-wheat', 'wheat starch',
  'wheat germ', 'wheat bran', 'wheat protein', 'hydrolyzed wheat protein',
  'durum', 'durum wheat', 'semolina', 'spelt', 'kamut', 'einkorn', 'emmer',
  'farina', 'farro', 'graham flour', 'graham', 'khorasan', 'bulgur', 'couscous',
  'seitan', 'matzo', 'matzoh', 'fu',
];

const BARLEY_TERMS = [
  'barley', 'barley flour', 'barley malt', 'barley malt extract',
  'malted barley', 'malt extract', 'malt syrup', 'malt flavoring',
  'malt flavour', 'malt vinegar',
];
// Note: "malt" alone is almost always barley-derived in food labeling.

const RYE_TERMS = ['rye', 'rye flour', 'rye bread'];

const TRITICALE_TERMS = ['triticale'];

// Other commonly gluten-containing in standard food supply
const OTHER_GLUTEN = [
  "brewer's yeast", 'brewers yeast', // typically barley-derived unless specified
  'hydrolyzed wheat protein',
];

// Cross-contamination risk: oats unless explicitly GF
const OAT_TERMS = ['oats', 'oat flour', 'rolled oats', 'oat bran', 'oatmeal'];

// Ambiguous — may or may not contain gluten depending on source
const AMBIGUOUS_TERMS = [
  'modified food starch', // US labels must declare wheat if source; outside US ambiguous
  'natural flavors', 'natural flavorings', 'natural flavor', 'natural flavour',
  'hydrolyzed vegetable protein',
  'dextrin', // may be wheat-derived
];

const GF_CERTIFIED_TERMS = [
  'certified gluten-free', 'certified gluten free', 'gluten-free certified',
  'gfco certified', 'gluten-free oats', 'gluten free oats',
];

function scoreCeliac(ingredients, _nutrients) {
  let score = 100;
  const flags = [];
  const text = ingredients;

  if (!text) {
    return {
      score: null,
      data_quality: 'missing_ingredients',
      flags: [{
        severity: 'info',
        reason: 'Ingredients list unavailable — cannot verify gluten content',
        source: SOURCES.CDF,
      }],
    };
  }

  // ── Definitive gluten sources — any match floors the score ──
  const wheat = firstMatch(text, WHEAT_TERMS);
  if (wheat) {
    flags.push({
      ingredient: wheat, severity: 'avoid',
      reason: 'Contains wheat — not safe for celiac disease (FDA GF threshold <20 ppm)',
      source: SOURCES.FDA_GF,
    });
    score = 0;
  }

  const barley = firstMatch(text, BARLEY_TERMS);
  if (barley) {
    flags.push({
      ingredient: barley, severity: 'avoid',
      reason: 'Contains barley/malt — not safe for celiac disease',
      source: SOURCES.CDF,
    });
    score = 0;
  }

  const rye = firstMatch(text, RYE_TERMS);
  if (rye) {
    flags.push({
      ingredient: rye, severity: 'avoid',
      reason: 'Contains rye — not safe for celiac disease',
      source: SOURCES.CDF,
    });
    score = 0;
  }

  const triticale = firstMatch(text, TRITICALE_TERMS);
  if (triticale) {
    flags.push({
      ingredient: triticale, severity: 'avoid',
      reason: 'Contains triticale (wheat-rye hybrid) — not safe for celiac',
      source: SOURCES.CDF,
    });
    score = 0;
  }

  const other = firstMatch(text, OTHER_GLUTEN);
  if (other) {
    flags.push({
      ingredient: other, severity: 'avoid',
      reason: 'Typically gluten-containing source — not safe unless source is specified gluten-free',
      source: SOURCES.CDF,
    });
    score = 0;
  }

  // ── Cross-contamination risk: oats ──
  if (score > 0 && hasAny(text, OAT_TERMS)) {
    const certifiedGfOats =
      hasIngredient(text, 'gluten-free oats') ||
      hasIngredient(text, 'gluten free oats') ||
      hasIngredient(text, 'certified gluten-free');
    if (!certifiedGfOats) {
      score -= 20;
      flags.push({
        ingredient: 'oats', severity: 'warn',
        reason: 'Conventional oats commonly cross-contaminated with gluten during processing — choose certified gluten-free oats',
        source: SOURCES.CDF,
      });
    }
  }

  // ── Ambiguous-source ingredients ──
  if (score > 0) {
    const ambig = firstMatch(text, AMBIGUOUS_TERMS);
    if (ambig) {
      score -= 10;
      flags.push({
        ingredient: ambig, severity: 'warn',
        reason: 'Source may be gluten-containing — verify with manufacturer or look for gluten-free certification',
        source: SOURCES.CDF,
      });
    }
  }

  // ── Certified GF bonus ──
  if (hasAny(text, GF_CERTIFIED_TERMS)) {
    if (score > 0) {
      score = 100;
      flags.push({
        ingredient: 'certified gluten-free', severity: 'good',
        reason: 'Carries gluten-free certification (<20 ppm gluten verified)',
        source: SOURCES.FDA_GF,
      });
    }
  }

  return { score: clamp(score), flags };
}

// ────────────────────────────────────────────────────────────────────────────
// HEART — guideline: AHA 2021 Dietary Guidance
//
// Anchored to AHA macronutrient targets translated to per-100g UK FSA
// "traffic light" tiers (the validated per-100g threshold system used on
// food labels). AHA recommends:
//   - Trans fat: avoid
//   - Saturated fat: <6% of daily calories (~13 g/day for 2,000 kcal)
//   - Sodium: <2,300 mg/day, ideal <1,500 mg/day
//   - Added sugar: <25 g/day (women), <36 g/day (men)
// ────────────────────────────────────────────────────────────────────────────

const PROCESSED_MEAT_TERMS = [
  'bologna', 'salami', 'pepperoni', 'pastrami', 'mortadella', 'prosciutto',
  'bacon', 'sausage', 'frankfurter', 'hot dog', 'hotdog', 'ham',
  'corned beef', 'deli meat', 'lunch meat', 'chorizo',
];

const OMEGA3_TERMS = [
  'fish oil', 'salmon', 'anchovy', 'anchovies', 'mackerel', 'sardine',
  'sardines', 'herring', 'flaxseed', 'flax seed', 'flaxseed oil',
  'chia seed', 'chia seeds', 'walnut', 'walnuts',
];

const SOLUBLE_FIBER_TERMS = ['oats', 'oat bran', 'oatmeal', 'psyllium', 'beta-glucan'];

const WHOLE_GRAIN_TERMS = [
  'whole grain', 'whole-grain', 'whole wheat', 'whole-wheat',
  'whole oats', 'brown rice', 'quinoa', 'bulgur', 'whole rye',
];

const TRANS_FAT_INGREDIENT = ['partially hydrogenated'];

function scoreHeart(ingredients, n) {
  let score = 100;
  const flags = [];
  const text = ingredients;

  // ── Trans fat (any) — strongest single penalty ──
  if (n.trans_fat_g != null && n.trans_fat_g > 0) {
    score -= 30;
    flags.push({
      nutrient: `trans fat: ${n.trans_fat_g}g/100g`, severity: 'avoid',
      reason: 'Trans fats directly raise LDL cholesterol and lower HDL — no safe level',
      source: SOURCES.AHA_TRANS,
    });
  } else if (text && hasAny(text, TRANS_FAT_INGREDIENT)) {
    score -= 30;
    flags.push({
      ingredient: 'partially hydrogenated oil', severity: 'avoid',
      reason: 'Partially hydrogenated oils are an industrial trans fat source — no safe level',
      source: SOURCES.AHA_TRANS,
    });
  }

  // ── Saturated fat per 100g — UK FSA tiers ──
  if (n.saturated_fat_g != null) {
    const v = n.saturated_fat_g;
    if (v > 5) {
      const penalty = v > 10 ? 20 : 10;
      score -= penalty;
      flags.push({
        nutrient: `saturated fat: ${v}g/100g`, severity: v > 10 ? 'avoid' : 'warn',
        reason: 'High saturated fat content raises LDL cholesterol',
        source: SOURCES.FSA_TRAFFIC,
      });
    } else if (v < 1.5) {
      score += 5;
      flags.push({
        nutrient: `saturated fat: ${v}g/100g`, severity: 'good',
        reason: 'Low saturated fat (UK FSA "low")',
        source: SOURCES.FSA_TRAFFIC,
      });
    }
  }

  // ── Sodium per 100g — UK FSA tiers ──
  if (n.sodium_mg != null) {
    const v = n.sodium_mg;
    if (v > 1200) {
      score -= 20;
      flags.push({
        nutrient: `sodium: ${v}mg/100g`, severity: 'avoid',
        reason: 'Very high sodium — raises blood pressure (FSA "high")',
        source: SOURCES.FSA_TRAFFIC,
      });
    } else if (v > 400) {
      score -= 10;
      flags.push({
        nutrient: `sodium: ${v}mg/100g`, severity: 'warn',
        reason: 'Moderate-to-high sodium — watch daily total (AHA target <2,300 mg/day)',
        source: SOURCES.AHA_2021,
      });
    } else if (v < 120) {
      score += 5;
      flags.push({
        nutrient: `sodium: ${v}mg/100g`, severity: 'good',
        reason: 'Low sodium (UK FSA "low")',
        source: SOURCES.FSA_TRAFFIC,
      });
    }
  }

  // ── Added sugar per 100g — AHA limits ──
  const sugars = n.added_sugars_g ?? n.sugars_g;
  if (sugars != null) {
    if (sugars > 22.5) {
      score -= 15;
      flags.push({
        nutrient: `${n.added_sugars_g != null ? 'added ' : ''}sugars: ${sugars}g/100g`,
        severity: 'avoid',
        reason: 'High sugar — AHA limits added sugar to <25 g/day for women, <36 g/day for men',
        source: SOURCES.AHA_SUGAR,
      });
    } else if (sugars > 10) {
      score -= 10;
      flags.push({
        nutrient: `sugars: ${sugars}g/100g`, severity: 'warn',
        reason: 'Moderate-to-high sugar content',
        source: SOURCES.AHA_SUGAR,
      });
    }
  }

  // ── Processed meat — IARC class I + AHA limit ──
  if (text && hasAny(text, PROCESSED_MEAT_TERMS)) {
    const matched = firstMatch(text, PROCESSED_MEAT_TERMS);
    score -= 15;
    flags.push({
      ingredient: matched, severity: 'warn',
      reason: 'Processed meats are an IARC Group 1 carcinogen and AHA recommends limiting intake',
      source: SOURCES.IARC_MEAT,
    });
  }

  // ── Omega-3 sources (bonus) ──
  if (text && hasAny(text, OMEGA3_TERMS)) {
    const matched = firstMatch(text, OMEGA3_TERMS);
    score += 10;
    flags.push({
      ingredient: matched, severity: 'good',
      reason: 'Omega-3 fatty acid source — AHA recommends 2 servings of fatty fish per week',
      source: SOURCES.AHA_2021,
    });
  }

  // ── Soluble fiber (bonus) — FDA-approved health claim ──
  if (text && hasAny(text, SOLUBLE_FIBER_TERMS)) {
    const matched = firstMatch(text, SOLUBLE_FIBER_TERMS);
    score += 5;
    flags.push({
      ingredient: matched, severity: 'good',
      reason: 'Soluble fiber source — lowers LDL cholesterol when consumed regularly',
      source: SOURCES.AHA_2021,
    });
  }

  // ── Whole grain (bonus) ──
  if (text && hasAny(text, WHOLE_GRAIN_TERMS)) {
    const matched = firstMatch(text, WHOLE_GRAIN_TERMS);
    score += 5;
    flags.push({
      ingredient: matched, severity: 'good',
      reason: 'Whole-grain ingredient — associated with reduced CVD risk',
      source: SOURCES.AHA_2021,
    });
  }

  // ── Total fiber bonus ──
  if (n.fiber_g != null && n.fiber_g > 6) {
    score += 5;
    flags.push({
      nutrient: `fiber: ${n.fiber_g}g/100g`, severity: 'good',
      reason: 'High fiber — UK FSA "high"',
      source: SOURCES.FSA_TRAFFIC,
    });
  }

  return { score: clamp(score), flags };
}

// ────────────────────────────────────────────────────────────────────────────
// DIABETES — guideline: ADA Standards of Care 2024
//
// ADA does not prescribe macro ratios; emphasizes carbohydrate quality
// (whole-grain, high-fiber) over quantity. Penalize added sugar and refined
// carbohydrate; reward fiber and whole grains. Trans fat penalty inherited
// (CVD risk elevated in DM).
// ────────────────────────────────────────────────────────────────────────────

function scoreDiabetes(ingredients, n) {
  let score = 100;
  const flags = [];
  const text = ingredients;

  // ── Added sugar per 100g — strongest driver ──
  const sugars = n.added_sugars_g ?? n.sugars_g;
  const isAdded = n.added_sugars_g != null;
  if (sugars != null) {
    if (sugars > 22.5) {
      score -= 30;
      flags.push({
        nutrient: `${isAdded ? 'added ' : ''}sugars: ${sugars}g/100g`, severity: 'avoid',
        reason: 'Very high sugar — significant glycemic load (FSA "high")',
        source: SOURCES.ADA_2024,
      });
    } else if (sugars > 10) {
      score -= 20;
      flags.push({
        nutrient: `${isAdded ? 'added ' : ''}sugars: ${sugars}g/100g`, severity: 'warn',
        reason: 'High sugar content — drives postprandial glucose excursion',
        source: SOURCES.ADA_2024,
      });
    } else if (sugars > 3) {
      score -= 10;
      flags.push({
        nutrient: `${isAdded ? 'added ' : ''}sugars: ${sugars}g/100g`, severity: 'warn',
        reason: 'Moderate sugar content — monitor portion size',
        source: SOURCES.ADA_2024,
      });
    }
    if (!isAdded && sugars > 3) {
      flags.push({
        severity: 'info',
        reason: 'Product reports total sugars only — added sugar may be lower if product contains naturally occurring sugars (fruit/dairy)',
        source: SOURCES.ADA_2024,
      });
    }
  }

  // ── Carb:fiber ratio (proxy for glycemic load) ──
  if (n.carbs_g != null && n.fiber_g != null && n.carbs_g > 15) {
    const ratio = n.carbs_g / Math.max(n.fiber_g, 0.1);
    if (ratio > 10) {
      score -= 10;
      flags.push({
        nutrient: `carbs ${n.carbs_g}g / fiber ${n.fiber_g}g (ratio ${ratio.toFixed(1)})`,
        severity: 'warn',
        reason: 'Low fiber relative to carbohydrate — likely refined-carb dominant, faster glucose rise',
        source: SOURCES.ADA_NUTRITION,
      });
    } else if (ratio < 5) {
      score += 5;
      flags.push({
        nutrient: `carbs ${n.carbs_g}g / fiber ${n.fiber_g}g (ratio ${ratio.toFixed(1)})`,
        severity: 'good',
        reason: 'Balanced fiber-to-carbohydrate ratio — gentler glucose response',
        source: SOURCES.ADA_NUTRITION,
      });
    }
  }

  // ── Fiber bonus (slows glucose absorption) ──
  if (n.fiber_g != null) {
    if (n.fiber_g > 6) {
      score += 10;
      flags.push({
        nutrient: `fiber: ${n.fiber_g}g/100g`, severity: 'good',
        reason: 'High fiber slows glucose absorption — ADA recommends fiber-rich whole foods',
        source: SOURCES.ADA_2024,
      });
    } else if (n.fiber_g >= 3) {
      score += 5;
      flags.push({
        nutrient: `fiber: ${n.fiber_g}g/100g`, severity: 'good',
        reason: 'Good fiber content',
        source: SOURCES.ADA_2024,
      });
    }
  }

  // ── Trans fat (elevated CVD risk in DM) ──
  if (n.trans_fat_g != null && n.trans_fat_g > 0) {
    score -= 15;
    flags.push({
      nutrient: `trans fat: ${n.trans_fat_g}g/100g`, severity: 'avoid',
      reason: 'Trans fats raise CVD risk — especially important to avoid with diabetes',
      source: SOURCES.ADA_2024,
    });
  } else if (text && hasAny(text, TRANS_FAT_INGREDIENT)) {
    score -= 15;
    flags.push({
      ingredient: 'partially hydrogenated oil', severity: 'avoid',
      reason: 'Industrial trans fat source',
      source: SOURCES.ADA_2024,
    });
  }

  // ── Whole grain bonus ──
  if (text && hasAny(text, WHOLE_GRAIN_TERMS)) {
    const matched = firstMatch(text, WHOLE_GRAIN_TERMS);
    score += 5;
    flags.push({
      ingredient: matched, severity: 'good',
      reason: 'Whole grains improve glycemic response vs refined grains',
      source: SOURCES.ADA_NUTRITION,
    });
  }

  return { score: clamp(score), flags };
}

// ────────────────────────────────────────────────────────────────────────────
// KIDNEY — guideline: KDOQI 2020
//
// KDOQI nutrition recommendations differ sharply by CKD stage. A scorer
// without stage info cannot give specific protein/potassium guidance.
// Sub-types:
//   - 'general':   CKD 1-2 or undeclared — only phosphate additives + sodium
//   - 'ckd-3-4':   non-dialysis CKD 3-4 — restrict protein, watch potassium
//   - 'dialysis':  CKD 5 / on dialysis — higher protein needs, strict K
//   - 'stones':    calcium-oxalate nephrolithiasis (different condition)
// ────────────────────────────────────────────────────────────────────────────

// Added-phosphate additives — absorbed at ~90% vs 40-60% for natural phosphorus
const PHOSPHATE_ADDITIVES = [
  'phosphoric acid', 'sodium phosphate', 'monosodium phosphate', 'disodium phosphate',
  'trisodium phosphate', 'sodium tripolyphosphate', 'sodium acid pyrophosphate',
  'sodium hexametaphosphate', 'tetrasodium pyrophosphate',
  'potassium phosphate', 'dipotassium phosphate', 'monopotassium phosphate',
  'calcium phosphate', 'dicalcium phosphate', 'tricalcium phosphate',
  'monocalcium phosphate', 'aluminum phosphate', 'magnesium phosphate',
];

// High-oxalate foods (relevant only for calcium-oxalate stones)
const HIGH_OXALATE = [
  'spinach', 'rhubarb', 'beet', 'beets', 'beet greens', 'swiss chard',
  'almond', 'almonds', 'almond flour', 'almond milk',
  'cashew', 'cashews', 'peanut', 'peanuts', 'peanut butter',
  'chocolate', 'cocoa', 'cocoa powder',
];

function scoreKidney(ingredients, n, subType) {
  let score = 100;
  const flags = [];
  const text = ingredients;
  const stage = subType || 'general';

  // ── Phosphate additives — universal CKD concern ──
  if (text) {
    const phos = firstMatch(text, PHOSPHATE_ADDITIVES);
    if (phos) {
      score -= 25;
      flags.push({
        ingredient: phos, severity: 'avoid',
        reason: 'Inorganic phosphate additive — absorbed at ~90% (vs 40-60% for natural phosphorus). Major driver of hyperphosphatemia in CKD',
        source: SOURCES.NKF_PHOS,
      });
    }
  }

  // ── Sodium — relevant for hypertension control across stages ──
  if (n.sodium_mg != null) {
    if (n.sodium_mg > 1200) {
      score -= 20;
      flags.push({
        nutrient: `sodium: ${n.sodium_mg}mg/100g`, severity: 'avoid',
        reason: 'Very high sodium — strains BP control and accelerates CKD progression',
        source: SOURCES.KDOQI_2020,
      });
    } else if (n.sodium_mg > 400) {
      score -= 10;
      flags.push({
        nutrient: `sodium: ${n.sodium_mg}mg/100g`, severity: 'warn',
        reason: 'Moderate-to-high sodium — KDOQI suggests <2,300 mg/day',
        source: SOURCES.KDOQI_2020,
      });
    } else if (n.sodium_mg < 120) {
      score += 5;
      flags.push({
        nutrient: `sodium: ${n.sodium_mg}mg/100g`, severity: 'good',
        reason: 'Low sodium',
        source: SOURCES.FSA_TRAFFIC,
      });
    }
  }

  // ── Stage-specific rules ──
  if (stage === 'ckd-3-4') {
    // Protein restriction: KDOQI 0.55-0.60 g/kg/day for non-dialysis CKD
    if (n.protein_g != null) {
      if (n.protein_g > 20) {
        score -= 20;
        flags.push({
          nutrient: `protein: ${n.protein_g}g/100g`, severity: 'avoid',
          reason: 'Very high protein — KDOQI recommends 0.55-0.60 g/kg/day for non-dialysis CKD 3-4',
          source: SOURCES.KDOQI_2020,
        });
      } else if (n.protein_g > 10) {
        score -= 10;
        flags.push({
          nutrient: `protein: ${n.protein_g}g/100g`, severity: 'warn',
          reason: 'High protein — limit intake in non-dialysis CKD 3-4',
          source: SOURCES.KDOQI_2020,
        });
      }
    }
    // Potassium restriction
    if (n.potassium_mg != null) {
      if (n.potassium_mg > 400) {
        score -= 20;
        flags.push({
          nutrient: `potassium: ${n.potassium_mg}mg/100g`, severity: 'avoid',
          reason: 'High potassium — can cause hyperkalemia with reduced kidney function',
          source: SOURCES.KDOQI_2020,
        });
      } else if (n.potassium_mg > 200) {
        score -= 10;
        flags.push({
          nutrient: `potassium: ${n.potassium_mg}mg/100g`, severity: 'warn',
          reason: 'Moderate potassium — monitor with labs',
          source: SOURCES.KDOQI_2020,
        });
      }
    }
  } else if (stage === 'dialysis') {
    // Higher protein needs: KDOQI 1.0-1.2 g/kg/day on maintenance dialysis
    if (n.protein_g != null && n.protein_g >= 10) {
      score += 5;
      flags.push({
        nutrient: `protein: ${n.protein_g}g/100g`, severity: 'good',
        reason: 'Good protein source — KDOQI recommends 1.0-1.2 g/kg/day on dialysis',
        source: SOURCES.KDOQI_2020,
      });
    }
    // Strict potassium control
    if (n.potassium_mg != null && n.potassium_mg > 200) {
      score -= 20;
      flags.push({
        nutrient: `potassium: ${n.potassium_mg}mg/100g`, severity: 'avoid',
        reason: 'High potassium — strict limits required on dialysis',
        source: SOURCES.KDOQI_2020,
      });
    }
  } else if (stage === 'stones') {
    // Calcium-oxalate stone prevention
    if (text) {
      const ox = firstMatch(text, HIGH_OXALATE);
      if (ox) {
        score -= 10;
        flags.push({
          ingredient: ox, severity: 'warn',
          reason: 'High-oxalate ingredient — limit if you form calcium-oxalate stones (consume with dietary calcium to reduce absorption)',
          source: SOURCES.AUA_STONES,
        });
      }
      if (hasAny(text, ['lemon', 'lime', 'orange juice', 'citric acid'])) {
        score += 5;
        flags.push({
          ingredient: 'citrate source', severity: 'good',
          reason: 'Citrate inhibits calcium-oxalate stone formation',
          source: SOURCES.AUA_STONES,
        });
      }
    }
    // Sodium drives urinary calcium — already penalized above
  } else {
    // 'general' — no stage declared
    flags.push({
      severity: 'info',
      reason: 'For more specific guidance, set your CKD stage (early, CKD 3-4, dialysis) or stone history in your profile. Without it, scoring is limited to phosphate additives and sodium.',
      source: SOURCES.KDOQI_2020,
    });
  }

  return { score: clamp(score), flags };
}

// ────────────────────────────────────────────────────────────────────────────
// THYROID — guidelines: ATA (hypo 2014, hyper 2016), AACE 2012
//
// Honest reading of the literature: for euthyroid patients on adequate
// thyroid hormone replacement, dietary restrictions for hypothyroidism /
// Hashimoto's are NOT recommended by endocrine societies. The clinically
// relevant intervention is medication-timing, not food selection.
//
// Hyperthyroidism is different — high iodine intake (kelp, seaweed,
// iodide supplements) can genuinely worsen thyrotoxicosis, especially in
// Graves' disease.
// ────────────────────────────────────────────────────────────────────────────

const HIGH_IODINE_SEAWEED = [
  'kelp', 'kombu', 'wakame', 'nori', 'dulse', 'hijiki', 'arame',
  'sea moss', 'irish moss', 'seaweed',
];

const ADDED_IODINE = ['potassium iodide', 'iodized salt'];

// Ingredients that may interfere with levothyroxine absorption (informational
// only — flag for medication-timing, not score penalty)
const LEVOTHYROXINE_INTERFERENCE = [
  'soy protein isolate', 'soy protein concentrate',
  'calcium carbonate', 'calcium citrate',
  'ferrous sulfate', 'ferrous fumarate', 'iron',
  'psyllium',
];

function scoreThyroid(ingredients, n, subType) {
  let score = 100;
  const flags = [];
  const text = ingredients;
  const sub = subType || 'hypo';

  if (sub === 'hyper') {
    // ── High-iodine seaweed — real concern in hyperthyroidism / Graves' ──
    if (text) {
      const sw = firstMatch(text, HIGH_IODINE_SEAWEED);
      if (sw) {
        score -= 25;
        flags.push({
          ingredient: sw, severity: 'avoid',
          reason: 'High iodine content — can worsen thyrotoxicosis, especially in Graves\' disease',
          source: SOURCES.ATA_HYPER,
        });
      }
      const iod = firstMatch(text, ADDED_IODINE);
      if (iod) {
        score -= 15;
        flags.push({
          ingredient: iod, severity: 'warn',
          reason: 'Added iodine source — discuss daily intake with your endocrinologist',
          source: SOURCES.ATA_HYPER,
        });
      }
      // Caffeine as informational (symptomatic, not pathologic)
      if (hasAny(text, ['caffeine', 'guarana']) || hasAny(text, ['coffee', 'green tea extract'])) {
        flags.push({
          ingredient: 'caffeine', severity: 'info',
          reason: 'Caffeine can amplify hyperthyroid symptoms (palpitations, tremor) — symptomatic, not disease-modifying',
          source: SOURCES.ATA_HYPER,
        });
      }
    }
    return { score: clamp(score), flags };
  }

  // ── HYPO and HASHIMOTO'S ──
  //
  // Two tiers of guidance:
  //
  //   Strong evidence (guideline-endorsed): no specific diet restrictions
  //     are formally recommended by ATA/AACE in iodine-sufficient regions.
  //     The clinically relevant intervention is medication-timing.
  //
  //   Mixed evidence (mechanism + small clinical signal): autoimmune
  //     thyroiditis (Hashimoto's) may respond to an anti-inflammatory
  //     dietary pattern — lower ultra-processed food load, higher
  //     omega-3 and selenium intake. Some patients also report symptom
  //     improvement on gluten-free trials, but society guidelines have
  //     NOT endorsed this. We surface these as informational flags or
  //     mild adjustments tagged with evidence: 'mixed' so the UI can
  //     show them at a lower confidence tier.

  // ── Strong-evidence: levothyroxine timing ──
  if (text) {
    const interferer = firstMatch(text, LEVOTHYROXINE_INTERFERENCE);
    if (interferer) {
      flags.push({
        ingredient: interferer, severity: 'info', evidence: 'strong',
        reason: 'May interfere with levothyroxine absorption — if you take thyroid hormone replacement, separate this product by ≥4 hours',
        source: SOURCES.ATA_HYPO,
      });
    }
    // High-iodine in iodine-sufficient regions: informational only
    if (hasAny(text, HIGH_IODINE_SEAWEED)) {
      flags.push({
        ingredient: firstMatch(text, HIGH_IODINE_SEAWEED), severity: 'info', evidence: 'strong',
        reason: 'High iodine source — moderate intake is fine for most; discuss with your endocrinologist if you have autoimmune thyroid disease',
        source: SOURCES.AACE_THYROID,
      });
    }
  }

  // ── Mixed-evidence: anti-inflammatory diet pattern, Hashimoto's especially ──
  // The autoimmune-thyroiditis literature (not society guidelines) suggests
  // ultra-processed food load and inflammatory dietary patterns may
  // contribute to symptom burden. Penalties are mild and reversible.

  if (n.trans_fat_g != null && n.trans_fat_g > 0) {
    score -= 10;
    flags.push({
      nutrient: `trans fat: ${n.trans_fat_g}g/100g`, severity: 'warn', evidence: 'mixed',
      reason: 'Trans fats are pro-inflammatory — emerging evidence suggests they may worsen autoimmune-thyroid symptom burden',
      source: SOURCES.AUTOIMMUNE_DIET,
    });
  } else if (text && hasAny(text, TRANS_FAT_INGREDIENT)) {
    score -= 10;
    flags.push({
      ingredient: 'partially hydrogenated oil', severity: 'warn', evidence: 'mixed',
      reason: 'Industrial trans fat source — pro-inflammatory',
      source: SOURCES.AUTOIMMUNE_DIET,
    });
  }

  if (n.added_sugars_g != null && n.added_sugars_g > 22.5) {
    score -= 5;
    flags.push({
      nutrient: `added sugars: ${n.added_sugars_g}g/100g`, severity: 'warn', evidence: 'mixed',
      reason: 'High added sugar — inflammatory pattern may aggravate autoimmune thyroid symptoms',
      source: SOURCES.AUTOIMMUNE_DIET,
    });
  }

  if (n.saturated_fat_g != null && n.saturated_fat_g > 5) {
    score -= 5;
    flags.push({
      nutrient: `saturated fat: ${n.saturated_fat_g}g/100g`, severity: 'warn', evidence: 'mixed',
      reason: 'High saturated fat — may contribute to inflammatory load',
      source: SOURCES.AUTOIMMUNE_DIET,
    });
  }

  if (n.sodium_mg != null && n.sodium_mg > 1200) {
    score -= 5;
    flags.push({
      nutrient: `sodium: ${n.sodium_mg}mg/100g`, severity: 'warn', evidence: 'mixed',
      reason: 'Very high sodium — high-sodium dietary patterns associated with worsened autoimmune disease activity (mixed clinical evidence)',
      source: SOURCES.AUTOIMMUNE_DIET,
    });
  }

  // ── Mixed-evidence: positive signals ──
  if (text) {
    if (hasAny(text, ['brazil nut', 'brazil nuts', 'sunflower seed', 'sunflower seeds'])) {
      score += 5;
      flags.push({
        ingredient: firstMatch(text, ['brazil nut', 'brazil nuts', 'sunflower seed', 'sunflower seeds']),
        severity: 'good', evidence: 'mixed',
        reason: 'Selenium-rich food — selenium supports thyroid hormone metabolism; small RCTs suggest benefit in autoimmune thyroiditis',
        source: SOURCES.NIH_SELENIUM,
      });
    }
    if (hasAny(text, OMEGA3_TERMS)) {
      score += 5;
      flags.push({
        ingredient: firstMatch(text, OMEGA3_TERMS),
        severity: 'good', evidence: 'mixed',
        reason: 'Omega-3 source — anti-inflammatory, emerging evidence in autoimmune thyroid disease',
        source: SOURCES.AUTOIMMUNE_DIET,
      });
    }
  }

  // ── Hashimoto's-specific: gluten and dairy info flags ──
  if (sub === 'hashimotos') {
    // Note: we deliberately do NOT deduct points for gluten/dairy here.
    // Society guidelines do not endorse restriction. But the evidence is
    // mixed enough that patients should know.
    if (text && hasAny(text, ['wheat', 'wheat flour', 'barley', 'rye', 'malt'])) {
      flags.push({
        ingredient: firstMatch(text, ['wheat', 'wheat flour', 'barley', 'rye', 'malt']),
        severity: 'info', evidence: 'mixed',
        reason: 'Mixed evidence: some Hashimoto\'s patients report symptom improvement on a gluten-free trial. Society guidelines do NOT endorse routine gluten avoidance without concurrent celiac disease. Discuss with your endocrinologist before eliminating.',
        source: SOURCES.GLUTEN_HASHIMOTO,
      });
    }
    if (text && hasAny(text, ['milk', 'cheese', 'cream', 'butter', 'whey', 'casein'])) {
      flags.push({
        ingredient: firstMatch(text, ['milk', 'cheese', 'cream', 'butter', 'whey', 'casein']),
        severity: 'info', evidence: 'mixed',
        reason: 'Mixed evidence on dairy in Hashimoto\'s — some patients have concurrent lactose or A1-casein sensitivity. No society guideline recommends routine restriction.',
        source: SOURCES.AUTOIMMUNE_DIET,
      });
    }
  }

  return { score: clamp(score), flags };
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

const CONDITION_LABELS = {
  thyroid: 'Thyroid',
  diabetes: 'Diabetes',
  heart: 'Heart',
  kidney: 'Kidney',
  celiac: 'Celiac',
};

const SUB_LABELS = {
  hypo: 'Hypo',
  hyper: 'Hyper',
  hashimotos: "Hashimoto's",
  general: 'General',
  'ckd-3-4': 'CKD 3-4',
  dialysis: 'Dialysis',
  stones: 'Kidney Stones',
};

function buildLabel(slug, subType) {
  const base = CONDITION_LABELS[slug] || slug;
  if (!subType) return base;
  return `${base} (${SUB_LABELS[subType] || subType})`;
}

/**
 * Score a product for a specific condition.
 *
 * @param {Object} product           Product with `ingredients` and `nutrition_facts`
 * @param {string} conditionSlug     One of: celiac, heart, diabetes, kidney, thyroid
 * @param {string} [subType]         Sub-type/stage:
 *                                   - thyroid: hypo (default), hyper, hashimotos
 *                                   - kidney:  general (default), ckd-3-4, dialysis, stones
 * @returns {{ slug, subType, label, score, flags, rulesVersion, disclaimer }}
 */
export function scoreForCondition(product, conditionSlug, subType) {
  const ingredients = normalizeText(product?.ingredients || '');
  const nutrients = readPer100g(product?.nutrition_facts);

  let result;
  switch (conditionSlug) {
    case 'celiac':   result = scoreCeliac(ingredients, nutrients); break;
    case 'heart':    result = scoreHeart(ingredients, nutrients); break;
    case 'diabetes': result = scoreDiabetes(ingredients, nutrients); break;
    case 'kidney':   result = scoreKidney(ingredients, nutrients, subType); break;
    case 'thyroid':  result = scoreThyroid(ingredients, nutrients, subType || 'hypo'); break;
    default:         result = { score: 100, flags: [] };
  }

  return {
    slug: conditionSlug,
    subType: subType || null,
    label: buildLabel(conditionSlug, subType),
    score: result.score,
    flags: result.flags,
    dataQuality: result.data_quality || 'ok',
    rulesVersion: RULES_VERSION,
    disclaimer: DISCLAIMER,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Full citation list (referenced by short tag in flags)
// ────────────────────────────────────────────────────────────────────────────
//
// CDF          — celiac.org/about-celiac-disease/what-is-celiac-disease/
//                sources-of-gluten/
// FDA_GF       — FDA 21 CFR §101.91, Gluten-Free Labeling of Foods Final Rule
//                (78 FR 47154, Aug 5 2013)
// AHA_2021     — Lichtenstein AH et al. 2021 Dietary Guidance to Improve
//                Cardiovascular Health. Circulation. 2021;144:e472–e487.
// AHA_TRANS    — Sacks FM et al. Dietary Fats and Cardiovascular Disease:
//                AHA Presidential Advisory. Circulation. 2017;136:e1–e23.
// AHA_SUGAR    — Johnson RK et al. Added Sugars and Cardiovascular Disease
//                Risk in Children. Circulation. 2016;134:e362–e364.
// FSA_TRAFFIC  — UK FSA / DoH Front-of-Pack Nutrition Labelling Guidance (2016)
// IARC_MEAT    — Bouvard V et al. Carcinogenicity of consumption of red and
//                processed meat. Lancet Oncol. 2015;16(16):1599–1600.
// ADA_2024     — American Diabetes Association. Standards of Care in Diabetes
//                — 2024. Diabetes Care. 2024;47(Suppl 1).
// ADA_NUTRITION— Evert AB et al. Nutrition Therapy for Adults With Diabetes
//                or Prediabetes: A Consensus Report. Diabetes Care.
//                2019;42(5):731–754.
// KDOQI_2020   — Ikizler TA et al. KDOQI Clinical Practice Guideline for
//                Nutrition in CKD: 2020 Update. Am J Kidney Dis.
//                2020;76(3 Suppl 1):S1–S107.
// NKF_PHOS     — National Kidney Foundation — Phosphorus and Your CKD Diet.
//                kidney.org/atoz/content/phosphorus
// AUA_STONES   — Pearle MS et al. Medical Management of Kidney Stones: AUA
//                Guideline. J Urol. 2014;192(2):316–324.
// ATA_HYPO     — Jonklaas J et al. Guidelines for the Treatment of
//                Hypothyroidism. Thyroid. 2014;24(12):1670–1751.
// ATA_HYPER    — Ross DS et al. 2016 American Thyroid Association Guidelines
//                for Diagnosis and Management of Hyperthyroidism and Other
//                Causes of Thyrotoxicosis. Thyroid. 2016;26(10):1343–1421.
// AACE_THYROID — Garber JR et al. Clinical Practice Guidelines for
//                Hypothyroidism in Adults. Endocr Pract. 2012;18(6):988–1028.
