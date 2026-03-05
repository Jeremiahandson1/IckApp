import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database before importing scoring module
vi.mock('../db/init.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

const { scoreProduct, scoreProductLegacy } = await import('./scoring.js');

describe('scoreProduct', () => {
  describe('nutrition score from Nutri-Score grade', () => {
    it('maps grade A to 95', async () => {
      const result = await scoreProduct({ nutriscore_grade: 'a' });
      expect(result.nutrition_score).toBe(95);
    });

    it('maps grade B to 75', async () => {
      const result = await scoreProduct({ nutriscore_grade: 'b' });
      expect(result.nutrition_score).toBe(75);
    });

    it('maps grade C to 50', async () => {
      const result = await scoreProduct({ nutriscore_grade: 'c' });
      expect(result.nutrition_score).toBe(50);
    });

    it('maps grade D to 25', async () => {
      const result = await scoreProduct({ nutriscore_grade: 'd' });
      expect(result.nutrition_score).toBe(25);
    });

    it('maps grade E to 10', async () => {
      const result = await scoreProduct({ nutriscore_grade: 'e' });
      expect(result.nutrition_score).toBe(10);
    });

    it('handles uppercase grades', async () => {
      const result = await scoreProduct({ nutriscore_grade: 'A' });
      expect(result.nutrition_score).toBe(95);
    });

    it('defaults to 50 when no grade or nutriments', async () => {
      const result = await scoreProduct({});
      expect(result.nutrition_score).toBe(50);
    });
  });

  describe('nutrition score from raw nutriments', () => {
    it('scores a healthy product highly', async () => {
      const result = await scoreProduct({
        nutriments: {
          energy_kcal_100g: 50,
          sugars_100g: 2,
          'saturated-fat_100g': 0.5,
          sodium_100g: 0.05,
          fiber_100g: 5,
          proteins_100g: 10,
        },
      });
      expect(result.nutrition_score).toBeGreaterThan(70);
    });

    it('scores an unhealthy product low', async () => {
      const result = await scoreProduct({
        nutriments: {
          energy_kcal_100g: 500,
          sugars_100g: 40,
          'saturated-fat_100g': 15,
          sodium_100g: 1.5,
          fiber_100g: 0,
          proteins_100g: 1,
        },
      });
      expect(result.nutrition_score).toBeLessThan(40);
    });

    it('requires at least 3 data points', async () => {
      const result = await scoreProduct({
        nutriments: {
          energy_kcal_100g: 100,
          sugars_100g: 5,
        },
      });
      // Falls back to default 50 since < 3 data points
      expect(result.nutrition_score).toBe(50);
    });
  });

  describe('NOVA group adjustment', () => {
    it('gives +5 bonus for NOVA group 1 (unprocessed)', async () => {
      const base = await scoreProduct({ nutriscore_grade: 'c' });
      const withNova = await scoreProduct({ nutriscore_grade: 'c', nova_group: 1 });
      expect(withNova.nutrition_score).toBe(base.nutrition_score + 5);
    });

    it('gives -10 penalty for NOVA group 4 (ultra-processed)', async () => {
      const base = await scoreProduct({ nutriscore_grade: 'c' });
      const withNova = await scoreProduct({ nutriscore_grade: 'c', nova_group: 4 });
      expect(withNova.nutrition_score).toBe(base.nutrition_score - 10);
    });

    it('clamps to 0-100 range', async () => {
      const result = await scoreProduct({ nutriscore_grade: 'e', nova_group: 4 });
      expect(result.nutrition_score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('additives score', () => {
    it('returns 100 when no harmful ingredients found', async () => {
      const result = await scoreProduct({ ingredients: 'water, flour, salt' });
      expect(result.additives_score).toBe(100);
      expect(result.harmful_ingredients_found).toEqual([]);
    });

    it('returns 75 when ingredients are too short', async () => {
      const result = await scoreProduct({ ingredients: '' });
      expect(result.additives_score).toBe(75);
    });
  });

  describe('organic detection', () => {
    it('returns 100 when is_organic flag is true', async () => {
      const result = await scoreProduct({ is_organic: true });
      expect(result.organic_bonus).toBe(100);
      expect(result.is_organic).toBe(true);
    });

    it('detects organic from labels', async () => {
      const result = await scoreProduct({ labels: ['en:organic'] });
      expect(result.organic_bonus).toBe(100);
      expect(result.is_organic).toBe(true);
    });

    it('detects USDA organic from labels', async () => {
      const result = await scoreProduct({ labels: ['en:usda-organic'] });
      expect(result.organic_bonus).toBe(100);
    });

    it('returns 0 when not organic', async () => {
      const result = await scoreProduct({ labels: ['en:vegan'] });
      expect(result.organic_bonus).toBe(0);
      expect(result.is_organic).toBe(false);
    });

    it('handles missing labels', async () => {
      const result = await scoreProduct({});
      expect(result.organic_bonus).toBe(0);
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
    it('returns all expected fields', async () => {
      const result = await scoreProduct({
        ingredients: 'water, sugar',
        brand: 'TestBrand',
        nutriscore_grade: 'b',
      });
      expect(result).toHaveProperty('nutrition_score');
      expect(result).toHaveProperty('additives_score');
      expect(result).toHaveProperty('organic_bonus');
      expect(result).toHaveProperty('harmful_ingredients_found');
      expect(result).toHaveProperty('nutrition_facts');
      expect(result).toHaveProperty('nutriscore_grade');
      expect(result).toHaveProperty('nova_group');
      expect(result).toHaveProperty('is_organic');
      expect(result).toHaveProperty('allergens_tags');
      expect(result).toHaveProperty('company_name');
      expect(result).toHaveProperty('company_controversies');
    });
  });

  describe('scoreProductLegacy', () => {
    it('wraps scoreProduct with ingredients and brand', async () => {
      const result = await scoreProductLegacy('water, flour', 'TestBrand', 'snacks');
      expect(result).toHaveProperty('nutrition_score');
      expect(result).toHaveProperty('additives_score');
    });
  });
});
