// Company matcher — three-stage lookup of a product brand string against the
// brand_aliases + companies tables.
//
// Stage 1: exact match on normalized alias (lowercase, alphanumeric only).
// Stage 2: pg_trgm similarity on alias (catches typos and minor variants).
// Stage 3: pg_trgm similarity on companies.name (catches brands that ARE
//          their own parent and weren't seeded explicitly).
//
// Returns: { company_id, name, behavior_score, controversies, match_type }
// or null when no match clears the similarity threshold.

import pool from '../db/init.js';

const SIMILARITY_THRESHOLD = 0.55;

// Corporate-entity suffixes / regional qualifiers that should be stripped
// before alias matching. Without this, "Danone US LLC" → "danoneusllc"
// wouldn't match the "danone" alias even though it's clearly the same
// company.
const SUFFIX_PATTERN = /\b(inc|llc|ltd|corp|corporation|co|company|usa|us|na|north[\s-]america|n[\s-]a|brands|foods|group|holdings|gmbh|s[\s-]a|sa|ag|plc|llp|limited)\b/gi;

export function normalizeBrand(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(SUFFIX_PATTERN, ' ')                        // strip corporate suffixes
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Find the parent company for a product brand string.
 *
 * Stages:
 *  1. Exact normalized match in brand_aliases
 *  2. Trigram similarity match in brand_aliases (> threshold)
 *  3. Trigram similarity match against companies.name (for parents that
 *     also ship products under their own name)
 *
 * @param {string} brand raw brand string from product
 * @returns {Promise<null|{company_id, name, behavior_score, controversies, match_type, similarity}>}
 */
export async function matchCompanyByBrand(brand) {
  const norm = normalizeBrand(brand);
  if (!norm) return null;

  // Stage 1: exact alias match
  const exact = await pool.query(
    `SELECT c.id AS company_id, c.name, c.behavior_score, c.controversies,
            'exact-alias' AS match_type, 1.0::float AS similarity
     FROM brand_aliases ba
     JOIN companies c ON ba.company_id = c.id
     WHERE ba.alias = $1
     LIMIT 1`,
    [norm]
  );
  if (exact.rows.length > 0) return exact.rows[0];

  // Stage 2: trigram similarity on aliases
  const fuzzyAlias = await pool.query(
    `SELECT c.id AS company_id, c.name, c.behavior_score, c.controversies,
            'fuzzy-alias' AS match_type,
            similarity(ba.alias, $1) AS similarity
     FROM brand_aliases ba
     JOIN companies c ON ba.company_id = c.id
     WHERE ba.alias % $1
     ORDER BY similarity DESC
     LIMIT 1`,
    [norm]
  );
  if (fuzzyAlias.rows.length > 0 && fuzzyAlias.rows[0].similarity >= SIMILARITY_THRESHOLD) {
    return fuzzyAlias.rows[0];
  }

  // Stage 3: trigram on companies.name (lowercase, stripped) — catch parents
  // that weren't seeded as aliases of themselves
  const fuzzyCompany = await pool.query(
    `SELECT id AS company_id, name, behavior_score, controversies,
            'fuzzy-company' AS match_type,
            similarity(regexp_replace(lower(name), '[^a-z0-9]', '', 'g'), $1) AS similarity
     FROM companies
     WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g') % $1
     ORDER BY similarity DESC
     LIMIT 1`,
    [norm]
  );
  if (fuzzyCompany.rows.length > 0 && fuzzyCompany.rows[0].similarity >= SIMILARITY_THRESHOLD) {
    return fuzzyCompany.rows[0];
  }

  return null;
}

/**
 * Convert a matched company into a 0–100 behavior score. Fallback to neutral
 * 50 when the company exists but has no score set (rare given our seed data).
 */
export function behaviorScoreFromMatch(match) {
  if (!match) return 50;
  if (match.behavior_score != null) return Math.max(0, Math.min(100, match.behavior_score));
  return 50;
}
