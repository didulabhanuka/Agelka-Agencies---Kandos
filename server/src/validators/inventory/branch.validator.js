// validators/inventory/branch.validator.js
const { body, param, query } = require("express-validator");

// ---------- CREATE ----------
exports.createBranchRules = [
  body("branchCode")
    .notEmpty()
    .isString()
    .trim()
    .isLength({ max: 10 })
    .matches(/^[A-Z0-9-]+$/)
    .withMessage("Branch code is required, cannot exceed 10 characters, and may only contain uppercase letters, numbers, or dashes."),
  body("name")
    .notEmpty()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Branch name is required and cannot exceed 100 characters."),
  body("address")
    .optional()
    .isString()
    .trim()
    .withMessage("Address must be valid text."),
  body("phone")
    .optional()
    .matches(/^[0-9+ -]{6,20}$/)
    .withMessage("Phone number must be valid and within 20 characters."),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Email address must be valid."),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be either active or inactive."),
];

// ---------- UPDATE ----------
exports.updateBranchRules = [
  param("id").isMongoId().withMessage("Invalid branch ID."),
  body("branchCode")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 10 })
    .matches(/^[A-Z0-9-]+$/)
    .withMessage("Branch code must be valid, within 10 characters, and use only uppercase letters, numbers, or dashes."),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Branch name must be valid and cannot exceed 100 characters."),
  body("address")
    .optional()
    .isString()
    .trim()
    .withMessage("Address must be valid text."),
  body("phone")
    .optional()
    .matches(/^[0-9+ -]{6,20}$/)
    .withMessage("Phone number must be valid and within 20 characters."),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Email address must be valid."),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be either active or inactive."),
];

// ---------- PARAM VALIDATION ----------
exports.branchIdParam = [
  param("id").isMongoId().withMessage("Invalid branch ID."),
];

// ---------- QUERY VALIDATION ----------
exports.listBranchQuery = [
  query("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status filter must be either active or inactive."),
];
