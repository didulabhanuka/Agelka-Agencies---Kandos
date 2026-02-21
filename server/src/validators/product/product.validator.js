const { body, param, query } = require('express-validator');

const mongoId = () => param('id').isMongoId();
const pagination = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('q').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended']),
];

// -------- Brand --------
const createBrandRules = [
  body('brandCode').isString().trim().isLength({ min: 1 }),
  body('name').isString().trim().isLength({ min: 1 }),
  body('status').optional().isIn(['active', 'inactive']),
];
const updateBrandRules = createBrandRules.map(r =>
  r.builder.fields[0] === 'brandCode'
    ? body('brandCode').optional().isString().trim().isLength({ min: 1 })
    : r
);

// -------- Product Group (updated) --------
const createGroupRules = [
  body('groupCode').isString().trim().isLength({ min: 1 }),
  body('name').isString().trim().isLength({ min: 1 }),
  body('brand').optional().isMongoId(),
  body('description').optional().isString().trim(),
  body('status').optional().isIn(['active', 'inactive']),
];
const updateGroupRules = createGroupRules.map(r =>
  r.builder.fields[0] === 'groupCode'
    ? body('groupCode').optional().isString().trim().isLength({ min: 1 })
    : r
);

// -------- Product Type (updated) --------
const createTypeRules = [
  body('typeCode').isString().trim().isLength({ min: 1 }),
  body('name').isString().trim().isLength({ min: 1 }),
  body('baseUnit').optional().isString().trim(),
  body('subUnits').optional().isArray(),
  body('description').optional().isString().trim(),
  body('status').optional().isIn(['active', 'inactive']),
];
const updateTypeRules = createTypeRules.map(r =>
  r.builder.fields[0] === 'typeCode'
    ? body('typeCode').optional().isString().trim().isLength({ min: 1 })
    : r
);

// -------- Brand Unit Config --------
const createBrandUnitRules = [
  body('brand').isMongoId(),
  body('productType').isMongoId(),
  body('baseUnit').isString().trim().isLength({ min: 1 }),
  body('conversionFactor').isInt({ min: 1 }),
  body('note').optional().isString().trim(),
  body('status').optional().isIn(['active', 'inactive']),
];
const updateBrandUnitRules = createBrandUnitRules.map(r =>
  r.builder.fields.includes('brand') && r.builder.fields.includes('productType')
    ? body('brand').optional().isMongoId() // upsert flow supported at controller/service level
    : r
);

// -------- Item --------
const createItemRules = [
  body('itemCode').isString().trim().isLength({ min: 1 }),
  body('name').isString().trim().isLength({ min: 1 }),
  body('description').isString().trim().isLength({ min: 1 }),
  body('brand').optional().isMongoId(),
  body('productGroup').optional().isMongoId(),
  body('productType').optional().isMongoId(),
  body('supplier').optional().isMongoId(),

  // removed unit
  body('baseUnit').optional().isString().trim(),
  body('conversionFactor').optional().isInt({ min: 1 }),

  // new validation
  body('avgCostUnit').optional().isFloat({ min: 0 }),
  body('sellingPriceUnit').optional().isFloat({ min: 0 }),
  body('avgCostBase').optional().isFloat({ min: 0 }),
  body('sellingPriceBase').optional().isFloat({ min: 0 }),

  body('reorderLevel').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['active', 'inactive']),
];

const updateItemRules = createItemRules.map(r =>
  r.builder.fields[0] === 'itemCode'
    ? body('itemCode').optional().isString().trim().isLength({ min: 1 })
    : r
);

module.exports = {
  mongoId, pagination,
  // new
  createBrandRules, updateBrandRules,
  createBrandUnitRules, updateBrandUnitRules,
  // updated
  createGroupRules, updateGroupRules,
  createTypeRules, updateTypeRules,
  // extended
  createItemRules, updateItemRules,
};
