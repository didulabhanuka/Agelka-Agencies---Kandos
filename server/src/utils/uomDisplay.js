// src/utils/uomDisplay.js

/**
 * Safe number conversion
 */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * --------------------------------------------------------
 * 1️⃣ Format already-split quantities (primary + base)
 *
 * Example:
 *   primaryQty = 12, baseQty = 6
 *   → "12 CARTONS + 6 PCS"
 *
 * If only base exists:
 *   → "4 PCS"
 *
 * If only primary exists:
 *   → "2 CARTONS"
 * --------------------------------------------------------
 */
function formatQtySplit({
  primaryQty = 0,
  baseQty = 0,
  primaryLabel = "CARTON",
  baseLabel = "PC",
}) {
  const p = toNumber(primaryQty);
  const b = toNumber(baseQty);

  const parts = [];

  if (p > 0) parts.push(`${p} ${primaryLabel}${p !== 1 ? "S" : ""}`);
  if (b > 0) parts.push(`${b} ${baseLabel}${b !== 1 ? "S" : ""}`);

  if (parts.length === 0) {
    return `0 ${baseLabel}S`;
  }

  return parts.join(" + ");
}

/**
 * --------------------------------------------------------
 * 2️⃣ Convert base-equivalent qty → primary + base
 *
 * Example:
 *   totalBaseQty = 126
 *   factorToBase = 10
 *
 *   → primaryQty = 12
 *   → baseQty = 6
 * --------------------------------------------------------
 */
function splitFromBaseEquivalent({ totalBaseQty, factorToBase }) {
  const total = toNumber(totalBaseQty);
  const factor = toNumber(factorToBase) || 1;

  if (total <= 0 || factor <= 0) {
    return { primaryQty: 0, baseQty: 0 };
  }

  const primaryQty = Math.floor(total / factor);
  const baseQty = total % factor;

  return { primaryQty, baseQty };
}

/**
 * --------------------------------------------------------
 * 3️⃣ Convert primary + base → base-equivalent qty
 *
 * Example:
 *   primaryQty = 1
 *   baseQty = 2
 *   factorToBase = 6
 *
 *   → totalBaseQty = 8
 * --------------------------------------------------------
 */
function toBaseEquivalent({ primaryQty = 0, baseQty = 0, factorToBase }) {
  const p = toNumber(primaryQty);
  const b = toNumber(baseQty);
  const f = toNumber(factorToBase) || 1;

  return b + p * f;
}

/**
 * --------------------------------------------------------
 * 4️⃣ Convenience helper:
 *    base-equivalent qty → formatted display
 *
 * Example:
 *   totalBaseQty = 4
 *   factorToBase = 6
 *
 *   → "4 PCS"
 *
 * Example:
 *   totalBaseQty = 14
 *   factorToBase = 6
 *
 *   → "2 CARTONS + 2 PCS"
 * --------------------------------------------------------
 */
function formatFromBaseEquivalent({
  totalBaseQty,
  factorToBase,
  primaryLabel = "CARTON",
  baseLabel = "PC",
}) {
  const { primaryQty, baseQty } = splitFromBaseEquivalent({
    totalBaseQty,
    factorToBase,
  });

  return formatQtySplit({
    primaryQty,
    baseQty,
    primaryLabel,
    baseLabel,
  });
}

module.exports = {
  formatQtySplit,
  splitFromBaseEquivalent,
  toBaseEquivalent,
  formatFromBaseEquivalent,
};
