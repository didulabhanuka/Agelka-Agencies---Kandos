// src/validators/commonValidators.js
const { param, query, validationResult } = require("express-validator");
const mongoose = require("mongoose");

// ---------------------------------------------
// Handle Validation Result
// ---------------------------------------------
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
}

// ---------------------------------------------
// Pagination Validator (page + limit)
// ---------------------------------------------
const pagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be >= 1"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage("limit must be between 1–500"),

  handleValidation,
];

// ---------------------------------------------
// Validate a MongoDB ObjectId Param
// ---------------------------------------------
function mongoId(paramName = "id") {
  return [
    param(paramName)
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage(`${paramName} is not a valid ObjectId`),
    handleValidation,
  ];
}

module.exports = {
  pagination,
  mongoId,
  handleValidation,
};
