const { body, param, query } = require("express-validator");

exports.postLedgerRules = [
  body("item").notEmpty().isMongoId().withMessage("Item ID is required and must be valid."),
  body("branch").optional().isString().trim().isLength({ max: 30 }).withMessage("Branch must be valid."),
  body("transactionType").notEmpty().isString().trim().withMessage("Transaction type is required."),
  body("refModel").notEmpty().isString().trim().withMessage("Reference model is required."),
  body("refId").notEmpty().isMongoId().withMessage("Reference ID must be valid."),
  body("qty").isFloat().withMessage("Quantity must be a valid number."),
  body("cost").optional().isFloat({ min: 0 }).withMessage("Cost must be a non-negative number."),
  body("remarks").optional().isString().trim().withMessage("Remarks must be valid text."),
];

exports.itemIdParam = [param("itemId").isMongoId().withMessage("Invalid Item ID.")];

exports.ledgerQuery = [
  query("branch").optional().isString().trim().withMessage("Branch filter must be valid."),
  query("limit").optional().isInt({ gt: 0, lt: 1000 }).withMessage("Limit must be a number between 1 and 1000."),
];
