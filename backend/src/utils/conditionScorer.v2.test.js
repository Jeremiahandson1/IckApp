import { describe, it, expect } from 'vitest';
import { scoreForCondition, RULES_VERSION } from './conditionScorer.v2.js';

// Helper: build a product with given ingredients + nutrition_facts (per 100g)
function product(ingredients, nf = {}) {
  return { ingredients, nutrition_facts: nf };
}

describe('conditionScorer.v2', () => {
  it('exports a rules version', () => {
    expect(RULES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // ── CELIAC ──
  describe('celiac', () => {
    it('flags wheat as unsafe', () => {
      const r = scoreForCondition(product('wheat flour, sugar, salt'), 'celiac');
      expect(r.score).toBe(0);
      expect(r.flags.some(f => f.severity === 'avoid')).toBe(true);
    });

    it('flags barley malt as unsafe', () => {
      const r = scoreForCondition(product('rice, sugar, barley malt extract'), 'celiac');
      expect(r.score).toBe(0);
    });

    it('flags rye as unsafe', () => {
      const r = scoreForCondition(product('rye flour, water, salt'), 'celiac');
      expect(r.score).toBe(0);
    });

    it('penalizes conventional oats for cross-contamination', () => {
      const r = scoreForCondition(product('rolled oats, sugar, salt'), 'celiac');
      expect(r.score).toBeLessThan(100);
      expect(r.score).toBeGreaterThan(0);
      expect(r.flags.some(f => f.severity === 'warn')).toBe(true);
    });

    it('does not penalize certified gluten-free oats', () => {
      const r = scoreForCondition(
        product('certified gluten-free oats, sugar, salt'),
        'celiac',
      );
      expect(r.score).toBe(100);
    });

    it('penalizes ambiguous modified food starch', () => {
      const r = scoreForCondition(product('rice, modified food starch, salt'), 'celiac');
      expect(r.score).toBeLessThan(100);
      expect(r.score).toBeGreaterThan(0);
    });

    it('returns null score when ingredients are missing', () => {
      const r = scoreForCondition({ ingredients: '', nutrition_facts: {} }, 'celiac');
      expect(r.score).toBeNull();
      expect(r.dataQuality).toBe('missing_ingredients');
    });

    it('rewards GF certification', () => {
      const r = scoreForCondition(
        product('rice flour, sugar, certified gluten-free'),
        'celiac',
      );
      expect(r.score).toBe(100);
    });
  });

  // ── HEART ──
  describe('heart', () => {
    it('heavily penalizes trans fat', () => {
      const r = scoreForCondition(product('flour, oil', { trans_fat: 1.5 }), 'heart');
      expect(r.score).toBeLessThanOrEqual(70);
    });

    it('penalizes partially hydrogenated oil even with 0g trans', () => {
      const r = scoreForCondition(
        product('flour, partially hydrogenated soybean oil', { trans_fat: 0 }),
        'heart',
      );
      expect(r.score).toBeLessThanOrEqual(70);
    });

    it('heavily penalizes very high sodium per 100g', () => {
      const r = scoreForCondition(product('salt, water', { sodium: 1500 }), 'heart');
      expect(r.score).toBeLessThanOrEqual(80);
    });

    it('rewards salmon (omega-3 source)', () => {
      const r = scoreForCondition(
        product('salmon, water, salt', { saturated_fat: 1, sodium: 200 }),
        'heart',
      );
      expect(r.flags.some(f => f.severity === 'good')).toBe(true);
    });

    it('penalizes processed meat', () => {
      const r = scoreForCondition(product('pork, salt, sodium nitrite, bacon'), 'heart');
      expect(r.flags.some(f => /processed meat/i.test(f.reason || ''))).toBe(true);
      expect(r.score).toBeLessThan(100);
    });

    it('rewards low-sodium + low-saturated-fat product', () => {
      const r = scoreForCondition(
        product('water, oats, cinnamon', {
          sodium: 50, saturated_fat: 0.5, fiber: 4,
        }),
        'heart',
      );
      expect(r.score).toBeGreaterThan(100 - 5); // bonuses can push >100, clamped to 100
    });
  });

  // ── DIABETES ──
  describe('diabetes', () => {
    it('penalizes high added sugar', () => {
      const r = scoreForCondition(
        product('sugar, flour', { added_sugars: 30, carbs: 80 }),
        'diabetes',
      );
      expect(r.score).toBeLessThanOrEqual(70);
    });

    it('rewards high fiber + low-carb-to-fiber ratio', () => {
      const r = scoreForCondition(
        product('chia seeds, water', { carbs: 40, fiber: 30, added_sugars: 0 }),
        'diabetes',
      );
      expect(r.score).toBeGreaterThanOrEqual(100);
    });

    it('flags refined-carb pattern (high carbs, low fiber)', () => {
      const r = scoreForCondition(
        product('white flour, water', { carbs: 70, fiber: 1, added_sugars: 0 }),
        'diabetes',
      );
      expect(r.flags.some(f => /low fiber/i.test(f.reason || ''))).toBe(true);
    });

    it('does not give cinnamon a points bonus (v1 bug fixed)', () => {
      const r = scoreForCondition(
        product('flour, sugar, cinnamon', { added_sugars: 8, carbs: 30, fiber: 1 }),
        'diabetes',
      );
      expect(r.flags.some(f => /cinnamon/i.test(f.reason || ''))).toBe(false);
    });

    it('does not single out HFCS vs sucrose (v1 bug fixed)', () => {
      const r = scoreForCondition(
        product('water, high fructose corn syrup', { added_sugars: 12 }),
        'diabetes',
      );
      // Penalized as sugar, not double-penalized as HFCS
      expect(r.flags.filter(f => f.severity === 'warn' || f.severity === 'avoid').length).toBeLessThanOrEqual(2);
    });
  });

  // ── KIDNEY ──
  describe('kidney', () => {
    it('penalizes phosphate additives at any stage', () => {
      const r = scoreForCondition(
        product('water, sodium phosphate, citric acid', {}),
        'kidney',
        'general',
      );
      expect(r.score).toBeLessThan(100);
      expect(r.flags.some(f => /phosphate/i.test(f.reason || ''))).toBe(true);
    });

    it('does NOT penalize spinach at "general" stage (v1 bug fixed)', () => {
      const r = scoreForCondition(
        product('spinach, water', { sodium: 50 }),
        'kidney',
        'general',
      );
      // Spinach should not be flagged unless stage is 'stones'
      expect(r.flags.some(f => /oxalate/i.test(f.reason || ''))).toBe(false);
    });

    it('penalizes high potassium ONLY when stage is ckd-3-4 or dialysis', () => {
      const generalScore = scoreForCondition(
        product('banana puree', { potassium: 500, sodium: 5 }),
        'kidney',
        'general',
      ).score;
      const ckdScore = scoreForCondition(
        product('banana puree', { potassium: 500, sodium: 5 }),
        'kidney',
        'ckd-3-4',
      ).score;
      expect(generalScore).toBeGreaterThan(ckdScore);
    });

    it('rewards protein on dialysis stage', () => {
      const r = scoreForCondition(
        product('egg whites', { protein: 11, sodium: 100 }),
        'kidney',
        'dialysis',
      );
      expect(r.flags.some(f => f.severity === 'good' && /protein/i.test(f.reason || ''))).toBe(true);
    });

    it('flags oxalate only for stones subtype', () => {
      const r = scoreForCondition(
        product('spinach, water', { sodium: 50 }),
        'kidney',
        'stones',
      );
      expect(r.flags.some(f => /oxalate/i.test(f.reason || ''))).toBe(true);
    });
  });

  // ── THYROID ──
  describe('thyroid', () => {
    it('hypo: does NOT deduct points for soy lecithin (v1 bug fixed)', () => {
      const r = scoreForCondition(
        product('water, soy lecithin, salt'),
        'thyroid',
        'hypo',
      );
      expect(r.score).toBe(100);
    });

    it('hypo: does NOT deduct for iodized salt (v1 bug fixed)', () => {
      const r = scoreForCondition(
        product('water, iodized salt'),
        'thyroid',
        'hypo',
      );
      expect(r.score).toBe(100);
    });

    it("hashimotos: does NOT deduct for wheat in absence of celiac (v1 bug fixed)", () => {
      const r = scoreForCondition(
        product('wheat flour, water, salt'),
        'thyroid',
        'hashimotos',
      );
      expect(r.score).toBe(100);
    });

    it('hypo: informational flag for soy protein isolate (med-timing)', () => {
      const r = scoreForCondition(
        product('water, soy protein isolate'),
        'thyroid',
        'hypo',
      );
      expect(r.flags.some(f => f.severity === 'info' && /levothyroxine/i.test(f.reason || ''))).toBe(true);
      expect(r.score).toBe(100);
    });

    it('hyper: heavily penalizes kelp (high iodine)', () => {
      const r = scoreForCondition(
        product('water, kelp powder, salt'),
        'thyroid',
        'hyper',
      );
      expect(r.score).toBeLessThanOrEqual(75);
    });

    it('hyper: penalizes added iodine', () => {
      const r = scoreForCondition(
        product('water, potassium iodide'),
        'thyroid',
        'hyper',
      );
      expect(r.score).toBeLessThan(100);
    });
  });

  // ── Result shape ──
  describe('result shape', () => {
    it('includes rulesVersion and disclaimer', () => {
      const r = scoreForCondition(product('water'), 'celiac');
      expect(r.rulesVersion).toBe(RULES_VERSION);
      expect(typeof r.disclaimer).toBe('string');
      expect(r.disclaimer.length).toBeGreaterThan(20);
    });

    it('flag objects carry source citations', () => {
      const r = scoreForCondition(product('wheat flour'), 'celiac');
      const avoidFlag = r.flags.find(f => f.severity === 'avoid');
      expect(avoidFlag).toBeDefined();
      expect(avoidFlag.source).toBeTruthy();
    });
  });
});
