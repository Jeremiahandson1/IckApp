import { describe, it, expect } from 'vitest';
import { upcVariants, canonicalUpc, upcMatchClause } from './upc.js';

describe('upcVariants', () => {
  // The real failure this fixes: Chippewa Spring Water prints as 12-digit
  // UPC-A but is stored zero-padded to EAN-13, so exact matching missed it.
  it('matches a scanned 12-digit UPC-A against the stored EAN-13 form', () => {
    const variants = upcVariants('072891005006');
    expect(variants).toContain('072891005006');
    expect(variants).toContain('0072891005006');
  });

  it('matches a stored EAN-13 against a scanned 12-digit code', () => {
    const variants = upcVariants('0072891005006');
    expect(variants).toContain('0072891005006');
    expect(variants).toContain('072891005006');
  });

  it('puts the code exactly as given first, so exact hits win over re-paddings', () => {
    expect(upcVariants('072891005006')[0]).toBe('072891005006');
    expect(upcVariants('0072891005006')[0]).toBe('0072891005006');
  });

  it('covers GTIN-14 in both directions', () => {
    expect(upcVariants('072891005006')).toContain('00072891005006');
    expect(upcVariants('00072891005006')).toContain('0072891005006');
  });

  it('never strips digits that are part of the real code', () => {
    // A genuine EAN-13 with no leading zero has nothing to trim, so no variant
    // may be shorter than the input. (Padding upward to GTIN-14 is fine.)
    const variants = upcVariants('5449000000996');
    expect(variants[0]).toBe('5449000000996');
    expect(variants.some(v => v.length < 13)).toBe(false);
  });

  it('never trims below EAN-8', () => {
    for (const v of upcVariants('00000012345670')) {
      expect(v.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('handles EAN-8 and pads it upward only', () => {
    const variants = upcVariants('00012345');
    expect(variants[0]).toBe('00012345');
    expect(variants).toContain('000000012345');
  });

  it('strips separators from a hand-typed code', () => {
    expect(upcVariants('0-72891-00500-6')).toContain('072891005006');
  });

  it('deduplicates', () => {
    const variants = upcVariants('0072891005006');
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('returns empty for null/empty input', () => {
    expect(upcVariants(null)).toEqual([]);
    expect(upcVariants('')).toEqual([]);
    expect(upcVariants(undefined)).toEqual([]);
  });
});

describe('canonicalUpc', () => {
  it('pads UPC-A to the EAN-13 form Open Food Facts uses', () => {
    expect(canonicalUpc('072891005006')).toBe('0072891005006');
  });

  it('leaves an EAN-13 alone', () => {
    expect(canonicalUpc('0072891005006')).toBe('0072891005006');
    expect(canonicalUpc('5449000000996')).toBe('5449000000996');
  });

  it('strips separators', () => {
    expect(canonicalUpc('0-72891-00500-6')).toBe('0072891005006');
  });
});

describe('upcMatchClause', () => {
  it('builds an ANY() clause with priority ordering', () => {
    const { where, order, params } = upcMatchClause('072891005006');
    expect(where).toBe('upc = ANY($1::text[])');
    expect(order).toContain('array_position');
    expect(params[0]).toContain('0072891005006');
  });

  it('honours a custom column and param index', () => {
    const { where, order } = upcMatchClause('072891005006', 'p.upc', 3);
    expect(where).toBe('p.upc = ANY($3::text[])');
    expect(order).toBe('ORDER BY array_position($3::text[], p.upc)');
  });
});
