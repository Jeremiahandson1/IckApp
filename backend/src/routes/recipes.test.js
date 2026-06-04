import { describe, it, expect, vi, beforeEach } from 'vitest';
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

beforeEach(() => {
  queryResults.length = 0;
  mockPool.query.mockClear();
  mockUser = null;
});

// ─── App setup ───────────────────────────────────────────────────────────────

const { default: recipeRoutes } = await import('./recipes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/recipes', recipeRoutes);
  return app;
}

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
