// utils/uomMath.js

/**
 * Safe number conversion
 */
function toNumberSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Convert (primaryQty, baseQty) to a single base-equivalent quantity.
 * Think: packs & pieces → only pieces.
 */
function calcBaseQty(primaryQty, baseQty, factorToBase) {
  const factor = toNumberSafe(factorToBase, 1);
  if (factor <= 0) {
    throw Object.assign(new Error("factorToBase must be > 0"), { status: 500 });
  }

  const p = toNumberSafe(primaryQty, 0);
  const b = toNumberSafe(baseQty, 0);

  return p * factor + b;
}

/**
 * Split a base-equivalent quantity back into { primaryQty, baseQty }.
 * Example: totalBase = 95, factor = 10 → { primaryQty: 9, baseQty: 5 }
 */
function splitToPrimaryBase(totalBaseQty, factorToBase) {
  const factor = toNumberSafe(factorToBase, 1);
  if (factor <= 0) {
    throw Object.assign(new Error("factorToBase must be > 0"), { status: 500 });
  }

  const total = toNumberSafe(totalBaseQty, 0);

  if (total < 0) {
    // Normally we should never have negative stock; enforce this strictly
    throw Object.assign(new Error("Total stock cannot be negative"), {
      status: 500,
      code: "NEGATIVE_STOCK_INTERNAL",
      meta: { total, factorToBase },
    });
  }

  if (total === 0) {
    return { primaryQty: 0, baseQty: 0 }; // Ensure no miscalculations when total is zero
  }

  const primaryQty = Math.floor(total / factor);
  const baseQty = total % factor;

  return { primaryQty, baseQty };
}


/**
 * Subtract a sale/issue quantity from current stock, respecting the factor.
 *
 * - current = what is in stock now
 * - issue   = what we are trying to take out (sale, issue, etc.)
 * 
 * All calculations are done in base-equivalent.
 * Result is returned as { primaryQty, baseQty, totalBaseQty } to be stored "as-is".
 */
function subtractFromStock({
  currentPrimary,
  currentBase,
  issuePrimary,
  issueBase,
  factorToBase,
  errorMeta = {},
}) {
  const factor = toNumberSafe(factorToBase, 1);
  if (factor <= 0) {
    throw Object.assign(new Error("Invalid factorToBase"), {
      status: 500,
      code: "INVALID_FACTOR_TO_BASE",
      meta: errorMeta,
    });
  }

  const currentTotalBase = calcBaseQty(currentPrimary, currentBase, factor);
  const issueTotalBase = calcBaseQty(issuePrimary, issueBase, factor);

  if (issueTotalBase <= 0) {
    throw Object.assign(new Error("Issue quantity must be > 0"), {
      status: 400,
      code: "ISSUE_QTY_ZERO",
      meta: errorMeta,
    });
  }

  if (issueTotalBase > currentTotalBase) {
    throw Object.assign(new Error("Insufficient stock for this operation"), {
      status: 400,
      code: "STOCK_INSUFFICIENT",
      meta: {
        ...errorMeta,
        currentTotalBase,
        issueTotalBase,
      },
    });
  }

  const newTotalBase = currentTotalBase - issueTotalBase;
  const { primaryQty, baseQty } = splitToPrimaryBase(newTotalBase, factor);

  return {
    primaryQty,
    baseQty,
    totalBaseQty: newTotalBase,
  };
}

/**
 * NEW: Given current stock & issue, compute:
 *  - new stock after issue
 *  - movement quantities for the ledger
 *
 * This is what you should use BEFORE calling postLedger for a "sale"/"issue".
 */
function computeIssueMovement({
  currentPrimary,
  currentBase,
  issuePrimary,
  issueBase,
  factorToBase,
  errorMeta = {},
}) {
  // 1) Use existing helper to get new stock (canonical)
  const next = subtractFromStock({
    currentPrimary,
    currentBase,
    issuePrimary,
    issueBase,
    factorToBase,
    errorMeta,
  });

  // 2) Movement is simply the difference between before and after
  const movementPrimary = toNumberSafe(currentPrimary) - toNumberSafe(next.primaryQty);
  const movementBase = toNumberSafe(currentBase) - toNumberSafe(next.baseQty);

  return {
    // what actually moved out (always >= 0)
    movementPrimary,
    movementBase,

    // new stock after issue (canonical)
    newPrimary: next.primaryQty,
    newBase: next.baseQty,
    newTotalBaseQty: next.totalBaseQty,
  };
}

module.exports = {
  toNumberSafe,
  calcBaseQty,
  splitToPrimaryBase,
  subtractFromStock,
  computeIssueMovement,   // 🔹 NEW EXPORT
};
