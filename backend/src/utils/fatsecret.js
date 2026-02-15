// ═══════════════════════════════════════════
// FatSecret Platform API Integration
// Premier Free: images, allergens, barcode, autocomplete
// https://platform.fatsecret.com/api-editions
// ═══════════════════════════════════════════
import fetch from 'node-fetch';

const FS_CLIENT_ID = process.env.FATSECRET_CLIENT_ID;
const FS_CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET;
const FS_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FS_API_URL = 'https://platform.fatsecret.com/rest/server.api';

// Token cache per scope (24hr lifetime)
const tokenCache = {};

/**
 * Get OAuth 2.0 access token (cached, per scope)
 */
async function getAccessToken(scope = 'premier') {
  if (!FS_CLIENT_ID || !FS_CLIENT_SECRET) return null;

  const cached = tokenCache[scope];
  if (cached && Date.now() < cached.expiry) return cached.token;

  try {
    const credentials = Buffer.from(`${FS_CLIENT_ID}:${FS_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(FS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&scope=${scope}`,
    });

    if (!response.ok) {
      console.warn(`FatSecret token error (scope=${scope}): ${response.status}`);
      // Fall back to basic scope if premier fails
      if (scope === 'premier') return getAccessToken('basic');
      return null;
    }

    const data = await response.json();
    tokenCache[scope] = {
      token: data.access_token,
      expiry: Date.now() + ((data.expires_in - 300) * 1000),
    };
    return data.access_token;
  } catch (err) {
    console.warn('FatSecret auth failed:', err.message);
    return null;
  }
}

/**
 * Make authenticated API call
 */
async function apiCall(params, scope = 'premier') {
  const token = await getAccessToken(scope);
  if (!token) return null;

  try {
    const body = new URLSearchParams({ ...params, format: 'json' });
    const response = await fetch(FS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`FatSecret API error: ${response.status} for ${params.method}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn('FatSecret API call failed:', err.message);
    return null;
  }
}

// ─── Image Extraction ───────────────────────────────

/**
 * Extract best image URL from food_images array
 * Prefers 400x400 (good quality, reasonable size for mobile)
 */
function extractImageUrl(foodImages) {
  if (!foodImages) return null;
  const images = Array.isArray(foodImages.food_image)
    ? foodImages.food_image
    : foodImages.food_image ? [foodImages.food_image] : [];

  if (images.length === 0) return null;

  // Prefer 400x400 — good quality without huge size
  const url400 = images.find(i => i.image_url?.includes('400x400'));
  if (url400) return url400.image_url;

  // Fallback: pick first available
  return images[0]?.image_url || null;
}

// ─── Allergen Extraction ────────────────────────────

/**
 * Extract allergens from food.get.v4 response
 * Returns array like ['Gluten', 'Milk', 'Soy']
 */
function extractAllergens(food) {
  if (!food.allergens?.allergen) return [];
  const allergens = Array.isArray(food.allergens.allergen)
    ? food.allergens.allergen
    : [food.allergens.allergen];

  return allergens
    .filter(a => a.is_allergen === '1')
    .map(a => a.name || a.allergen_name)
    .filter(Boolean);
}

/**
 * Extract dietary preferences (vegan/vegetarian)
 */
function extractDietaryTags(food) {
  const tags = [];
  if (!food.preferences?.preference) return tags;
  const prefs = Array.isArray(food.preferences.preference)
    ? food.preferences.preference
    : [food.preferences.preference];

  for (const p of prefs) {
    if (p.is_preference === '1' && p.name) {
      tags.push(p.name);
    }
  }
  return tags;
}

// ─── Core API Methods ───────────────────────────────

/**
 * Look up a food by barcode (Premier scope)
 */
export async function lookupByBarcode(upc) {
  if (!FS_CLIENT_ID) return null;

  // Try GTIN-13 format first
  const gtin = upc.length === 12 ? '0' + upc : upc;

  let data = await apiCall({
    method: 'food.find_id_for_barcode',
    barcode: gtin,
  }, 'barcode');

  // Retry with original UPC if GTIN-13 failed
  if ((!data || data.error) && gtin !== upc) {
    data = await apiCall({
      method: 'food.find_id_for_barcode',
      barcode: upc,
    }, 'barcode');
  }

  if (!data || data.error) return null;

  const foodId = data.food_id?.value || data.food_id;
  if (!foodId) return null;

  return getFood(foodId);
}

/**
 * Get detailed food data by FatSecret food_id
 * Uses v4 for images + allergens
 */
async function getFood(foodId) {
  // Use food.get.v4 for images and allergens
  const data = await apiCall({
    method: 'food.get.v4',
    food_id: foodId,
  });

  if (!data || !data.food) {
    // Fallback to v2 if v4 not available
    const v2data = await apiCall({ method: 'food.get.v2', food_id: foodId });
    if (!v2data || !v2data.food) return null;
    return parseFoodResponse(v2data.food, foodId);
  }

  return parseFoodResponse(data.food, foodId);
}

/**
 * Parse food response (shared by v2 and v4)
 */
function parseFoodResponse(food, foodId) {
  const servings = food.servings?.serving;
  const serving = Array.isArray(servings)
    ? servings.find(s => s.is_default === '1') || servings[0]
    : servings;

  if (!serving) return null;

  // Convert per-serving to per-100g
  const metricAmount = parseFloat(serving.metric_serving_amount) || 100;
  const factor = 100 / metricAmount;

  const nutrition_facts = {
    energy_kcal_100g: round(parseFloat(serving.calories || 0) * factor),
    fat_100g: round(parseFloat(serving.fat || 0) * factor),
    saturated_fat_100g: round(parseFloat(serving.saturated_fat || 0) * factor),
    carbohydrates_100g: round(parseFloat(serving.carbohydrate || 0) * factor),
    sugars_100g: round(parseFloat(serving.sugar || 0) * factor),
    fiber_100g: round(parseFloat(serving.fiber || 0) * factor),
    proteins_100g: round(parseFloat(serving.protein || 0) * factor),
    sodium_100g: round(parseFloat(serving.sodium || 0) * factor / 1000),
    salt_100g: round(parseFloat(serving.sodium || 0) * factor * 2.5 / 1000),
  };

  // Extract image (v4+ only)
  const image_url = extractImageUrl(food.food_images);

  // Extract allergens (v4+ only)
  const allergens = extractAllergens(food);

  // Extract dietary tags (v4+ only)
  const dietary_tags = extractDietaryTags(food);

  return {
    name: food.food_name,
    brand: food.brand_name || 'Generic',
    category: food.food_type === 'Brand' ? 'Branded Food' : 'Generic Food',
    image_url,
    ingredients: '',
    nutrition_facts,
    allergens_tags: allergens,
    dietary_tags,
    is_organic: (food.food_name || '').toLowerCase().includes('organic'),
    fatsecret_food_id: food.food_id || foodId,
    source: 'fatsecret',
  };
}

/**
 * Search foods by text query
 * Uses v3 for images + allergens in results
 */
export async function searchFoods(query, maxResults = 10) {
  if (!FS_CLIENT_ID) return [];

  // Try v3 first (includes images)
  let data = await apiCall({
    method: 'foods.search.v3',
    search_expression: query,
    max_results: maxResults,
    include_food_images: 'true',
    include_food_attributes: 'true',
  });

  // Response structure for v3: data.foods_search.results.food
  let foods;
  if (data?.foods_search?.results?.food) {
    foods = data.foods_search.results.food;
  } else if (data?.foods?.food) {
    // Fallback v1 response structure
    foods = data.foods.food;
  } else {
    // Last resort: try basic foods.search
    data = await apiCall({
      method: 'foods.search',
      search_expression: query,
      max_results: maxResults,
    });
    if (!data?.foods?.food) return [];
    foods = data.foods.food;
  }

  if (!Array.isArray(foods)) foods = [foods];

  return foods.map(f => ({
    name: f.food_name,
    brand: f.brand_name || 'Generic',
    description: f.food_description,
    image_url: extractImageUrl(f.food_images),
    allergens: extractAllergens(f),
    dietary_tags: extractDietaryTags(f),
    fatsecret_food_id: f.food_id,
    source: 'fatsecret',
  }));
}

/**
 * Get just the image URL for a food_id (lightweight call)
 * Useful for backfilling images on existing products
 */
export async function getFoodImage(foodId) {
  const data = await apiCall({
    method: 'food.get.v4',
    food_id: foodId,
  });

  if (!data?.food?.food_images) return null;
  return extractImageUrl(data.food.food_images);
}

/**
 * Autocomplete search suggestions (Premier feature)
 * Returns quick suggestions as user types
 */
export async function autoComplete(query, maxResults = 8) {
  if (!FS_CLIENT_ID || !query || query.length < 2) return [];

  const data = await apiCall({
    method: 'foods.autocomplete.v2',
    expression: query,
    max_results: maxResults,
  });

  if (!data?.suggestions?.suggestion) return [];
  const suggestions = Array.isArray(data.suggestions.suggestion)
    ? data.suggestions.suggestion
    : [data.suggestions.suggestion];

  return suggestions.map(s => s.suggestion || s).filter(Boolean);
}

function round(n) {
  return Math.round(n * 100) / 100;
}
