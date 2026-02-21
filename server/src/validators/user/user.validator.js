const { body, param, query } = require('express-validator');

const mongoId = () => param('id').isMongoId();

const pagination = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('q').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended']),
];

// -------- User --------
const createUserRules = [
  body('username').isString().trim().isLength({ min: 3 }),
  body('password').isStrongPassword({ minLength: 8, minSymbols: 1, minNumbers: 1, minUppercase: 1 }),
  body('email').optional().isEmail(),
  body('role').isString().trim().isIn(['Admin', 'DataEntry']),
];

const loginRules = [
  body('username').isString().trim().notEmpty(),
  body('password').isString().notEmpty(),
];

const changePasswordRules = [
  body('newPassword').isStrongPassword({ minLength: 8, minSymbols: 1, minNumbers: 1, minUppercase: 1 }),
];

const userIdParam = [param('id').isMongoId()];

// -------- Supplier --------
const createSupplierRules = [
  body('supplierCode').isString().trim().isLength({ min: 5, max: 10 }).matches(/^[A-Z0-9]+$/).withMessage('5–10 chars, uppercase letters & numbers only'),
  body('name').isString().trim().isLength({ min: 5, max: 100 }).withMessage('5–100 chars'),
  body('owner').isString().trim().isLength({ min: 5, max: 100 }).withMessage('5–100 chars'),
  body('address').isString().trim().isLength({ min: 10, max: 100 }).withMessage('10–100 chars'),
  body('contactNumber').isString().trim().matches(/^\+?[0-9]{7,15}$/).withMessage('Invalid contact number'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
];

const updateSupplierRules = createSupplierRules.map(r =>
  r.builder.fields.includes('supplierCode')
    ? body('supplierCode').optional().isString().trim().isLength({ min: 5, max: 10 }).matches(/^[A-Z0-9]+$/).withMessage('5–10 chars, uppercase letters & numbers only')
    : r
);

// -------- SalesRep --------
const createSalesRepRules = [
  body('repCode').isString().trim().isLength({ min: 3, max: 10 }).matches(/^[A-Z0-9]+$/).withMessage("Rep code: 3–10 chars, uppercase letters & numbers only"),
  body('name').isString().trim().isLength({ min: 5, max: 100 }).withMessage("Name: 5–100 chars"),
  body('contactNumber').isString().trim().matches(/^\+?[0-9]{7,15}$/).withMessage("Invalid contact number"),
  body('route').optional({ nullable: true }).isString().trim().isLength({ min: 4, max: 50 }).withMessage("Route: 4–50 chars"),
  body('address').isString().trim().isLength({ max: 200 }).withMessage("Address max 200 chars"),
  body('NIC').isString().trim().matches(/^([0-9]{9}[vVxX]|[0-9]{12})$/).withMessage("Invalid NIC format"),
  body('status').optional().isIn(['active', 'inactive']).withMessage("Status must be active/inactive")
];

const updateSalesRepRules = createSalesRepRules.map(r =>
  r.builder.fields[0] === 'repCode'
    ? body('repCode').optional().isString().trim().isLength({ min: 3, max: 10 }).matches(/^[A-Z0-9]+$/).withMessage("Rep code: 3–10 chars, uppercase letters & numbers only")
    : r
);

// -------- Customer --------
const createCustomerRules = [
  body("customerCode").isString().trim().isLength({ min: 5, max: 10 }).withMessage("5–10 chars required").matches(/^[A-Z0-9]+$/).withMessage("Only uppercase letters & numbers allowed"),
  body("name").isString().trim().isLength({ min: 5, max: 100 }).withMessage("Name 5–100 chars"),
  body("address").isString().trim().isLength({ min: 10, max: 100 }).withMessage("Address 10–100 chars"),
  body("city").isString().trim().isLength({ min: 4, max: 100 }).withMessage("City 4–100 chars"),
  body("owner").isString().trim().isLength({ min: 5, max: 100 }).withMessage("Owner 5–100 chars"),
  body("contactNumber").isString().trim().matches(/^\+?[0-9]{7,15}$/).withMessage("Invalid contact number"),
  body("salesRep").optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage("Sales rep 1–50 chars"),
  body("creditLimit").optional().isFloat({ min: 0, max: 1e7 }).withMessage("0–10,000,000 only"),
  body("creditPeriod").optional().isInt({ min: 0, max: 365 }).withMessage("0–365 days only"),
  body("status").optional().isIn(["active", "suspended"]).withMessage("Invalid status"),
];

const updateCustomerRules = createCustomerRules.map(r =>
  r.builder?.fields?.[0] === "customerCode"
    ? body("customerCode").optional().isString().trim().isLength({ min: 5, max: 10 })
        .matches(/^[A-Z0-9]+$/).withMessage("Only uppercase letters & numbers allowed")
    : r
);

module.exports = { 
  mongoId, pagination, 
  createUserRules, loginRules, changePasswordRules, userIdParam,
  createSupplierRules, updateSupplierRules,
  createSalesRepRules, updateSalesRepRules,
  createCustomerRules, updateCustomerRules,
 };
