// ═══════════════════════════════════════════
// USDA FoodData Central Integration
// Free API — 380,000+ branded US food products
// https://fdc.nal.usda.gov/api-guide/
// ═══════════════════════════════════════════
import fetch from 'node-fetch';

// Free API key — get yours at https://fdc.nal.usda.gov/api-key-signup/
// DEMO_KEY works but is rate-limited (30 req/hr). Production key = 1000 req/hr.
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

/**
 * Look up a product by UPC/GTIN barcode from USDA Branded Foods database
 * Returns normalized product data or null if not found
 */
export async function lookupByUPC(upc) {
  try {
    // USDA uses GTIN-13 — pad UPC-A (12 digit) to 13 with leading zero
    const gtin = upc.length === 12 ? '0' + upc : upc;

    // Search branded foods by GTIN/UPC
    const response = await fetch(`${USDA_BASE}/foods/search?api_key=${USDA_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: gtin,
        dataType: ['Branded'],
        pageSize: 5,
        sortBy: 'publishedDate',
        sortOrder: 'desc'
      })
    });

    if (!response.ok) {
      console.warn(`USDA API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.foods || data.foods.length === 0) {
      // Try with original UPC (some entries use 12-digit)
      if (gtin !== upc) {
        const retry = await fetch(`${USDA_BASE}/foods/search?api_key=${USDA_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: upc,
            dataType: ['Branded'],
            pageSize: 5,
            sortBy: 'publishedDate',
            sortOrder: 'desc'
          })
        });
        const retryData = await retry.json();
        if (!retryData.foods || retryData.foods.length === 0) return null;
        data.foods = retryData.foods;
      } else {
        return null;
      }
    }

    // Find the best match — prefer exact GTIN match
    const match = data.foods.find(f => f.gtinUpc === gtin || f.gtinUpc === upc) || data.foods[0];

    // Extract nutrient values by nutrient ID
    const nutrients = {};
    if (match.foodNutrients) {
      for (const n of match.foodNutrients) {
        nutrients[n.nutrientId] = n.value;
        nutrients[n.nutrientName?.toLowerCase()] = n.value;
      }
    }

    // Build nutrition_facts object matching our schema
    const nutrition_facts = {
      energy_kcal_100g: nutrients[1008] || nutrients['energy'] || null,
      fat_100g: nutrients[1004] || nutrients['total lipid (fat)'] || null,
      saturated_fat_100g: nutrients[1258] || nutrients['fatty acids, total saturated'] || null,
      carbohydrates_100g: nutrients[1005] || nutrients['carbohydrate, by difference'] || null,
      sugars_100g: nutrients[2000] || nutrients['sugars, total including nlea'] || nutrients['total sugars'] || null,
      fiber_100g: nutrients[1079] || nutrients['fiber, total dietary'] || null,
      proteins_100g: nutrients[1003] || nutrients['protein'] || null,
      sodium_100g: nutrients[1093] || nutrients['sodium, na'] || null,
      salt_100g: (nutrients[1093] || 0) * 2.5 / 1000, // sodium mg → salt g
    };

    // Extract ingredients from USDA data
    const ingredients = match.ingredients || '';

    // Detect common allergens from ingredients text
    const allergens = detectAllergens(ingredients);

    // Detect organic from description/brand
    const desc = `${match.description || ''} ${match.brandName || ''} ${ingredients}`.toLowerCase();
    const is_organic = desc.includes('organic');

    return {
      upc,
      name: match.description || match.brandName || 'Unknown Product',
      brand: match.brandOwner || match.brandName || 'Unknown Brand',
      category: match.brandedFoodCategory || 'Unknown',
      image_url: null, // USDA doesn't provide images
      ingredients,
      nutrition_facts,
      allergens_tags: allergens,
      is_organic,
      // USDA provides serving size info
      serving_size: match.servingSize || null,
      serving_size_unit: match.servingSizeUnit || 'g',
      household_serving: match.householdServingFullText || null,
      source: 'usda',
      usda_fdc_id: match.fdcId,
    };
  } catch (err) {
    console.warn('USDA lookup failed:', err.message);
    return null;
  }
}

/**
 * Search USDA branded foods by text query
 * Used as search fallback when OFF search misses
 */
export async function searchProducts(query, pageSize = 10) {
  try {
    const response = await fetch(`${USDA_BASE}/foods/search?api_key=${USDA_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        dataType: ['Branded'],
        pageSize,
        sortBy: 'dataType.keyword',
        sortOrder: 'desc'
      })
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.foods) return [];

    return data.foods.map(f => ({
      name: f.description,
      brand: f.brandOwner || f.brandName || 'Unknown',
      upc: f.gtinUpc || null,
      category: f.brandedFoodCategory || 'Unknown',
      source: 'usda',
      usda_fdc_id: f.fdcId,
    }));
  } catch (err) {
    console.warn('USDA search failed:', err.message);
    return [];
  }
}

/**
 * Detect common allergens from ingredients text
 */
function detectAllergens(ingredients) {
  if (!ingredients) return [];
  const text = ingredients.toLowerCase();
  const allergens = [];

  const checks = [
    { id: 'en:milk', keywords: ['milk', 'cream', 'butter', 'cheese', 'whey', 'casein', 'lactose', 'dairy'] },
    { id: 'en:eggs', keywords: ['egg', 'eggs', 'albumin', 'lysozyme', 'mayonnaise'] },
    { id: 'en:peanuts', keywords: ['peanut', 'peanuts', 'arachis'] },
    { id: 'en:tree-nuts', keywords: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut'] },
    { id: 'en:wheat', keywords: ['wheat', 'flour', 'bread', 'breadcrumb', 'semolina', 'spelt', 'durum'] },
    { id: 'en:soybeans', keywords: ['soy', 'soybean', 'soya', 'edamame', 'tofu'] },
    { id: 'en:fish', keywords: ['fish', 'anchovy', 'bass', 'catfish', 'cod', 'salmon', 'tilapia', 'tuna'] },
    { id: 'en:shellfish', keywords: ['shrimp', 'crab', 'lobster', 'crawfish', 'clam', 'mussel', 'oyster', 'scallop'] },
    { id: 'en:sesame-seeds', keywords: ['sesame', 'tahini'] },
  ];

  for (const { id, keywords } of checks) {
    if (keywords.some(kw => text.includes(kw))) {
      allergens.push(id);
    }
  }

  // Also check for "Contains:" statement common on US labels
  const containsMatch = text.match(/contains[:\s]+([^.]+)/i);
  if (containsMatch) {
    const containsText = containsMatch[1].toLowerCase();
    for (const { id, keywords } of checks) {
      if (!allergens.includes(id) && keywords.some(kw => containsText.includes(kw))) {
        allergens.push(id);
      }
    }
  }

  return allergens;
}
