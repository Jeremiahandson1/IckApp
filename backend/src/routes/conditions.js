import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { scoreForCondition, RULES_VERSION, DISCLAIMER } from '../utils/conditionScorer.v2.js';

const router = express.Router();

// Sources registry — short tag → full citation text. Mirrors the SOURCES
// constant in conditionScorer.v2.js. Exposed publicly so the frontend can
// render a methodology page without duplicating the list.
const SOURCES = {
  CDF: 'Celiac Disease Foundation — Sources of Gluten',
  FDA_GF: 'FDA 21 CFR §101.91 — Gluten-Free Labeling Final Rule (2013)',
  AHA_2021: 'AHA 2021 Dietary Guidance to Improve Cardiovascular Health (Circulation 2021;144:e472–e487)',
  AHA_TRANS: 'AHA 2017 Presidential Advisory — Dietary Fats and CVD (Circulation 2017;136:e1–e23)',
  AHA_SUGAR: 'AHA 2016 Scientific Statement — Added Sugars and CVD (Circulation 2016;134:e362–e364)',
  FSA_TRAFFIC: 'UK FSA Front-of-Pack Traffic-Light Nutritional Labelling Guidance (2016)',
  IARC_MEAT: 'IARC Monograph 114 — Red and Processed Meat (Lancet Oncol 2015;16:1599–1600)',
  ADA_2024: 'American Diabetes Association — Standards of Care in Diabetes 2024 (Diabetes Care 47 Suppl 1)',
  ADA_NUTRITION: 'ADA/AACE Nutrition Therapy Consensus 2019 (Diabetes Care 2019;42:731–754)',
  KDOQI_2020: 'KDOQI 2020 Clinical Practice Guideline for Nutrition in CKD (Am J Kidney Dis 2020;76(3 Suppl 1):S1–S107)',
  NKF_PHOS: 'National Kidney Foundation — Phosphorus Additives in Food',
  AUA_STONES: 'AUA/EAU Medical Management of Kidney Stones (J Urol 2014;192:316–324)',
  ATA_HYPO: "ATA Guidelines for Treatment of Hypothyroidism (Thyroid 2014;24:1670–1751)",
  ATA_HYPER: "ATA 2016 Guidelines for Hyperthyroidism and Other Causes of Thyrotoxicosis (Thyroid 2016;26:1343–1421)",
  AACE_THYROID: 'AACE/ACE Clinical Practice Guidelines for Hypothyroidism in Adults (Endocr Pract 2012;18:988–1028)',
};

// GET /api/conditions/sources — public methodology metadata
router.get('/sources', (_req, res) => {
  res.json({
    rulesVersion: RULES_VERSION,
    disclaimer: DISCLAIMER,
    sources: SOURCES,
  });
});

// ── GET /api/conditions — list all available conditions (no auth) ──
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, description, sub_types FROM conditions ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List conditions error:', err);
    res.status(500).json({ error: 'Failed to load conditions' });
  }
});

// ── GET /api/user/conditions — get user's active conditions ──
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uc.id, uc.condition_id, uc.sub_type, uc.active,
              c.name, c.slug, c.description, c.sub_types
       FROM user_conditions uc
       JOIN conditions c ON uc.condition_id = c.id
       WHERE uc.user_id = $1 AND uc.active = true
       ORDER BY c.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get user conditions error:', err);
    res.status(500).json({ error: 'Failed to load user conditions' });
  }
});

// ── POST /api/user/conditions — set user's conditions (replace all) ──
router.post('/user', authenticateToken, async (req, res) => {
  try {
    const { conditions } = req.body;
    if (!Array.isArray(conditions)) {
      return res.status(400).json({ error: 'conditions must be an array' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing
      await client.query('DELETE FROM user_conditions WHERE user_id = $1', [req.user.id]);

      // Insert new
      for (const c of conditions) {
        if (!c.conditionId) continue;
        await client.query(
          `INSERT INTO user_conditions (user_id, condition_id, sub_type, active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (user_id, condition_id) DO UPDATE SET sub_type = $3, active = true`,
          [req.user.id, c.conditionId, c.subType || null]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Return updated list
    const result = await pool.query(
      `SELECT uc.id, uc.condition_id, uc.sub_type, uc.active,
              c.name, c.slug, c.description, c.sub_types
       FROM user_conditions uc
       JOIN conditions c ON uc.condition_id = c.id
       WHERE uc.user_id = $1 AND uc.active = true
       ORDER BY c.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Set user conditions error:', err);
    res.status(500).json({ error: 'Failed to save conditions' });
  }
});

// ── GET /api/conditions/score/:productId — score a product for given conditions ──
// Query: ?conditions=thyroid:hypo,diabetes
router.get('/score/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const conditionsParam = req.query.conditions;
    if (!conditionsParam) {
      return res.status(400).json({ error: 'conditions query param required' });
    }

    // Parse conditions param
    const requested = conditionsParam.split(',').map(c => {
      const [slug, subType] = c.split(':');
      return { slug: slug.trim(), subType: subType?.trim() || null };
    });

    // Get product (support both numeric ID and UPC string)
    const isNumeric = /^\d+$/.test(productId);
    const productResult = await pool.query(
      isNumeric
        ? 'SELECT id, upc, name, ingredients, nutrition_facts, total_score FROM products WHERE id = $1 OR upc = $2'
        : 'SELECT id, upc, name, ingredients, nutrition_facts, total_score FROM products WHERE upc = $1',
      isNumeric ? [parseInt(productId), productId] : [productId]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productResult.rows[0];

    // Check cache (7-day TTL)
    const conditionScores = [];
    for (const { slug, subType } of requested) {
      // Check cache (scoped to current rules version — old v1 rows never match)
      const cached = await pool.query(
        `SELECT score, flags FROM product_condition_scores
         WHERE product_id = $1 AND condition_slug = $2
           AND (sub_type = $3 OR ($3 IS NULL AND sub_type IS NULL))
           AND rules_version = $4
           AND cached_at > NOW() - INTERVAL '7 days'`,
        [product.id, slug, subType, RULES_VERSION]
      );

      if (cached.rows.length > 0) {
        const row = cached.rows[0];
        conditionScores.push({
          slug,
          subType,
          label: buildLabel(slug, subType),
          score: row.score,
          flags: typeof row.flags === 'string' ? JSON.parse(row.flags) : row.flags,
          rulesVersion: RULES_VERSION,
          disclaimer: DISCLAIMER,
        });
      } else {
        // Compute score
        const result = scoreForCondition(product, slug, subType);
        conditionScores.push(result);

        // Cache it (skip cache if score is null — e.g. missing ingredients)
        if (result.score != null) {
          await pool.query(
            `INSERT INTO product_condition_scores (product_id, condition_slug, sub_type, score, flags, rules_version, cached_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT DO NOTHING`,
            [product.id, slug, subType, result.score, JSON.stringify(result.flags), RULES_VERSION]
          );
        }
      }
    }

    res.json({
      productId: product.id,
      normalScore: product.total_score,
      conditionScores,
      rulesVersion: RULES_VERSION,
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    console.error('Condition score error:', err);
    res.status(500).json({ error: 'Failed to compute condition scores' });
  }
});

function buildLabel(slug, subType) {
  const labels = { thyroid: 'Thyroid', diabetes: 'Diabetes', heart: 'Heart', kidney: 'Kidney', celiac: 'Celiac' };
  const subLabels = {
    hypo: 'Hypo', hyper: 'Hyper', hashimotos: "Hashimoto's",
    general: 'General', 'ckd-3-4': 'CKD 3-4', dialysis: 'Dialysis', stones: 'Kidney Stones',
  };
  const base = labels[slug] || slug;
  return subType ? `${base} (${subLabels[subType] || subType})` : base;
}

export default router;
