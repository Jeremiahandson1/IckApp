import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const queryResults = [];
const mockPool = {
  query: vi.fn(async () => {
    if (queryResults.length > 0) return queryResults.shift();
    return { rows: [] };
  }),
};

vi.mock('../db/init.js', () => ({ default: mockPool }));

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

vi.mock('../middleware/subscription.js', () => ({
  requirePremium: (_req, _res, next) => next(),
}));

// Mock the OpenAI call at the fetch boundary
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Build an OpenAI-shaped chat completion response around a content string
function openAIResponse(content) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

beforeEach(() => {
  queryResults.length = 0;
  mockPool.query.mockClear();
  mockFetch.mockReset();
  mockUser = { id: 'user-1', email: 'test@test.com' };
  process.env.OPENAI_API_KEY = 'sk-test';
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

// ─── App setup ───────────────────────────────────────────────────────────────

const { default: pantryRoutes } = await import('./pantry.js');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/pantry', pantryRoutes);
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

describe('POST /pantry/photo-scan', () => {
  it('requires authentication', async () => {
    mockUser = null;
    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', { images_base64: ['abc'] });
    expect(res.status).toBe(401);
  });

  it('rejects a missing images array', async () => {
    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('images_base64');
  });

  it('rejects an empty images array', async () => {
    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', { images_base64: [] });
    expect(res.status).toBe(400);
  });

  it('rejects more than 4 images', async () => {
    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', {
      images_base64: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Maximum 4');
  });

  it('returns 503 when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', { images_base64: ['abc'] });
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('not configured');
  });

  it('identifies, matches, and returns items from a GPT response', async () => {
    mockFetch.mockResolvedValueOnce(openAIResponse(
      // Markdown fences included on purpose — the route must strip them
      '```json\n' + JSON.stringify({
        items: [
          { brand: 'Jif', item_name: 'Creamy Peanut Butter', quantity: 2, confidence: 'high', category: 'pantry_staple' },
          { brand: null, item_name: 'Mystery Sauce', quantity: 1, confidence: 'low', category: 'other' },
        ],
      }) + '\n```'
    ));
    // FTS match for item 1 → hit
    queryResults.push({
      rows: [{ id: 7, upc: '0051500255650', name: 'Peanut Butter Spread', brand: 'Jif', total_score: 51, image_url: null, rank: 0.5 }],
    });
    // FTS match for item 2 → no hit
    queryResults.push({ rows: [] });

    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', {
      images_base64: ['img1', 'img2'],
    });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);

    const [matched, unmatched] = res.body.items;
    expect(matched.matched).toBe(true);
    expect(matched.upc).toBe('0051500255650');
    expect(matched.product_id).toBe(7);
    expect(matched.product.name).toBe('Peanut Butter Spread');
    expect(matched.match_confidence).toBe('high');
    expect(matched.quantity).toBe(2);

    expect(unmatched.matched).toBe(false);
    expect(unmatched.upc).toBeNull();
    expect(unmatched.match_confidence).toBe('none');

    expect(res.body.summary).toEqual({
      photos_analyzed: 2,
      total_items: 2,
      matched: 1,
      unmatched: 1,
    });

    // The OpenAI request must carry both images and the vision model
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.model).toBe('gpt-4o');
    const imageParts = sentBody.messages[0].content.filter(c => c.type === 'image_url');
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0].image_url.url).toContain('img1');
  });

  it('normalizes bad quantities and confidence values, skips nameless items', async () => {
    mockFetch.mockResolvedValueOnce(openAIResponse(JSON.stringify({
      items: [
        { brand: 'X', item_name: 'Thing A', quantity: 0, confidence: 'certain!!' },
        { brand: 'Y', item_name: 'Thing B', quantity: '3', confidence: 'medium' },
        { brand: 'Z', item_name: null, quantity: 1, confidence: 'high' },
      ],
    })));
    queryResults.push({ rows: [] });
    queryResults.push({ rows: [] });

    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', { images_base64: ['a'] });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2); // nameless item dropped
    expect(res.body.items[0].quantity).toBe(1); // 0 → floor of 1
    expect(res.body.items[0].ai_confidence).toBe('low'); // unknown value → low
    expect(res.body.items[1].quantity).toBe(3); // string coerced
    expect(res.body.items[1].ai_confidence).toBe('medium');
  });

  it('returns items unmatched when the FTS lookup errors', async () => {
    mockFetch.mockResolvedValueOnce(openAIResponse(JSON.stringify({
      items: [{ brand: 'A', item_name: 'Something', quantity: 1, confidence: 'high' }],
    })));
    mockPool.query.mockRejectedValueOnce(new Error('FTS exploded'));

    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', { images_base64: ['a'] });

    expect(res.status).toBe(200);
    expect(res.body.items[0].matched).toBe(false);
  });

  it('returns 422 when GPT returns unparseable content', async () => {
    mockFetch.mockResolvedValueOnce(openAIResponse('I see some food but cannot list it as JSON, sorry!'));

    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', { images_base64: ['a'] });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Could not read');
  });

  it('returns 502 when the OpenAI API errors', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'rate limited' });

    const res = await httpRequest(buildApp(), 'POST', '/pantry/photo-scan', { images_base64: ['a'] });

    expect(res.status).toBe(502);
  });
});
