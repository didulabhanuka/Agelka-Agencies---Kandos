const { body, param, query } = require("express-validator");

// ---------- CREATE / UPDATE ----------
exports.createPORules = [
  body("poNo")
    .optional()
    .isString()
    .trim()
    .withMessage("PO number must be valid."),

  body("supplier")
    .notEmpty()
    .isMongoId()
    .withMessage("Supplier is required and must be valid."),

  body("branch")
    .optional()
    .isString()
    .trim()
    .withMessage("Branch must be valid."),

  body("orderDate")
    .isISO8601()
    .toDate()
    .withMessage("Order date must be a valid date."),

  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item must be added to the order."),

  body("items.*.item")
    .notEmpty()
    .isMongoId()
    .withMessage("Each order line must include a valid item ID."),

  body("items.*.qty")
    .isFloat({ gt: 0 })
    .withMessage("Quantity must be greater than zero."),

  body("items.*.avgCostBase")
    .isFloat({ gt: 0 })
    .withMessage("Average cost (base) must be greater than zero."),

  body("items.*.itemTotalValue")
    .isFloat({ gt: 0 })
    .withMessage("Item total value must be greater than zero."),
];

// ---------- PARAM ----------
exports.poIdParam = [
  param("id").isMongoId().withMessage("Invalid Purchase Order ID."),
];

// ---------- QUERY ----------
exports.listPOQuery = [
  query("supplier")
    .optional()
    .isMongoId()
    .withMessage("Supplier filter must be valid."),

  query("status")
    .optional()
    .isIn([
      "pending",
      "waiting_for_approval",
      "partially_received",
      "quantity_exceeded",
      "completed",
      "cancelled",
    ])
    .withMessage(
      "Status must be one of: pending, waiting_for_approval, partially_received, quantity_exceeded, completed, or cancelled."
    ),

  query("branch")
    .optional()
    .isString()
    .trim()
    .withMessage("Branch filter must be valid."),

  query("limit")
    .optional()
    .isInt({ gt: 0, lt: 1000 })
    .withMessage("Limit must be between 1 and 1000."),
];
