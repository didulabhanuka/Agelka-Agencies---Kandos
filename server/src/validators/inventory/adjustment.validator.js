const { body, param, query } = require("express-validator");

/**
 * CREATE ADJUSTMENT VALIDATION
 * Matches model:
 * - status defaults to "waiting_for_approval"
 * - items contain avgCostBase + qty
 */
exports.createAdjustmentRules = [
  body("adjustmentNo")
    .optional()
    .isString()
    .trim()
    .withMessage("Adjustment number must be valid."),

  body("branch")
    .notEmpty()
    .isMongoId()
    .withMessage("Branch must be a valid ID."),

  body("adjustmentDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Adjustment date must be valid."),

  body("type")
    .isIn(["increase", "decrease"])
    .withMessage("Type must be either 'increase' or 'decrease'."),

  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one adjustment item is required."),

  body("items.*.item")
    .notEmpty()
    .isMongoId()
    .withMessage("Each item must have a valid item ID."),

  body("items.*.qty")
    .isFloat({ gt: 0 })
    .withMessage("Quantity must be greater than zero."),

  // 🔥 Updated cost field → avgCostBase
  body("items.*.avgCostBase")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Avg cost must be greater than zero."),

  body("remarks")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Remarks cannot exceed 200 characters."),
];

/**
 * PARAM VALIDATION
 */
exports.adjustmentIdParam = [
  param("id").isMongoId().withMessage("Invalid Adjustment ID."),
];

/**
 * QUERY VALIDATION FOR LIST
 * Updated enum values to match model:
 * ["waiting_for_approval", "approved", "cancelled"]
 */
exports.listAdjustmentQuery = [
  query("status")
    .optional()
    .isIn(["waiting_for_approval", "approved", "cancelled"])
    .withMessage(
      "Status must be waiting_for_approval, approved, or cancelled."
    ),

  query("branch")
    .optional()
    .isString()
    .trim()
    .withMessage("Branch filter must be valid."),
];
