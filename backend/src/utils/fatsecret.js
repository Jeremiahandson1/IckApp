// ═══════════════════════════════════════════
// FatSecret Platform API Integration
// Free Basic: 5,000 calls/day, foods.search + food.get
// Premier Free (startups): adds barcode lookup
// https://platform.fatsecret.com/api-editions
// ═══════════════════════════════════════════
import fetch from 'node-fetch';

const FS_CLIENT_ID = process.env.FATSECRET_CLIENT_ID;
const FS_CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET;
const FS_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FS_API_URL = 'https://platform.fatsecret.com/rest/server.api';

// Token cache (24hr lifetime)
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get OAuth 2.0 access token (cached for 24hrs)
 */
async function getAccessToken(scope = 'basic') {
  if (!FS_CLIENT_ID || !FS_CLIENT_SECRET) return null;

  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

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
      console.warn(`FatSecret token error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    cachedToken = data.access_token;
    // Expire 5 min early to be safe
    tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);
    return cachedToken;
  } catch (err) {
    console.warn('FatSecret auth failed:', err.message);
    return null;
  }
}

/**
 * Make authenticated API call
 */
async function apiCall(params, scope = 'basic') {
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
    });

    if (!response.ok) {
      console.warn(`FatSecret API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn('FatSecret API call failed:', err.message);
    return null;
  }
}

/**
 * Look up a food by barcode (REQUIRES Premier scope)
 * Returns food_id which can then be used with getFood()
 */
export async function lookupByBarcode(upc) {
  if (!FS_CLIENT_ID) return null;

  // GTIN-13 format
  const gtin = upc.length === 12 ? '0' + upc : upc;

  const data = await apiCall({
    method: 'food.find_id_for_barcode',
    barcode: gtin,
  }, 'barcode');

  if (!data || data.error) {
    // Try with original UPC
    if (gtin !== upc) {
      const retry = await apiCall({
        method: 'food.find_id_for_barcode',
        barcode: upc,
      }, 'barcode');
      if (!retry || retry.error) return null;
      return getFood(retry.food_id?.value || retry.food_id);
    }
    return null;
  }

  const foodId = data.food_id?.value || data.food_id;
  if (!foodId) return null;

  return getFood(foodId);
}

/**
 * Get detailed food data by FatSecret food_id
 */
async function getFood(foodId) {
  const data = await apiCall({
    method: 'food.get.v2',
    food_id: foodId,
  });

  if (!data || !data.food) return null;

  const food = data.food;
  const servings = food.servings?.serving;
  
  // Get the default serving or first one
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
    sodium_100g: round(parseFloat(serving.sodium || 0) * factor / 1000), // mg → g
    salt_100g: round(parseFloat(serving.sodium || 0) * factor * 2.5 / 1000),
  };

  return {
    name: food.food_name,
    brand: food.brand_name || 'Generic',
    category: food.food_type === 'Brand' ? 'Branded Food' : 'Generic Food',
    image_url: null,
    ingredients: '', // FatSecret basic doesn't return ingredients
    nutrition_facts,
    allergens_tags: [],
    is_organic: (food.food_name || '').toLowerCase().includes('organic'),
    fatsecret_food_id: food.food_id,
    source: 'fatsecret',
  };
}

/**
 * Search foods by text query (works on Basic free tier)
 */
export async function searchFoods(query, maxResults = 10) {
  if (!FS_CLIENT_ID) return [];

  const data = await apiCall({
    method: 'foods.search',
    search_expression: query,
    max_results: maxResults,
  });

  if (!data || !data.foods?.food) return [];

  const foods = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];

  return foods.map(f => ({
    name: f.food_name,
    brand: f.brand_name || 'Generic',
    description: f.food_description,
    fatsecret_food_id: f.food_id,
    source: 'fatsecret',
  }));
}

function round(n) {
  return Math.round(n * 100) / 100;
}
