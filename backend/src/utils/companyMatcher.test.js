import { describe, it, expect, vi } from 'vitest';

// Mock the DB pool before importing the matcher.
vi.mock('../db/init.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

const { normalizeBrand } = await import('./companyMatcher.js');

describe('normalizeBrand', () => {
  describe('basic transformation', () => {
    it('lowercases input', () => {
      expect(normalizeBrand('NESTLE')).toBe('nestle');
    });

    it('strips spaces and punctuation', () => {
      expect(normalizeBrand('Coca-Cola')).toBe('cocacola');
      expect(normalizeBrand('Ben & Jerry\'s')).toBe('benjerrys');
    });

    it('strips diacritics', () => {
      expect(normalizeBrand('Nestlé')).toBe('nestle');
      expect(normalizeBrand('Häagen-Dazs')).toBe('haagendazs');
      expect(normalizeBrand('Café Bustelo')).toBe('cafebustelo');
    });

    it('handles empty/null/undefined gracefully', () => {
      expect(normalizeBrand('')).toBe('');
      expect(normalizeBrand(null)).toBe('');
      expect(normalizeBrand(undefined)).toBe('');
    });
  });

  describe('corporate suffix stripping', () => {
    it('strips LLC', () => {
      expect(normalizeBrand('Danone US LLC')).toBe('danone');
    });

    it('strips Inc/Inc.', () => {
      expect(normalizeBrand('PepsiCo, Inc.')).toBe('pepsico');
      expect(normalizeBrand('General Mills Inc')).toBe('generalmills');
    });

    it('strips Corp / Corporation', () => {
      expect(normalizeBrand('Mondelez Corporation')).toBe('mondelez');
      expect(normalizeBrand('Target Corp')).toBe('target');
    });

    it('strips USA / US / NA', () => {
      expect(normalizeBrand('Nestlé USA')).toBe('nestle');
      expect(normalizeBrand('Unilever US')).toBe('unilever');
      expect(normalizeBrand('Kraft NA')).toBe('kraft');
    });

    it('strips "North America"', () => {
      expect(normalizeBrand('Danone North America')).toBe('danone');
      expect(normalizeBrand('Coca-Cola North-America')).toBe('cocacola');
    });

    it('strips "Brands" / "Foods" / "Group" / "Holdings"', () => {
      expect(normalizeBrand('Conagra Brands')).toBe('conagra');
      expect(normalizeBrand('Post Holdings')).toBe('post');
      expect(normalizeBrand('Kraft Foods Group')).toBe('kraft');
      expect(normalizeBrand('Tyson Foods')).toBe('tyson');
    });

    it('strips multiple suffixes', () => {
      expect(normalizeBrand('Kraft Foods Group, Inc.')).toBe('kraft');
      expect(normalizeBrand('Danone US LLC')).toBe('danone');
    });

    it('does NOT strip suffixes that are part of brand words', () => {
      // "Co" should only strip as a standalone word, not inside "Coca"
      expect(normalizeBrand('Coca-Cola')).toBe('cocacola');
      // "USA" inside "USA Today" would be stripped, which is wrong if it's a brand,
      // but our suffixes are based on word-boundary matching, so "USA" gets stripped
      // here. Acceptable trade-off for branded products in OFF where USA tends to
      // be a region qualifier.
    });
  });

  describe('apostrophe variants normalize the same', () => {
    it('treats straight, curly, and missing apostrophes identically', () => {
      // ASCII straight apostrophe
      expect(normalizeBrand("Trader Joe's")).toBe('traderjoes');
      // Unicode curly apostrophe
      expect(normalizeBrand('Trader Joe’s')).toBe('traderjoes');
      // No apostrophe at all
      expect(normalizeBrand('Trader Joes')).toBe('traderjoes');
    });
  });
});
