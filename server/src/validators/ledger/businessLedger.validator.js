// validators/inventory/businessLedger.validator.js
const { query } = require("express-validator");

exports.businessSummaryQuery = [
  query("branch").optional().isMongoId().withMessage("Invalid branch ID."),
  query("from").optional().isISO8601().toDate().withMessage("Invalid 'from' date."),
  query("to").optional().isISO8601().toDate().withMessage("Invalid 'to' date."),
];
