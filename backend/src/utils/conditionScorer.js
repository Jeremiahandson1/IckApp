/**
 * Condition Scoring Engine
 *
 * Pure function — no DB calls. Works off product data already in memory.
 * Returns a 0-100 score with flags explaining each deduction/bonus.
 */

// ── Helpers ──

function ingredientContains(ingredientsLower, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(ingredientsLower);
}

function anyMatch(ingredientsLower, terms) {
  return terms.some(t => ingredientContains(ingredientsLower, t));
}

function clamp(val) {
  return Math.max(0, Math.min(100, val));
}

// ── Condition labels ──

const CONDITION_LABELS = {
  thyroid: 'Thyroid',
  diabetes: 'Diabetes',
  heart: 'Heart',
  kidney: 'Kidney',
  celiac: 'Celiac',
};

function conditionLabel(slug, subType) {
  const base = CONDITION_LABELS[slug] || slug;
  if (!subType) return base;
  const subLabels = { hypo: 'Hypo', hyper: 'Hyper', hashimotos: "Hashimoto's" };
  return `${base} (${subLabels[subType] || subType})`;
}

// ── Scoring functions per condition ──

function scoreThyroid(ingredients, nf, subType) {
  let score = 100;
  const flags = [];
  const il = ingredients.toLowerCase();

  if (subType === 'hypo' || subType === 'hashimotos') {
    // Soy
    if (anyMatch(il, ['soy', 'soy protein', 'soy isolate', 'soy isoflavones'])) {
      score -= 20;
      const matched = ['soy', 'soy protein', 'soy isolate', 'soy isoflavones'].find(t => ingredientContains(il, t));
      flags.push({ ingredient: matched, reason: 'Soy can suppress thyroid hormone absorption', severity: 'avoid' });
    }
    // Raw cruciferous
    if (anyMatch(il, ['raw cabbage', 'raw kale', 'raw broccoli', 'raw cauliflower', 'raw brussels'])) {
      score -= 15;
      flags.push({ ingredient: 'raw cruciferous vegetables', reason: 'Raw goitrogens can interfere with thyroid hormone production', severity: 'avoid' });
    }
    // Excess iodine
    if (anyMatch(il, ['iodized salt', 'potassium iodide', 'kelp', 'seaweed'])) {
      score -= 10;
      const matched = ['iodized salt', 'potassium iodide', 'kelp', 'seaweed'].find(t => ingredientContains(il, t));
      flags.push({ ingredient: matched, reason: 'Excess iodine can worsen hypothyroidism', severity: 'warn' });
    }
    // Goitrogenic foods
    if (anyMatch(il, ['millet', 'cassava', 'pine nuts'])) {
      score -= 10;
      const matched = ['millet', 'cassava', 'pine nuts'].find(t => ingredientContains(il, t));
      flags.push({ ingredient: matched, reason: 'Known goitrogenic foods', severity: 'warn' });
    }
    // Selenium (good)
    if (anyMatch(il, ['brazil nut', 'sunflower seeds'])) {
      score += 10;
      flags.push({ ingredient: 'selenium-rich ingredient', reason: 'Selenium supports thyroid function', severity: 'good' });
    }
  }

  if (subType === 'hashimotos') {
    // Gluten
    if (anyMatch(il, ['wheat', 'wheat flour', 'wheat starch', 'wheat gluten', 'barley', 'rye', 'malt'])) {
      score -= 20;
      const matched = ['wheat', 'wheat flour', 'wheat starch', 'wheat gluten', 'barley', 'rye', 'malt'].find(t => ingredientContains(il, t));
      flags.push({ ingredient: matched, reason: "Gluten triggers immune response in Hashimoto's", severity: 'avoid' });
    }
    // Dairy
    if (anyMatch(il, ['milk', 'cheese', 'cream', 'butter', 'whey'])) {
      score -= 10;
      const matched = ['milk', 'cheese', 'cream', 'butter', 'whey'].find(t => ingredientContains(il, t));
      flags.push({ ingredient: matched, reason: "Dairy sensitivity common in Hashimoto's", severity: 'warn' });
    }
  }

  if (subType === 'hyper') {
    // High iodine seaweed
    if (anyMatch(il, ['kelp', 'seaweed', 'dulse', 'nori', 'kombu', 'wakame'])) {
      score -= 25;
      const matched = ['kelp', 'seaweed', 'dulse', 'nori', 'kombu', 'wakame'].find(t => ingredientContains(il, t));
      flags.push({ ingredient: matched, reason: 'High iodine worsens hyperthyroidism', severity: 'avoid' });
    }
    // Added iodine
    if (anyMatch(il, ['iodized salt', 'potassium iodide'])) {
      score -= 20;
      const matched = ['iodized salt', 'potassium iodide'].find(t => ingredientContains(il, t));
      flags.push({ ingredient: matched, reason: 'Added iodine worsens hyperthyroidism', severity: 'avoid' });
    }
    // Caffeine
    if (anyMatch(il, ['caffeine', 'energy drink', 'guarana'])) {
      score -= 15;
      flags.push({ ingredient: 'caffeine', reason: 'Caffeine can worsen hyperthyroid symptoms', severity: 'avoid' });
    }
    // Cruciferous (good for hyper)
    if (anyMatch(il, ['broccoli', 'cabbage', 'kale', 'cauliflower', 'brussels'])) {
      score += 10;
      flags.push({ ingredient: 'cruciferous vegetables', reason: 'Goitrogens may help reduce thyroid activity', severity: 'good' });
    }
  }

  return { score: clamp(score), flags };
}

function scoreDiabetes(ingredients, nf) {
  let score = 100;
  const flags = [];
  const il = ingredients.toLowerCase();

  // Prefer added_sugars when available (from USDA), fall back to total sugars
  const sugars = nf.added_sugars ?? nf.sugars ?? null;
  const carbs = nf.carbs ?? nf.carbohydrates ?? null;
  const fiber = nf.fiber ?? null;

  // Added sugars
  if (sugars != null) {
    if (sugars > 10) {
      score -= 20;
      flags.push({ nutrient: `sugars: ${sugars}g`, reason: 'High added sugar spikes blood glucose', severity: 'avoid' });
    } else if (sugars >= 5) {
      score -= 10;
      flags.push({ nutrient: `sugars: ${sugars}g`, reason: 'Moderate added sugar — monitor portions', severity: 'warn' });
    }
  }

  // Refined carbs proxy
  if (carbs != null && fiber != null && carbs > 30 && fiber < 3) {
    score -= 10;
    flags.push({ nutrient: `carbs: ${carbs}g, fiber: ${fiber}g`, reason: 'Low fiber, high carb — fast glucose spike', severity: 'warn' });
  }

  // Fiber (good)
  if (fiber != null) {
    if (fiber > 5) {
      score += 10;
      flags.push({ nutrient: `fiber: ${fiber}g`, reason: 'High fiber slows glucose absorption', severity: 'good' });
    } else if (fiber >= 3) {
      score += 5;
      flags.push({ nutrient: `fiber: ${fiber}g`, reason: 'Good fiber content', severity: 'good' });
    }
  }

  // HFCS
  if (anyMatch(il, ['high fructose corn syrup', 'corn syrup'])) {
    score -= 10;
    flags.push({ ingredient: 'corn syrup', reason: 'HFCS linked to insulin resistance', severity: 'warn' });
  }

  // Blood sugar support
  if (anyMatch(il, ['cinnamon', 'apple cider vinegar', 'chromium'])) {
    score += 10;
    const matched = ['cinnamon', 'apple cider vinegar', 'chromium'].find(t => ingredientContains(il, t));
    flags.push({ ingredient: matched, reason: 'May support blood sugar regulation', severity: 'good' });
  }

  return { score: clamp(score), flags };
}

function scoreHeart(ingredients, nf) {
  let score = 100;
  const flags = [];
  const il = ingredients.toLowerCase();

  const satFat = nf.saturated_fat ?? null;
  const sodium = nf.sodium ?? null;
  const fiber = nf.fiber ?? null;
  const transFat = nf.trans_fat ?? nf.trans_fat_100g ?? null;

  // Trans fat
  if ((transFat != null && transFat > 0) || ingredientContains(il, 'partially hydrogenated')) {
    score -= 25;
    flags.push({ nutrient: 'trans fat', reason: 'Trans fats directly raise LDL cholesterol', severity: 'avoid' });
  }

  // Saturated fat
  if (satFat != null) {
    if (satFat > 5) {
      score -= 20;
      flags.push({ nutrient: `saturated fat: ${satFat}g`, reason: 'Saturated fat raises LDL cholesterol', severity: 'avoid' });
    } else if (satFat >= 3) {
      score -= 10;
      flags.push({ nutrient: `saturated fat: ${satFat}g`, reason: 'Moderate saturated fat — limit intake', severity: 'warn' });
    }
  }

  // Sodium
  if (sodium != null) {
    if (sodium > 600) {
      score -= 20;
      flags.push({ nutrient: `sodium: ${sodium}mg`, reason: 'High sodium raises blood pressure', severity: 'avoid' });
    } else if (sodium >= 400) {
      score -= 10;
      flags.push({ nutrient: `sodium: ${sodium}mg`, reason: 'Moderate sodium — watch daily total', severity: 'warn' });
    }
  }

  // Omega-3 (good)
  if (anyMatch(il, ['omega-3', 'fish oil', 'flaxseed', 'chia'])) {
    score += 15;
    const matched = ['omega-3', 'fish oil', 'flaxseed', 'chia'].find(t => ingredientContains(il, t));
    flags.push({ ingredient: matched, reason: 'Omega-3 supports heart health', severity: 'good' });
  }

  // Fiber (good)
  if (fiber != null && fiber > 5) {
    score += 10;
    flags.push({ nutrient: `fiber: ${fiber}g`, reason: 'High fiber reduces cholesterol absorption', severity: 'good' });
  }

  // Soluble fiber sources
  if (anyMatch(il, ['oats', 'oat bran', 'psyllium'])) {
    score += 5;
    flags.push({ ingredient: 'soluble fiber source', reason: 'Soluble fiber lowers LDL', severity: 'good' });
  }

  return { score: clamp(score), flags };
}

function scoreKidney(ingredients, nf) {
  let score = 100;
  const flags = [];
  const il = ingredients.toLowerCase();

  const sodium = nf.sodium ?? null;
  const potassium = nf.potassium ?? nf.potassium_100g ?? null;
  const protein = nf.protein ?? null;

  // Phosphate additives
  const phosphateMatch = il.match(/\b\w*phosphate\b/i);
  if (phosphateMatch) {
    score -= 20;
    flags.push({ ingredient: phosphateMatch[0], reason: 'Phosphate additives are absorbed more than natural phosphorus — dangerous for kidneys', severity: 'avoid' });
  }

  // Potassium
  if (potassium != null && potassium > 300) {
    score -= 15;
    flags.push({ nutrient: `potassium: ${potassium}mg`, reason: 'High potassium is dangerous with reduced kidney function', severity: 'warn' });
  }

  // Sodium
  if (sodium != null) {
    if (sodium > 600) {
      score -= 20;
      flags.push({ nutrient: `sodium: ${sodium}mg`, reason: 'High sodium strains kidneys and raises blood pressure', severity: 'avoid' });
    } else if (sodium < 140) {
      score += 10;
      flags.push({ nutrient: `sodium: ${sodium}mg`, reason: 'Kidney-friendly sodium level', severity: 'good' });
    }
  }

  // Protein
  if (protein != null && protein > 15) {
    score -= 10;
    flags.push({ nutrient: `protein: ${protein}g`, reason: 'High protein increases kidney workload', severity: 'warn' });
  }

  // Oxalate sources
  if (anyMatch(il, ['spinach', 'rhubarb', 'beets', 'nuts', 'chocolate'])) {
    score -= 10;
    const matched = ['spinach', 'rhubarb', 'beets', 'nuts', 'chocolate'].find(t => ingredientContains(il, t));
    flags.push({ ingredient: matched, reason: 'High oxalate foods can cause kidney stones', severity: 'warn' });
  }

  return { score: clamp(score), flags };
}

function scoreCeliac(ingredients, nf) {
  let score = 100;
  const flags = [];
  const il = ingredients.toLowerCase();

  // Wheat
  if (anyMatch(il, ['wheat', 'wheat flour', 'wheat starch', 'wheat germ', 'wheat bran', 'whole wheat'])) {
    score -= 50;
    const matched = ['wheat', 'wheat flour', 'wheat starch', 'wheat germ', 'wheat bran', 'whole wheat'].find(t => ingredientContains(il, t));
    flags.push({ ingredient: matched, reason: 'Contains wheat — not safe for celiac disease', severity: 'avoid' });
  }

  // Barley
  if (anyMatch(il, ['barley', 'barley malt', 'malt extract', 'malt flavoring'])) {
    score -= 50;
    const matched = ['barley', 'barley malt', 'malt extract', 'malt flavoring'].find(t => ingredientContains(il, t));
    flags.push({ ingredient: matched, reason: 'Contains barley — not safe for celiac disease', severity: 'avoid' });
  }

  // Rye
  if (ingredientContains(il, 'rye')) {
    score -= 50;
    flags.push({ ingredient: 'rye', reason: 'Contains rye — not safe for celiac disease', severity: 'avoid' });
  }

  // Triticale
  if (ingredientContains(il, 'triticale')) {
    score -= 50;
    flags.push({ ingredient: 'triticale', reason: 'Contains triticale (wheat-rye hybrid) — not safe for celiac', severity: 'avoid' });
  }

  // Oats (unless gluten-free)
  if (ingredientContains(il, 'oats') && !ingredientContains(il, 'gluten-free oats') && !ingredientContains(il, 'gluten free oats')) {
    score -= 20;
    flags.push({ ingredient: 'oats', reason: 'Oats often cross-contaminated with gluten', severity: 'warn' });
  }

  // Ambiguous sources
  if (anyMatch(il, ['natural flavors', 'modified food starch', 'maltodextrin'])) {
    score -= 15;
    const matched = ['natural flavors', 'modified food starch', 'maltodextrin'].find(t => ingredientContains(il, t));
    flags.push({ ingredient: matched, reason: 'Source may be gluten-containing — check with manufacturer', severity: 'warn' });
  }

  // Certified gluten-free (good)
  if (anyMatch(il, ['certified gluten-free', 'certified gluten free', 'gluten-free certified'])) {
    score += 10;
    flags.push({ ingredient: 'certified gluten-free', reason: 'Certified gluten-free', severity: 'good' });
  }

  return { score: clamp(score), flags };
}

// ── Main export ──

/**
 * Score a product for a specific health condition.
 *
 * @param {Object} product - Must have: ingredients (string), nutrition_facts (object)
 * @param {string} conditionSlug - One of: thyroid, diabetes, heart, kidney, celiac
 * @param {string} [subType] - For thyroid: hypo, hyper, hashimotos
 * @returns {{ slug: string, label: string, score: number, flags: Array }}
 */
export function scoreForCondition(product, conditionSlug, subType) {
  const ingredients = product.ingredients || '';
  let nf = product.nutrition_facts || {};
  if (typeof nf === 'string') {
    try { nf = JSON.parse(nf); } catch { nf = {}; }
  }

  let result;
  switch (conditionSlug) {
    case 'thyroid':
      result = scoreThyroid(ingredients, nf, subType || 'hypo');
      break;
    case 'diabetes':
      result = scoreDiabetes(ingredients, nf);
      break;
    case 'heart':
      result = scoreHeart(ingredients, nf);
      break;
    case 'kidney':
      result = scoreKidney(ingredients, nf);
      break;
    case 'celiac':
      result = scoreCeliac(ingredients, nf);
      break;
    default:
      result = { score: 100, flags: [] };
  }

  return {
    slug: conditionSlug,
    subType: subType || null,
    label: conditionLabel(conditionSlug, subType),
    score: result.score,
    flags: result.flags,
  };
}
