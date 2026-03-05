import { describe, it, expect } from 'vitest';
import { getScoreRating } from './helpers.js';

describe('getScoreRating', () => {
  it('returns excellent for scores >= 86', () => {
    expect(getScoreRating(86).rating).toBe('excellent');
    expect(getScoreRating(100).rating).toBe('excellent');
    expect(getScoreRating(99).rating).toBe('excellent');
  });

  it('returns good for scores 71-85', () => {
    expect(getScoreRating(71).rating).toBe('good');
    expect(getScoreRating(85).rating).toBe('good');
  });

  it('returns okay for scores 51-70', () => {
    expect(getScoreRating(51).rating).toBe('okay');
    expect(getScoreRating(70).rating).toBe('okay');
  });

  it('returns poor for scores 31-50', () => {
    expect(getScoreRating(31).rating).toBe('poor');
    expect(getScoreRating(50).rating).toBe('poor');
  });

  it('returns avoid for scores 0-30', () => {
    expect(getScoreRating(0).rating).toBe('avoid');
    expect(getScoreRating(30).rating).toBe('avoid');
  });

  it('returns unscored for null', () => {
    expect(getScoreRating(null).rating).toBe('unscored');
  });

  it('returns unscored for undefined', () => {
    expect(getScoreRating(undefined).rating).toBe('unscored');
  });

  it('includes emoji and color for each rating', () => {
    const result = getScoreRating(90);
    expect(result.emoji).toBeDefined();
    expect(result.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('handles boundary values correctly', () => {
    // These are the exact boundary values
    expect(getScoreRating(86).rating).toBe('excellent');
    expect(getScoreRating(85).rating).toBe('good');
    expect(getScoreRating(71).rating).toBe('good');
    expect(getScoreRating(70).rating).toBe('okay');
    expect(getScoreRating(51).rating).toBe('okay');
    expect(getScoreRating(50).rating).toBe('poor');
    expect(getScoreRating(31).rating).toBe('poor');
    expect(getScoreRating(30).rating).toBe('avoid');
  });
});
