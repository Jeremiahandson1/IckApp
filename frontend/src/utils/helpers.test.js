import { describe, it, expect } from 'vitest';
import {
  getScoreRating, getScoreLabel, getScoreColor, getScoreHex,
  getScoreBgClass, getScoreTextClass, getScoreLightBgClass,
  formatDate, formatRelativeTime, formatDaysUntil,
  formatCurrency, formatDuration,
  getSeverityLabel, getSeverityColor,
  isValidUPC, truncate, capitalize, pluralize, groupBy, debounce, generateId,
} from './helpers.js';

// ── Score Rating ──

describe('getScoreRating', () => {
  it('returns correct tiers', () => {
    expect(getScoreRating(100)).toBe('excellent');
    expect(getScoreRating(86)).toBe('excellent');
    expect(getScoreRating(85)).toBe('good');
    expect(getScoreRating(71)).toBe('good');
    expect(getScoreRating(70)).toBe('okay');
    expect(getScoreRating(51)).toBe('okay');
    expect(getScoreRating(50)).toBe('poor');
    expect(getScoreRating(31)).toBe('poor');
    expect(getScoreRating(30)).toBe('avoid');
    expect(getScoreRating(0)).toBe('avoid');
  });

  it('returns unscored for null/undefined', () => {
    expect(getScoreRating(null)).toBe('unscored');
    expect(getScoreRating(undefined)).toBe('unscored');
  });
});

describe('getScoreLabel', () => {
  it('returns correct labels', () => {
    expect(getScoreLabel(90)).toBe('Clean');
    expect(getScoreLabel(75)).toBe('Decent');
    expect(getScoreLabel(60)).toBe('Meh');
    expect(getScoreLabel(40)).toBe('Ick');
    expect(getScoreLabel(10)).toBe('Ick that \uD83D\uDCA9');
    expect(getScoreLabel(null)).toBe('?');
  });
});

describe('getScoreColor', () => {
  it('returns Tailwind text color classes', () => {
    expect(getScoreColor(90)).toContain('text-green');
    expect(getScoreColor(10)).toContain('text-red');
    expect(getScoreColor(null)).toContain('text-gray');
  });
});

describe('getScoreHex', () => {
  it('returns hex color strings', () => {
    expect(getScoreHex(90)).toMatch(/^#[0-9a-f]{6}$/);
    expect(getScoreHex(null)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('getScoreBgClass', () => {
  it('returns Tailwind bg classes', () => {
    expect(getScoreBgClass(90)).toContain('bg-green');
    expect(getScoreBgClass(10)).toContain('bg-red');
  });
});

describe('getScoreTextClass', () => {
  it('returns Tailwind text classes', () => {
    expect(getScoreTextClass(90)).toContain('text-green');
    expect(getScoreTextClass(60)).toContain('text-amber');
  });
});

describe('getScoreLightBgClass', () => {
  it('returns light bg Tailwind classes', () => {
    expect(getScoreLightBgClass(90)).toContain('bg-green');
    expect(getScoreLightBgClass(40)).toContain('bg-orange');
  });
});

// ── Date Formatting ──

describe('formatDate', () => {
  it('formats a date', () => {
    // Use ISO timestamp with time to avoid timezone ambiguity
    const result = formatDate('2024-06-15T12:00:00');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });
});

describe('formatRelativeTime', () => {
  it('returns Today for current date', () => {
    expect(formatRelativeTime(new Date())).toBe('Today');
  });

  it('returns Yesterday for 1 day ago', () => {
    const yesterday = new Date(Date.now() - 86400000);
    expect(formatRelativeTime(yesterday)).toBe('Yesterday');
  });

  it('returns N days ago for 2-6 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns N weeks ago for 7-29 days', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    expect(formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
  });

  it('falls back to formatted date for 30+ days', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400000);
    const result = formatRelativeTime(twoMonthsAgo);
    expect(result).not.toContain('ago');
  });
});

describe('formatDaysUntil', () => {
  it('returns Today for current date', () => {
    expect(formatDaysUntil(new Date())).toBe('Today');
  });

  it('returns Tomorrow for 1 day ahead', () => {
    const tomorrow = new Date(Date.now() + 86400000);
    expect(formatDaysUntil(tomorrow)).toBe('Tomorrow');
  });

  it('returns Overdue for past dates', () => {
    const yesterday = new Date(Date.now() - 2 * 86400000);
    expect(formatDaysUntil(yesterday)).toBe('Overdue');
  });

  it('returns In N days for 2-6 days', () => {
    const inThree = new Date(Date.now() + 3 * 86400000);
    expect(formatDaysUntil(inThree)).toMatch(/In \d days/);
  });

  it('returns In N weeks for 7+ days', () => {
    const inTwoWeeks = new Date(Date.now() + 14 * 86400000);
    expect(formatDaysUntil(inTwoWeeks)).toMatch(/In \d weeks/);
  });
});

// ── Currency & Duration ──

describe('formatCurrency', () => {
  it('formats as USD', () => {
    expect(formatCurrency(10)).toBe('$10.00');
    expect(formatCurrency(3.5)).toBe('$3.50');
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(30)).toBe('30min');
    expect(formatDuration(1)).toBe('1min');
  });

  it('formats hours', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(150)).toBe('2h 30m');
  });
});

// ── Severity ──

describe('getSeverityLabel', () => {
  it('returns correct labels', () => {
    expect(getSeverityLabel(10)).toBe('Severe');
    expect(getSeverityLabel(9)).toBe('Severe');
    expect(getSeverityLabel(7)).toBe('High');
    expect(getSeverityLabel(5)).toBe('Moderate');
    expect(getSeverityLabel(3)).toBe('Low');
    expect(getSeverityLabel(1)).toBe('Minimal');
  });
});

describe('getSeverityColor', () => {
  it('returns red classes for severe', () => {
    expect(getSeverityColor(9)).toContain('red');
  });

  it('returns orange for high', () => {
    expect(getSeverityColor(7)).toContain('orange');
  });
});

// ── UPC Validation ──

describe('isValidUPC', () => {
  it('accepts 12-digit UPC-A', () => {
    expect(isValidUPC('012345678905')).toBe(true);
  });

  it('accepts 13-digit EAN', () => {
    expect(isValidUPC('0012345678905')).toBe(true);
  });

  it('accepts 8-digit UPC-E', () => {
    expect(isValidUPC('01234567')).toBe(true);
  });

  it('accepts 14-digit GTIN', () => {
    expect(isValidUPC('00012345678905')).toBe(true);
  });

  it('rejects invalid lengths', () => {
    expect(isValidUPC('12345')).toBe(false);
    expect(isValidUPC('1234567890')).toBe(false);
    expect(isValidUPC('123456789012345')).toBe(false);
  });

  it('strips non-digits before validating', () => {
    expect(isValidUPC('012-345-678905')).toBe(true);
  });
});

// ── String Utilities ──

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 50)).toBe('hello');
  });

  it('truncates long strings with ellipsis', () => {
    const long = 'a'.repeat(60);
    const result = truncate(long, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles null/empty', () => {
    expect(truncate(null)).toBe(null);
    expect(truncate('')).toBe('');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter, lowercases rest', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('HELLO')).toBe('Hello');
    expect(capitalize('hELLO')).toBe('Hello');
  });

  it('handles empty/null', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
    expect(capitalize(undefined)).toBe('');
  });
});

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    expect(pluralize(1, 'item')).toBe('item');
  });

  it('returns auto-plural for other counts', () => {
    expect(pluralize(0, 'item')).toBe('items');
    expect(pluralize(2, 'item')).toBe('items');
    expect(pluralize(100, 'item')).toBe('items');
  });

  it('uses custom plural', () => {
    expect(pluralize(2, 'child', 'children')).toBe('children');
  });
});

// ── Group By ──

describe('groupBy', () => {
  it('groups array by key', () => {
    const data = [
      { category: 'fruit', name: 'apple' },
      { category: 'veg', name: 'carrot' },
      { category: 'fruit', name: 'banana' },
    ];
    const result = groupBy(data, 'category');
    expect(result.fruit).toHaveLength(2);
    expect(result.veg).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(groupBy([], 'key')).toEqual({});
  });
});

// ── Debounce ──

describe('debounce', () => {
  it('delays function execution', async () => {
    let callCount = 0;
    const fn = debounce(() => callCount++, 50);
    fn();
    fn();
    fn();
    expect(callCount).toBe(0);
    await new Promise(r => setTimeout(r, 100));
    expect(callCount).toBe(1);
  });
});

// ── Generate ID ──

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
