import { describe, it, expect, vi } from 'vitest';

// Mock the database before importing scoring module
vi.mock('../db/init.js', () => ({
  default: {
    query: vi.fn(),
  },
}));

const HARMFUL_INGREDIENTS = [
  {
    name: 'red 40',
    aliases: '["allura red"]',
    severity: 6,
    category: 'artificial color',
    health_effects: 'Linked to hyperactivity in children',
    banned_in: '["Norway", "Austria"]',
    why_used: 'coloring',
    source_url: null,
  },
  {
    name: 'tbhq',
    aliases: null,
    severity: 8,
    category: 'preservative',
    health_effects: 'Possible carcinogen at high doses',
    banned_in: '["EU", "Japan", "Norway"]',
    why_used: 'shelf life',
    source_url: null,
  },
  {
    name: 'carrageenan',
    aliases: null,
    severity: 4,
    category: 'thickener',
    health_effects: 'Gut inflammation concerns',
    banned_in: '[]',
    why_used: 'texture',
    source_url: null,
  },
];

const COMPANIES = [
  { id: 1, name: 'TestCo', parent_company: null, behavior_score: 80, controversies: null, transparency_rating: null },
  { id: 2, name: 'BadCorp', parent_company: null, behavior_score: 20, controversies: 'Many documented issues', transparency_rating: null },
];

const BRAND_ALIASES = [
  { alias: 'goodbrand', company_id: 1, name: 'TestCo', behavior_score: 80 },
];

const pool = (await import('../db/init.js')).default;
pool.query.mockImplementation((sql) => {
  if (sql.includes('brand_aliases')) return Promise.resolve({ rows: BRAND_ALIASES });
  if (sql.includes('harmful_ingredients')) return Promise.resolve({ rows: HARMFUL_INGREDIENTS });
  if (sql.includes('FROM companies')) return Promise.resolve({ rows: COMPANIES });
  return Promise.resolve({ rows: [] });
});

const { scoreProduct } = await import('./scoring.js');

describe('scoreProduct (5-dimension model)', () => {
  describe('dimension 1: harmful ingredients (40%)', () => {
    it('returns 100 when no harmful ingredients found', async () => {
      const result = await scoreProduct({ ingredients: 'water, flour, salt' });
      expect(result.harmful_ingredients_score).toBe(100);
      expect(result.harmful_ingredients_found).toEqual([]);
      expect(result.missing_ingredients).toBe(false);
    });

    it('penalizes missing ingredient data with 30 and flags it', async () => {
      const result = await scoreProduct({ ingredients: '' });
      expect(result.harmful_ingredients_score).toBe(30);
      expect(result.missing_ingredients).toBe(true);
    });

    it('treats garbage placeholder text as missing data', async () => {
      const result = await scoreProduct({ ingredients: 'undefined' });
      expect(result.harmful_ingredients_score).toBe(30);
      expect(result.missing_ingredients).toBe(true);
    });

    it('detects a harmful ingredient by name and applies the medium-risk cap (55)', async () => {
      const result = await scoreProduct({ ingredients: 'water, sugar, red 40, salt and more things' });
      expect(result.harmful_ingredients_found.map(f => f.name)).toContain('red 40');
      expect(result.harmful_ingredients_score).toBe(55);
    });

    it('detects a harmful ingredient by alias', async () => {
      const result = await scoreProduct({ ingredients: 'water, allura red, salt plus filler' });
      expect(result.harmful_ingredients_found.map(f => f.name)).toContain('red 40');
    });

    it('applies the high-risk cap (25) for severity >= 8', async () => {
      const result = await scoreProduct({ ingredients: 'vegetable oil, tbhq, salt and water' });
      expect(result.harmful_ingredients_found.map(f => f.name)).toContain('tbhq');
      expect(result.harmful_ingredients_score).toBeLessThanOrEqual(25);
    });

    it('matches on word boundaries, not substrings', async () => {
      // "tbhqx" must not match the "tbhq" entry
      const result = await scoreProduct({ ingredients: 'water, tbhqx extract, salt crystals' });
      expect(result.harmful_ingredients_found).toEqual([]);
      expect(result.harmful_ingredients_score).toBe(100);
    });

    it('parses banned_in into an array on found ingredients', async () => {
      const result = await scoreProduct({ ingredients: 'water, sugar, red 40, salt and more things' });
      const red40 = result.harmful_ingredients_found.find(f => f.name === 'red 40');
      expect(red40.banned_in).toEqual(['Norway', 'Austria']);
    });
  });

  describe('dimension 2: banned elsewhere (20%)', () => {
    it('penalizes missing ingredient data with 35', async () => {
      const result = await scoreProduct({ ingredients: '' });
      expect(result.banned_elsewhere_score).toBe(35);
    });

    it('returns 100 for clean ingredients', async () => {
      const result = await scoreProduct({ ingredients: 'water, flour, salt' });
      expect(result.banned_elsewhere_score).toBe(100);
    });

    it('returns 100 when harmful ingredients exist but none are banned', async () => {
      const result = await scoreProduct({ ingredients: 'almond milk, carrageenan, sea salt' });
      expect(result.harmful_ingredients_found.map(f => f.name)).toContain('carrageenan');
      expect(result.banned_elsewhere_score).toBe(100);
    });

    it('deducts based on ban count scaled by severity', async () => {
      // red 40: 2 bans -> base 18, severity 6 -> penalty 10.8 -> 89
      const result = await scoreProduct({ ingredients: 'water, sugar, red 40, salt and more things' });
      expect(result.banned_elsewhere_score).toBe(89);
    });

    it('penalizes widely banned high-severity ingredients more', async () => {
      // tbhq: 3 bans -> base 25, severity 8 -> penalty 20 -> 80
      const result = await scoreProduct({ ingredients: 'vegetable oil, tbhq, salt and water' });
      expect(result.banned_elsewhere_score).toBe(80);
    });
  });

  describe('dimension 3: transparency (15%)', () => {
    it('scores 100 with complete product data', async () => {
      const result = await scoreProduct({
        ingredients: 'water, flour, salt, yeast',
        brand: 'TestCo',
        nutriscore_grade: 'b',
        image_url: 'https://example.com/img.jpg',
        allergens_tags: ['en:gluten'],
        nutriments: {
          energy_kcal_100g: 250,
          fat_100g: 5,
          'saturated-fat_100g': 2,
          sugars_100g: 3,
          fiber_100g: 4,
          proteins_100g: 8,
          sodium_100g: 0.3,
        },
      });
      expect(result.transparency_score).toBe(100);
    });

    it('scores 0 with no data at all', async () => {
      const result = await scoreProduct({});
      expect(result.transparency_score).toBe(0);
    });

    it('gives partial credit for ingredients only', async () => {
      const result = await scoreProduct({ ingredients: 'water, flour, salt' });
      expect(result.transparency_score).toBe(35);
    });
  });

  describe('dimension 4: processing (15%)', () => {
    it('maps NOVA 1 to 95', async () => {
      const result = await scoreProduct({ nova_group: 1 });
      expect(result.processing_score).toBe(95);
    });

    it('maps NOVA 4 to 15', async () => {
      const result = await scoreProduct({ nova_group: 4 });
      expect(result.processing_score).toBe(15);
    });

    it('drops NOVA 4 to 5 with 4+ ultra-processing markers', async () => {
      const result = await scoreProduct({
        nova_group: 4,
        ingredients: 'high fructose corn syrup, hydrogenated oil, maltodextrin, artificial flavor',
      });
      expect(result.processing_score).toBe(5);
    });

    it('overrides NOVA 3 to 75 for simple marker-free ingredients', async () => {
      const result = await scoreProduct({ nova_group: 3, ingredients: 'chickpeas, sea salt' });
      expect(result.processing_score).toBe(75);
    });

    it('softens NOVA 4 to 50 when no additive markers and a short ingredient list', async () => {
      const result = await scoreProduct({ nova_group: 4, ingredients: 'almonds, sea salt' });
      expect(result.processing_score).toBe(50);
    });

    it('keeps NOVA 4 at 15 when an additive marker is present', async () => {
      // sunflower lecithin (emulsifier) is a recognized marker → no softening
      const result = await scoreProduct({ nova_group: 4, ingredients: 'peanuts, cane sugar, sunflower lecithin' });
      expect(result.processing_score).toBe(15);
    });

    it('returns 35 when neither NOVA nor ingredients are available', async () => {
      const result = await scoreProduct({});
      expect(result.processing_score).toBe(35);
    });

    it('infers high score from short clean ingredient list without NOVA', async () => {
      const result = await scoreProduct({ ingredients: 'water, salt' });
      expect(result.processing_score).toBe(85);
    });

    it('infers low score from ultra-processing markers without NOVA', async () => {
      const result = await scoreProduct({ ingredients: 'maltodextrin, polysorbate, water' });
      expect(result.processing_score).toBe(40);
    });
  });

  describe('dimension 5: company behavior (10%)', () => {
    it('returns neutral 50 for unknown brands', async () => {
      const result = await scoreProduct({ brand: 'Totally Unmatched Zzz' });
      expect(result.company_behavior_score).toBe(50);
    });

    it('returns neutral 50 when brand is missing', async () => {
      const result = await scoreProduct({});
      expect(result.company_behavior_score).toBe(50);
    });

    it('matches via brand_aliases after normalizing corporate suffixes', async () => {
      const result = await scoreProduct({ brand: 'GoodBrand LLC' });
      expect(result.company_behavior_score).toBe(80);
      expect(result.company_name).toBe('TestCo');
    });

    it('falls back to companies-table matching', async () => {
      const result = await scoreProduct({ brand: 'BadCorp' });
      expect(result.company_behavior_score).toBe(20);
      expect(result.company_name).toBe('BadCorp');
    });
  });

  describe('display-only data', () => {
    it('passes through nutriscore grade and NOVA group without affecting dimensions', async () => {
      const result = await scoreProduct({ ingredients: 'water, flour, salt', nutriscore_grade: 'e', nova_group: 2 });
      expect(result.nutriscore_grade).toBe('e');
      expect(result.nova_group).toBe(2);
      // Nutri-Score must not drive the harmful-ingredients dimension
      expect(result.harmful_ingredients_score).toBe(100);
    });

    it('detects organic from the is_organic flag', async () => {
      const result = await scoreProduct({ is_organic: true });
      expect(result.is_organic).toBe(true);
    });

    it('detects organic from labels', async () => {
      const result = await scoreProduct({ labels: ['en:organic'] });
      expect(result.is_organic).toBe(true);
    });

    it('detects USDA organic from labels', async () => {
      const result = await scoreProduct({ labels: ['en:usda-organic'] });
      expect(result.is_organic).toBe(true);
    });

    it('is not organic for unrelated labels or missing labels', async () => {
      expect((await scoreProduct({ labels: ['en:vegan'] })).is_organic).toBe(false);
      expect((await scoreProduct({})).is_organic).toBe(false);
    });
  });

  describe('allergen extraction', () => {
    it('maps known allergen tags', async () => {
      const result = await scoreProduct({
        allergens_tags: ['en:milk', 'en:gluten', 'en:peanuts'],
      });
      expect(result.allergens_tags).toContain('Milk');
      expect(result.allergens_tags).toContain('Gluten');
      expect(result.allergens_tags).toContain('Peanuts');
    });

    it('handles unknown allergens by title-casing', async () => {
      const result = await scoreProduct({
        allergens_tags: ['en:some-weird-thing'],
      });
      expect(result.allergens_tags).toContain('Some Weird Thing');
    });

    it('deduplicates allergens', async () => {
      const result = await scoreProduct({
        allergens_tags: ['en:milk', 'en:milk'],
      });
      expect(result.allergens_tags.filter(a => a === 'Milk')).toHaveLength(1);
    });

    it('handles empty/null allergen tags', async () => {
      const result = await scoreProduct({ allergens_tags: [] });
      expect(result.allergens_tags).toEqual([]);

      const result2 = await scoreProduct({});
      expect(result2.allergens_tags).toEqual([]);
    });
  });

  describe('nutrition facts extraction', () => {
    it('extracts and rounds nutrient values', async () => {
      const result = await scoreProduct({
        nutriments: {
          energy_kcal_100g: 245.7,
          fat_100g: 12.34,
          sugars_100g: 8.67,
          proteins_100g: 5.55,
          sodium_100g: 0.4,
          'saturated-fat_100g': 3.33,
        },
      });
      expect(result.nutrition_facts.calories).toBe(246);
      expect(result.nutrition_facts.fat).toBe(12.3);
      expect(result.nutrition_facts.sugars).toBe(8.7);
      expect(result.nutrition_facts.protein).toBe(5.6);
      expect(result.nutrition_facts.sodium).toBe(400);
      expect(result.nutrition_facts.saturated_fat).toBe(3.3);
    });

    it('returns empty object when no nutriments', async () => {
      const result = await scoreProduct({});
      expect(result.nutrition_facts).toEqual({});
    });
  });

  describe('return structure', () => {
    it('returns all five dimension scores plus display data', async () => {
      const result = await scoreProduct({
        ingredients: 'water, sugar',
        brand: 'TestCo',
        nutriscore_grade: 'b',
      });
      expect(result).toHaveProperty('harmful_ingredients_score');
      expect(result).toHaveProperty('banned_elsewhere_score');
      expect(result).toHaveProperty('transparency_score');
      expect(result).toHaveProperty('processing_score');
      expect(result).toHaveProperty('company_behavior_score');
      expect(result).toHaveProperty('missing_ingredients');
      expect(result).toHaveProperty('harmful_ingredients_found');
      expect(result).toHaveProperty('nutrition_facts');
      expect(result).toHaveProperty('nutriscore_grade');
      expect(result).toHaveProperty('nova_group');
      expect(result).toHaveProperty('is_organic');
      expect(result).toHaveProperty('allergens_tags');
      expect(result).toHaveProperty('company_name');
      expect(result).toHaveProperty('company_controversies');
    });

    it('does not return legacy 3-dimension fields', async () => {
      const result = await scoreProduct({ ingredients: 'water, sugar' });
      expect(result).not.toHaveProperty('nutrition_score');
      expect(result).not.toHaveProperty('additives_score');
      expect(result).not.toHaveProperty('organic_bonus');
    });

    it('keeps every dimension score within 0-100', async () => {
      const result = await scoreProduct({
        ingredients: 'high fructose corn syrup, tbhq, red 40, allura red, carrageenan',
        nova_group: 4,
      });
      for (const key of [
        'harmful_ingredients_score', 'banned_elsewhere_score', 'transparency_score',
        'processing_score', 'company_behavior_score',
      ]) {
        expect(result[key]).toBeGreaterThanOrEqual(0);
        expect(result[key]).toBeLessThanOrEqual(100);
      }
    });
  });
});
