import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Track all pool.query calls so tests can program per-call responses
const queryResults = [];
const mockPool = {
  query: vi.fn(async () => {
    if (queryResults.length > 0) return queryResults.shift();
    return { rows: [] };
  }),
};

vi.mock('../db/init.js', () => ({ default: mockPool }));

// Mock auth middleware to optionally inject req.user
let mockUser = null;
vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    if (!mockUser) return res.status(401).json({ error: 'Unauthorized' });
    req.user = mockUser;
    next();
  },
  optionalAuth: (req, _res, next) => {
    if (mockUser) req.user = mockUser;
    next();
  },
}));

// Mock global fetch for Spoonacular calls
const originalFetch = globalThis.fetch;
let mockFetchResponse = null;
let mockFetchError = null;

beforeEach(() => {
  queryResults.length = 0;
  mockPool.query.mockClear();
  mockUser = null;
  mockFetchError = null;
  mockFetchResponse = null;

  globalThis.fetch = vi.fn(async () => {
    if (mockFetchError) throw mockFetchError;
    if (mockFetchResponse) return mockFetchResponse;
    return { ok: true, json: async () => [], text: async () => '' };
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ─── App setup ───────────────────────────────────────────────────────────────

const { default: recipeRoutes } = await import('./recipes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/recipes', recipeRoutes);
  return app;
}

// Use node:http for test client so globalThis.fetch stays mocked for Spoonacular
import http from 'node:http';

function httpRequest(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {},
      };
      if (body) {
        const data = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }

      const req = http.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          server.close();
          let parsed = null;
          try { parsed = JSON.parse(rawData); } catch {}
          resolve({ status: res.statusCode, body: parsed });
        });
      });

      req.on('error', (err) => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /recipes', () => {
  it('returns all recipes', async () => {
    const recipes = [
      { id: 1, name: 'Granola', difficulty: 'easy' },
      { id: 2, name: 'Ketchup', difficulty: 'medium' },
    ];
    queryResults.push({ rows: recipes });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Granola');
  });

  it('filters by category', async () => {
    queryResults.push({ rows: [{ id: 1, name: 'Salsa' }] });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes?category=sauces');

    expect(res.status).toBe(200);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toContain('replaces_category');
    expect(mockPool.query.mock.calls[0][1]).toContain('sauces');
  });

  it('filters by max_time', async () => {
    queryResults.push({ rows: [] });

    const app = buildApp();
    await httpRequest(app, 'GET', '/recipes?max_time=30');

    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toContain('total_time_minutes');
    expect(mockPool.query.mock.calls[0][1]).toContain(30);
  });

  it('filters by kid_friendly', async () => {
    queryResults.push({ rows: [] });

    const app = buildApp();
    await httpRequest(app, 'GET', '/recipes?kid_friendly=true');

    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toContain('kid_friendly = true');
  });

  it('returns 500 on DB error', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB down'));

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Failed');
  });
});

describe('GET /recipes/for/:upc', () => {
  it('returns recipes that replace a product or its category', async () => {
    // 1st query: product lookup
    queryResults.push({ rows: [{ category: 'cereal' }] });
    // 2nd query: recipes matching
    queryResults.push({ rows: [{ id: 10, name: 'Homemade Granola' }] });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/for/012345678905');

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Homemade Granola');
    // Verify the SQL used both UPC and category
    const sql = mockPool.query.mock.calls[1][0];
    expect(sql).toContain('replaces_products');
    expect(sql).toContain('replaces_category');
  });

  it('returns 404 when product not found', async () => {
    queryResults.push({ rows: [] });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/for/999999999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Product not found');
  });
});

describe('GET /recipes/:id', () => {
  it('returns a recipe with replaced product details', async () => {
    const recipe = {
      id: 5, name: 'Ketchup', replaces_products: ['0001', '0002'],
      instructions: ['Step 1', 'Step 2'],
    };
    // 1st query: recipe lookup
    queryResults.push({ rows: [recipe] });
    // 2nd query: products that recipe replaces
    queryResults.push({ rows: [{ upc: '0001', name: 'Heinz Ketchup', total_score: 35 }] });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/5');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Ketchup');
    expect(res.body.replaces_products_details).toHaveLength(1);
    expect(res.body.replaces_products_details[0].upc).toBe('0001');
  });

  it('returns 404 when recipe not found', async () => {
    queryResults.push({ rows: [] });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/9999');

    expect(res.status).toBe(404);
  });

  it('tracks view for authenticated user', async () => {
    mockUser = { id: 42, email: 'test@test.com' };
    const recipe = { id: 7, name: 'Hummus', replaces_products: [] };
    // 1st: recipe lookup
    queryResults.push({ rows: [recipe] });
    // 2nd: INSERT user_recipes (track view), return is_new_view=true
    queryResults.push({ rows: [{ is_new_view: true }] });
    // 3rd: UPDATE user_engagement
    queryResults.push({ rows: [] });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/7');

    expect(res.status).toBe(200);
    // Should have called 3 queries
    expect(mockPool.query).toHaveBeenCalledTimes(3);
    const trackSql = mockPool.query.mock.calls[1][0];
    expect(trackSql).toContain('user_recipes');
    const engageSql = mockPool.query.mock.calls[2][0];
    expect(engageSql).toContain('user_engagement');
  });

  it('skips engagement update for repeat views', async () => {
    mockUser = { id: 42, email: 'test@test.com' };
    const recipe = { id: 7, name: 'Hummus', replaces_products: [] };
    queryResults.push({ rows: [recipe] });
    // is_new_view = false (repeat view)
    queryResults.push({ rows: [{ is_new_view: false }] });

    const app = buildApp();
    await httpRequest(app, 'GET', '/recipes/7');

    // Should NOT have updated user_engagement (only 2 queries)
    expect(mockPool.query).toHaveBeenCalledTimes(2);
  });
});

describe('POST /recipes/:id/made', () => {
  it('requires authentication', async () => {
    mockUser = null;
    const app = buildApp();
    const res = await httpRequest(app, 'POST', '/recipes/5/made', { rating: 4 });
    expect(res.status).toBe(401);
  });

  it('tracks recipe completion with rating', async () => {
    mockUser = { id: 10, email: 'u@u.com' };
    queryResults.push({ rows: [] });

    const app = buildApp();
    const res = await httpRequest(app, 'POST', '/recipes/5/made', { rating: 5, notes: 'Great!' });

    expect(res.status).toBe(200);
    expect(res.body.tracked).toBe(true);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toContain('user_recipes');
    expect(sql).toContain('ON CONFLICT');
    expect(mockPool.query.mock.calls[0][1]).toEqual([10, '5', 5, 'Great!']);
  });
});

describe('GET /recipes/user/history', () => {
  it('requires authentication', async () => {
    mockUser = null;
    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/user/history');
    expect(res.status).toBe(401);
  });

  it('returns recipe history for authenticated user', async () => {
    mockUser = { id: 3, email: 'a@b.com' };
    queryResults.push({
      rows: [{ recipe_id: 1, name: 'Granola', viewed_at: '2024-01-01' }],
    });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/user/history');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Granola');
  });
});

describe('GET /recipes/meta/categories', () => {
  it('returns distinct categories', async () => {
    queryResults.push({
      rows: [
        { replaces_category: 'cereal' },
        { replaces_category: 'snacks' },
      ],
    });

    const app = buildApp();
    const res = await httpRequest(app, 'GET', '/recipes/meta/categories');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['cereal', 'snacks']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOONACULAR INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /recipes/spoonacular/:upc', () => {
  const SPOON_KEY = 'test-spoon-key';

  beforeEach(() => {
    process.env.SPOONACULAR_API_KEY = SPOON_KEY;
    // Cache check query always returns miss
    queryResults.push({ rows: [] });
  });

  afterEach(() => {
    delete process.env.SPOONACULAR_API_KEY;
  });

  // ── Main scan flow ──────────────────────────────────────────────────────

  describe('main scan flow', () => {
    it('parses product ingredients, calls Spoonacular, and returns enriched recipes', async () => {
      // DB: product lookup returns ingredients
      queryResults.push({
        rows: [{ ingredients: 'Enriched Flour, Sugar, Palm Oil, Cocoa, Salt' }],
      });

      // Spoonacular returns two recipes
      const spoonData = [
        {
          id: 101,
          title: 'Chocolate Cookies',
          image: 'https://img.spoon/101.jpg',
          usedIngredientCount: 3,
          missedIngredientCount: 2,
          usedIngredients: [
            { id: 1, name: 'flour', amount: 2, unit: 'cups', image: 'flour.jpg' },
            { id: 2, name: 'sugar', amount: 1, unit: 'cup', image: 'sugar.jpg' },
            { id: 3, name: 'cocoa', amount: 0.5, unit: 'cup', image: 'cocoa.jpg' },
          ],
          missedIngredients: [
            { id: 4, name: 'butter', amount: 1, unit: 'cup', image: 'butter.jpg' },
            { id: 5, name: 'eggs', amount: 2, unit: '', image: 'eggs.jpg' },
          ],
        },
        {
          id: 102,
          title: 'Sugar Cake',
          image: 'https://img.spoon/102.jpg',
          usedIngredientCount: 2,
          missedIngredientCount: 1,
          usedIngredients: [
            { id: 6, name: 'sugar', amount: 2, unit: 'cups', image: 'sugar.jpg' },
            { id: 7, name: 'flour', amount: 3, unit: 'cups', image: 'flour.jpg' },
          ],
          missedIngredients: [
            { id: 8, name: 'milk', amount: 1, unit: 'cup', image: 'milk.jpg' },
          ],
        },
      ];

      mockFetchResponse = {
        ok: true,
        json: async () => spoonData,
        text: async () => JSON.stringify(spoonData),
      };

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/012345678905');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toHaveLength(2);

      // First recipe
      const r1 = res.body.recipes[0];
      expect(r1.id).toBe(101);
      expect(r1.title).toBe('Chocolate Cookies');
      expect(r1.image).toBe('https://img.spoon/101.jpg');
      expect(r1.used_count).toBe(3);
      expect(r1.missed_count).toBe(2);
      expect(r1.ingredients).toHaveLength(5);

      // Verify ingredient structure
      const flour = r1.ingredients.find(i => i.name === 'flour');
      expect(flour.amount).toBe(2);
      expect(flour.unit).toBe('cups');
      expect(flour.is_from_product).toBe(true);

      const butter = r1.ingredients.find(i => i.name === 'butter');
      expect(butter.is_from_product).toBe(false);

      // Verify Spoonacular was called with correct params
      const fetchCall = globalThis.fetch.mock.calls[0][0];
      expect(fetchCall).toContain('api.spoonacular.com/recipes/findByIngredients');
      expect(fetchCall).toContain('apiKey=test-spoon-key');
      expect(fetchCall).toContain('enriched+flour');
      expect(fetchCall).toContain('sugar');
      expect(fetchCall).toContain('number=6');
    });

    it('strips parentheticals, special chars, and short/long ingredient tokens', async () => {
      queryResults.push({
        rows: [{
          ingredients: 'Water, Corn Syrup (High Fructose), B6, A very long ingredient name that should be filtered out because it exceeds forty characters total'
        }],
      });

      mockFetchResponse = {
        ok: true,
        json: async () => [],
        text: async () => '[]',
      };

      const app = buildApp();
      await httpRequest(app, 'GET', '/recipes/spoonacular/000000000001');

      const fetchUrl = globalThis.fetch.mock.calls[0][0];
      // "water" and "corn syrup" should be present
      expect(fetchUrl).toContain('water');
      expect(fetchUrl).toContain('corn+syrup');
      // "(High Fructose)" parenthetical stripped
      expect(fetchUrl).not.toContain('fructose');
      // "B6" is only 2 chars — filtered out
      expect(fetchUrl).not.toContain('b6');
    });

    it('caps ingredients at 15', async () => {
      const manyIngredients = Array.from({ length: 25 }, (_, i) => `ingredient${i}`).join(', ');
      queryResults.push({ rows: [{ ingredients: manyIngredients }] });

      mockFetchResponse = {
        ok: true,
        json: async () => [],
        text: async () => '[]',
      };

      const app = buildApp();
      await httpRequest(app, 'GET', '/recipes/spoonacular/000000000002');

      const fetchUrl = globalThis.fetch.mock.calls[0][0];
      const ingredientParam = new URL(fetchUrl).searchParams.get('ingredients');
      const count = ingredientParam.split(',').length;
      expect(count).toBeLessThanOrEqual(15);
    });
  });

  // ── Pantry cross-reference ──────────────────────────────────────────────

  describe('pantry cross-reference', () => {
    it('marks ingredients found in user pantry', async () => {
      mockUser = { id: 77, email: 'pantry@test.com' };

      // 1st query: product ingredients
      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar, Salt, Butter' }],
      });
      // 2nd query: pantry items
      queryResults.push({
        rows: [
          { item_name: 'organic butter' },
          { item_name: 'sea salt' },
          { item_name: 'all-purpose flour' },
        ],
      });

      const spoonData = [
        {
          id: 201,
          title: 'Shortbread',
          image: 'shortbread.jpg',
          usedIngredientCount: 2,
          missedIngredientCount: 2,
          usedIngredients: [
            { id: 1, name: 'flour', amount: 2, unit: 'cups', image: '' },
            { id: 2, name: 'sugar', amount: 1, unit: 'cup', image: '' },
          ],
          missedIngredients: [
            { id: 3, name: 'butter', amount: 1, unit: 'cup', image: '' },
            { id: 4, name: 'vanilla extract', amount: 1, unit: 'tsp', image: '' },
          ],
        },
      ];

      mockFetchResponse = {
        ok: true,
        json: async () => spoonData,
        text: async () => JSON.stringify(spoonData),
      };

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/111111111111');

      expect(res.status).toBe(200);
      const recipe = res.body.recipes[0];

      // "flour" matches "all-purpose flour" in pantry (substring match)
      const flour = recipe.ingredients.find(i => i.name === 'flour');
      expect(flour.in_pantry).toBe(true);
      expect(flour.is_from_product).toBe(true);

      // "butter" matches "organic butter" in pantry
      const butter = recipe.ingredients.find(i => i.name === 'butter');
      expect(butter.in_pantry).toBe(true);
      expect(butter.is_from_product).toBe(false);

      // "vanilla extract" not in pantry
      const vanilla = recipe.ingredients.find(i => i.name === 'vanilla extract');
      expect(vanilla.in_pantry).toBe(false);

      // "sugar" not in pantry (no match)
      const sugar = recipe.ingredients.find(i => i.name === 'sugar');
      expect(sugar.in_pantry).toBe(false);

      // have_count / need_count tally
      // flour: in_pantry=true OR is_from_product=true -> have
      // sugar: in_pantry=false, is_from_product=true -> have
      // butter: in_pantry=true, is_from_product=false -> have
      // vanilla: in_pantry=false, is_from_product=false -> need
      expect(recipe.have_count).toBe(3);
      expect(recipe.need_count).toBe(1);

      // pantry_items returned in response
      expect(res.body.pantry_items).toEqual(['organic butter', 'sea salt', 'all-purpose flour']);

      // Verify pantry query used correct user ID and status filter
      // calls[0]=cache check, calls[1]=product, calls[2]=pantry
      const pantryQuery = mockPool.query.mock.calls[2];
      expect(pantryQuery[0]).toContain('pantry_items');
      expect(pantryQuery[0]).toContain("status = 'active'");
      expect(pantryQuery[1]).toEqual([77]);
    });

    it('skips pantry lookup for unauthenticated users', async () => {
      mockUser = null;

      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar' }],
      });

      mockFetchResponse = {
        ok: true,
        json: async () => [
          {
            id: 301, title: 'Cake', image: '',
            usedIngredientCount: 1, missedIngredientCount: 1,
            usedIngredients: [{ id: 1, name: 'flour', amount: 1, unit: 'cup', image: '' }],
            missedIngredients: [{ id: 2, name: 'milk', amount: 1, unit: 'cup', image: '' }],
          },
        ],
        text: async () => '[]',
      };

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/222222222222');

      expect(res.status).toBe(200);
      // 3 DB queries: cache check + product lookup + cache write (no pantry)
      expect(mockPool.query).toHaveBeenCalledTimes(3);
      expect(res.body.pantry_items).toEqual([]);

      // All ingredients have in_pantry=false
      const recipe = res.body.recipes[0];
      recipe.ingredients.forEach(i => {
        expect(i.in_pantry).toBe(false);
      });
    });
  });

  // ── Spoonacular no-results / error fallbacks ────────────────────────────

  describe('no-results and error fallbacks', () => {
    it('returns empty recipes when Spoonacular returns empty array', async () => {
      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar, Salt' }],
      });

      mockFetchResponse = {
        ok: true,
        json: async () => [],
        text: async () => '[]',
      };

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/333333333333');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
      expect(res.body.pantry_items).toEqual([]);
    });

    it('returns empty recipes when product has no ingredients', async () => {
      queryResults.push({
        rows: [{ ingredients: null }],
      });

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/444444444444');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
      // Should NOT have called Spoonacular at all
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns empty recipes when product has empty ingredients', async () => {
      queryResults.push({
        rows: [{ ingredients: '' }],
      });

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/444444444445');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns empty recipes when product not found in DB', async () => {
      queryResults.push({ rows: [] });

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/555555555555');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns empty recipes when all parsed ingredients are too short', async () => {
      queryResults.push({
        rows: [{ ingredients: 'B6, E, Fe, Ca' }],
      });

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/666666666666');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns empty recipes when Spoonacular returns non-200', async () => {
      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar, Salt' }],
      });

      mockFetchResponse = {
        ok: false,
        status: 402,
        json: async () => ({ message: 'Payment Required' }),
        text: async () => 'Payment Required',
      };

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/777777777777');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
    });

    it('returns empty recipes when Spoonacular returns non-array', async () => {
      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar, Salt' }],
      });

      mockFetchResponse = {
        ok: true,
        json: async () => ({ error: 'bad response' }),
        text: async () => '{}',
      };

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/888888888888');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
    });

    it('returns empty recipes when Spoonacular request times out', async () => {
      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar, Salt' }],
      });

      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      mockFetchError = abortErr;

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/999999999999');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
    });

    it('returns empty recipes when Spoonacular has network error', async () => {
      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar, Salt' }],
      });

      mockFetchError = new Error('ECONNREFUSED');

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/000000000099');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toEqual([]);
    });

    it('returns 503 when SPOONACULAR_API_KEY is not configured', async () => {
      delete process.env.SPOONACULAR_API_KEY;

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/000000000000');

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('not configured');
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles recipe with missing usedIngredients/missedIngredients gracefully', async () => {
      queryResults.push({
        rows: [{ ingredients: 'Flour, Sugar' }],
      });

      mockFetchResponse = {
        ok: true,
        json: async () => [
          {
            id: 401,
            title: 'Mystery Dish',
            image: null,
            usedIngredientCount: 0,
            missedIngredientCount: 0,
            // Missing usedIngredients and missedIngredients arrays entirely
          },
        ],
        text: async () => '[]',
      };

      const app = buildApp();
      const res = await httpRequest(app, 'GET', '/recipes/spoonacular/000000000003');

      expect(res.status).toBe(200);
      expect(res.body.recipes).toHaveLength(1);
      expect(res.body.recipes[0].ingredients).toEqual([]);
      expect(res.body.recipes[0].have_count).toBe(0);
      expect(res.body.recipes[0].need_count).toBe(0);
    });

    it('handles semicolons as ingredient delimiters', async () => {
      queryResults.push({
        rows: [{ ingredients: 'Flour; Sugar; Salt' }],
      });

      mockFetchResponse = {
        ok: true,
        json: async () => [],
        text: async () => '[]',
      };

      const app = buildApp();
      await httpRequest(app, 'GET', '/recipes/spoonacular/000000000004');

      const fetchUrl = globalThis.fetch.mock.calls[0][0];
      expect(fetchUrl).toContain('flour');
      expect(fetchUrl).toContain('sugar');
      expect(fetchUrl).toContain('salt');
    });
  });
});
