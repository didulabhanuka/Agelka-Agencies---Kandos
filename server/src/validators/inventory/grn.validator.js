const { body, param, query } = require("express-validator");

// -------------------- CREATE GRN VALIDATION --------------------
exports.createGRNRules = [
  body("grnNo")
    .optional()
    .isString()
    .trim()
    .withMessage("GRN number must be a valid string."),

  body("supplier")
    .notEmpty()
    .isMongoId()
    .withMessage("Supplier is required and must be a valid Mongo ID."),

  body("supplierInvoiceNo")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Supplier invoice number must not exceed 50 characters."),

  body("supplierInvoiceDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Supplier invoice date must be a valid date."),

  body("branch")
    .notEmpty()
    .isMongoId()
    .withMessage("Branch is required and must be valid."),

  // ✅ NEW: required by service when Admin/DataEntry creates, ignored/forced for SalesRep
  body("salesRep")
    .optional()
    .isMongoId()
    .withMessage("SalesRep must be a valid Mongo ID."),

  // ❌ linkedPO removed (PO removed)
  // body("linkedPO") ...

  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required."),

  body("items.*.item")
    .notEmpty()
    .isMongoId()
    .withMessage("Each item must have a valid Item ID."),

  body("items.*.qty")
    .isFloat({ gt: 0 })
    .withMessage("Item quantity must be greater than zero."),

  // ✅ Make optional because service can pull avgCostBase from Item if missing
  body("items.*.avgCostBase")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Average cost (base) must be greater than zero."),

  body("items.*.itemTotalValue")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Item total value must be a positive number."),

  body("receivedDate")
    .isISO8601()
    .toDate()
    .withMessage("Received date must be a valid date."),
];

// -------------------- PARAM VALIDATION --------------------
exports.grnIdParam = [param("id").isMongoId().withMessage("Invalid GRN ID.")];

// -------------------- QUERY VALIDATION --------------------
exports.listGRNQuery = [
  query("supplier")
    .optional()
    .isMongoId()
    .withMessage("Supplier filter must be valid."),

  query("status")
    .optional()
    .isIn(["waiting_for_approval", "approved", "cancelled"])
    .withMessage("Status must be waiting_for_approval, approved, or cancelled."),

  query("branch")
    .optional()
    .isMongoId()
    .withMessage("Branch filter must be a valid ID."),

  query("limit")
    .optional()
    .isInt({ gt: 0, lt: 1000 })
    .withMessage("Limit must be a positive number below 1000."),
];
