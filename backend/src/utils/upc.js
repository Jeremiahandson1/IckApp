/**
 * UPC / EAN / GTIN normalization.
 *
 * WHY THIS EXISTS
 * Open Food Facts stores US products in EAN-13 form — a 12-digit UPC-A gets a
 * leading zero: printed 072891005006 → stored 0072891005006. 737,887 of our
 * 845,602 products (87%) are stored that zero-padded way.
 *
 * But a scanner reports what's physically printed. ML Kit and BarcodeDetector
 * report UPC_A as 12 digits, so scanning a US product yields 072891005006 —
 * which never equals the stored 0072891005006 under `WHERE upc = $1`. The
 * lookup missed a product we already had, fell through to the slow external
 * APIs, and could end on "Product not found" (or insert a DUPLICATE row under
 * the 12-digit code — which is where our 112 twelve-digit rows came from).
 *
 * So: never match a barcode by exact string. Match against every equivalent
 * form, most-specific first.
 */

/**
 * All equivalent representations of a barcode, in match-priority order:
 * the code exactly as given first, then digit-only, then GTIN re-paddings.
 * Deduped, so a 13-digit input that needs no variants returns a single entry.
 */
export function upcVariants(code) {
  if (code == null) return [];
  const raw = String(code).trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw ? [raw] : [];

  const variants = [raw, digits];

  // Pad up to the longer GTIN widths (UPC-A 12 → EAN-13 → GTIN-14).
  for (const width of [12, 13, 14]) {
    if (digits.length < width) variants.push(digits.padStart(width, '0'));
  }

  // Strip leading zeros back down to the shorter widths (EAN-13 → UPC-A 12,
  // GTIN-14 → EAN-13). Only strip zeros we added — never touch real digits.
  let trimmed = digits;
  while (trimmed.length > 8 && trimmed.startsWith('0')) {
    trimmed = trimmed.slice(1);
    if ([8, 12, 13].includes(trimmed.length)) variants.push(trimmed);
  }

  return [...new Set(variants.filter(Boolean))];
}

/**
 * The form we store new products under: EAN-13 (zero-padded), matching how
 * Open Food Facts — and therefore 99.99% of our existing rows — represents
 * them. Codes that aren't a standard width are returned digit-only, unchanged.
 */
export function canonicalUpc(code) {
  const digits = String(code ?? '').replace(/\D/g, '');
  if (digits.length === 12) return digits.padStart(13, '0');
  return digits || String(code ?? '').trim();
}

/**
 * SQL fragment + params for looking a product up by any equivalent barcode.
 * Returns the row matching the highest-priority variant, so an exact hit always
 * wins over a re-padded one when duplicate rows exist.
 *
 *   const { where, order, params } = upcMatchClause(upc);
 *   pool.query(`SELECT * FROM products WHERE ${where} ${order} LIMIT 1`, params);
 */
export function upcMatchClause(code, column = 'upc', paramIndex = 1) {
  return {
    where: `${column} = ANY($${paramIndex}::text[])`,
    order: `ORDER BY array_position($${paramIndex}::text[], ${column})`,
    params: [upcVariants(code)],
  };
}
