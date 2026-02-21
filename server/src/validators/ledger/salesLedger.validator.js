// validators/inventory/salesLedger.validator.js
const { query } = require("express-validator");

exports.listSalesLedgerQuery = [
  query("branch")
    .optional()
    .isString()
    .trim()
    .withMessage("Branch filter must be valid."),
  query("customer")
    .optional()
    .isMongoId()
    .withMessage("Customer filter must be a valid ID."),
  query("from")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("From date must be a valid date."),
  query("to")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("To date must be a valid date."),
];
