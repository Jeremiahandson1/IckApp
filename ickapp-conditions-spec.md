# IckApp — Health Condition Scoring Feature Spec

## Overview
Add a dual-scoring system to IckApp that shows both a normal food score and one or more condition-specific scores side by side on every product result. Users set their conditions in their profile and can toggle condition view on/off from the scanner screen.

---

## Conditions to Support

| Condition | Slug | Sub-types |
|---|---|---|
| Thyroid Disease | `thyroid` | `hypo`, `hyper`, `hashimotos` |
| Diabetes / Blood Sugar | `diabetes` | none |
| Heart Disease / Cholesterol | `heart` | none |
| Kidney Disease | `kidney` | none |
| Celiac / Gluten Intolerance | `celiac` | none |

---

## Phase 1 — Database Migrations

Create 3 new tables using the existing ORM/migration pattern in the codebase:

### `conditions`
- `id` (PK)
- `name` (string) — e.g. "Thyroid Disease"
- `slug` (string, unique) — e.g. "thyroid"
- `description` (text)
- `sub_types` (JSON) — e.g. `["hypo","hyper","hashimotos"]` or null
- `scoring_config` (JSON) — see scoring rules below
- `created_at`

### `user_conditions`
- `id` (PK)
- `userId` (FK → users)
- `conditionId` (FK → conditions)
- `sub_type` (string, nullable) — e.g. "hypo"
- `active` (boolean, default true)
- `created_at`

### `product_condition_scores`
- `id` (PK)
- `productId` (FK → products)
- `conditionSlug` (string)
- `subType` (string, nullable)
- `score` (integer 0–100)
- `flags` (JSON)
- `cached_at` (timestamp)

Also seed the `conditions` table — see Phase 5 for seed data.

---

## Phase 2 — Condition Scoring Engine

Create `lib/conditionScorer.ts` (or `.js` to match existing codebase conventions).

### Function signature
```ts
scoreForCondition(product: Product, conditionSlug: string, subType?: string): ConditionScoreResult

interface ConditionScoreResult {
  slug: string
  label: string
  score: number       // 0-100
  flags: Flag[]
}

interface Flag {
  ingredient?: string
  nutrient?: string
  reason: string
  severity: 'good' | 'warn' | 'avoid'
}
```

### Scoring rules per condition

#### Thyroid (`thyroid`)
Base score starts at 100. Deduct/add points based on:

**Hypo (underactive) rules:**
- AVOID (−20): soy, soy protein, soy isolate, soy isoflavones → "Soy can suppress thyroid hormone absorption"
- AVOID (−15): raw cruciferous keywords: raw cabbage, raw kale, raw broccoli, raw cauliflower, raw brussels → "Raw goitrogens can interfere with thyroid hormone production"
- WARN (−10): iodized salt, potassium iodide, kelp, seaweed → "Excess iodine can worsen hypothyroidism"
- WARN (−10): millet, cassava, pine nuts in ingredients → "Known goitrogenic foods"
- GOOD (+10): selenium-rich ingredient mentions (brazil nut, sunflower seeds) → "Selenium supports thyroid function"

**Hyper (overactive) rules:**
- AVOID (−25): kelp, seaweed, dulse, nori, kombu, wakame → "High iodine worsens hyperthyroidism"
- AVOID (−20): iodized salt, potassium iodide → "Added iodine worsens hyperthyroidism"
- AVOID (−15): caffeine above context (energy drinks, high-caffeine products) → "Caffeine can worsen hyperthyroid symptoms"
- GOOD (+10): cruciferous vegetables (broccoli, cabbage, kale) → "Goitrogens may help reduce thyroid activity"

**Hashimoto's rules:**
Apply all hypo rules PLUS:
- AVOID (−20): wheat, wheat flour, wheat starch, wheat gluten, barley, rye, malt → "Gluten triggers immune response in Hashimoto's"
- WARN (−10): dairy (milk, cheese, cream, butter, whey) → "Dairy sensitivity common in Hashimoto's"
- AVOID (−15): soy (same as hypo but with additional reason about autoimmune impact)

#### Diabetes (`diabetes`)
Base score starts at 100.
- AVOID (−20): added sugars > 10g → "High added sugar spikes blood glucose"
- WARN (−10): added sugars 5–10g → "Moderate added sugar — monitor portions"
- WARN (−10): refined carbs proxy: total carbs > 30g AND fiber < 3g → "Low fiber, high carb — fast glucose spike"
- GOOD (+10): fiber > 5g → "High fiber slows glucose absorption"
- GOOD (+5): fiber 3–5g → "Good fiber content"
- WARN (−10): high fructose corn syrup, corn syrup in ingredients → "HFCS linked to insulin resistance"
- GOOD (+10): mentions of cinnamon, apple cider vinegar, chromium → "May support blood sugar regulation"

#### Heart Disease (`heart`)
Base score starts at 100.
- AVOID (−25): trans fat > 0g OR partially hydrogenated in ingredients → "Trans fats directly raise LDL cholesterol"
- AVOID (−20): saturated fat > 5g per serving → "Saturated fat raises LDL cholesterol"
- WARN (−10): saturated fat 3–5g → "Moderate saturated fat — limit intake"
- AVOID (−20): sodium > 600mg per serving → "High sodium raises blood pressure"
- WARN (−10): sodium 400–600mg → "Moderate sodium — watch daily total"
- GOOD (+15): omega-3, fish oil, flaxseed, chia in ingredients → "Omega-3 supports heart health"
- GOOD (+10): fiber > 5g → "High fiber reduces cholesterol absorption"
- GOOD (+5): oats, oat bran, psyllium in ingredients → "Soluble fiber lowers LDL"

#### Kidney Disease (`kidney`)
Base score starts at 100.
- AVOID (−20): any ingredient ending in "phosphate" (e.g. sodium phosphate, calcium phosphate, dicalcium phosphate) → "Phosphate additives are absorbed more than natural phosphorus — dangerous for kidneys"
- WARN (−15): potassium > 300mg → "High potassium is dangerous with reduced kidney function"
- AVOID (−20): sodium > 600mg → "High sodium strains kidneys and raises blood pressure"
- WARN (−10): protein > 15g per serving → "High protein increases kidney workload"
- WARN (−10): oxalic acid sources: spinach, rhubarb, beets, nuts, chocolate → "High oxalate foods can cause kidney stones"
- GOOD (+10): low sodium (< 140mg) → "Kidney-friendly sodium level"

#### Celiac (`celiac`)
Base score starts at 100. This is largely binary — gluten presence is the primary concern.
- AVOID (−50): wheat, wheat flour, wheat starch, wheat germ, wheat bran, whole wheat → "Contains wheat — not safe for celiac disease"
- AVOID (−50): barley, barley malt, malt extract, malt flavoring → "Contains barley — not safe for celiac disease"
- AVOID (−50): rye → "Contains rye — not safe for celiac disease"
- AVOID (−50): triticale → "Contains triticale (wheat-rye hybrid) — not safe for celiac"
- WARN (−20): oats (unless labeled gluten-free oats) → "Oats often cross-contaminated with gluten"
- WARN (−15): natural flavors, modified food starch, maltodextrin (when source unknown) → "Source may be gluten-containing — check with manufacturer"
- GOOD (+10): certified gluten-free label mention → "Certified gluten-free"

Score floor is 0 — do not go negative.

---

## Phase 3 — API Endpoints

Add to the existing Express/Next/Fastify API (match existing routing patterns):

### `GET /api/conditions`
Returns all conditions with name, slug, description, sub_types.
No auth required.

### `POST /api/user/conditions`
Auth required. Body: `{ conditions: [{ conditionId, subType }] }`
Replaces all existing user_conditions for this user (delete + re-insert).
Returns updated list.

### `GET /api/user/conditions`
Auth required. Returns user's active conditions with full condition details.

### Update existing product score endpoint
Accept optional query param `?conditions=thyroid:hypo,diabetes`
When present, run conditionScorer for each requested condition and append to response:

```json
{
  "normalScore": 72,
  "conditionScores": [
    {
      "slug": "thyroid",
      "subType": "hypo",
      "label": "Thyroid (Hypo)",
      "score": 45,
      "flags": [
        { "ingredient": "soy protein isolate", "reason": "Soy can suppress thyroid hormone absorption", "severity": "avoid" }
      ]
    }
  ]
}
```

Cache results in `product_condition_scores` table. Cache TTL: 7 days.

---

## Phase 4 — Frontend

### 4a. Profile Page — "My Health Conditions" section
- Add a new section below existing profile fields
- List all available conditions as selectable cards or checkboxes
- When thyroid is selected, show a sub-type radio: Hypothyroid / Hyperthyroid / Hashimoto's
- Save button posts to `POST /api/user/conditions`
- Show currently active conditions with visual indicator

### 4b. Scanner Screen — Condition View Toggle
- Add a small toggle pill near the top of the scanner result area: "Condition View: OFF | ON"
- Persist toggle state in localStorage key `ick_condition_view`
- When toggled ON and user has conditions set: fetch scores with `?conditions=` param
- When toggled ON but no conditions set: show a nudge "Set your health conditions in your profile"

### 4c. Product Result Card — Dual Score Display
When condition scores are present, show:
```
[ Normal: 72 ]  [ 🦋 Thyroid: 45 ]  [ 🩸 Diabetes: 68 ]
```
Score colors: 75–100 = green, 50–74 = yellow, 25–49 = orange, 0–24 = red.

Add an expandable "Why this condition score?" section per condition:
- List each flag with severity icon (✅ good, ⚠️ warn, 🚫 avoid)
- Show the ingredient/nutrient that triggered it
- Show the human-readable reason

Condition emoji/icons:
- Thyroid: 🦋
- Diabetes: 🩸
- Heart: ❤️
- Kidney: 🫘
- Celiac: 🌾

---

## Phase 5 — Seed Data

Seed the `conditions` table with these 5 records:

1. **Thyroid Disease** — slug: `thyroid` — "Scoring accounts for goitrogens, iodine content, and soy — with separate rules for hypo, hyper, and Hashimoto's variants." — sub_types: `["hypo","hyper","hashimotos"]`

2. **Diabetes / Blood Sugar** — slug: `diabetes` — "Scores based on added sugar, fiber content, and refined carbohydrate load to help manage blood glucose." — sub_types: null

3. **Heart Disease / Cholesterol** — slug: `heart` — "Evaluates saturated fat, trans fat, sodium, and beneficial heart-healthy ingredients like omega-3s and soluble fiber." — sub_types: null

4. **Kidney Disease** — slug: `kidney` — "Flags phosphate additives, high potassium, sodium, and protein levels that can strain kidney function." — sub_types: null

5. **Celiac / Gluten Intolerance** — slug: `celiac` — "Detects wheat, barley, rye, and cross-contamination risk ingredients in the ingredient list." — sub_types: null

---

## Implementation Notes

- Use the same ORM, file structure, naming conventions, and error handling patterns already in the codebase — do not introduce new libraries unless necessary
- Scoring works off existing product nutrition facts and ingredients already stored in the database — no new data sources needed
- All scoring logic is based on established dietary guidelines for each condition — each flag includes a plain-English reason so users understand why
- Thyroid hypo vs hyper have intentionally opposite rules for iodine — this is correct medical dietary guidance
- Score minimum is 0, maximum is 100 — clamp results
- The condition scorer should be unit-testable in isolation (pure function, no DB calls)
