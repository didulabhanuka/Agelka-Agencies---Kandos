const express = require('express');
const router = express.Router();
const auditCtrl = require('../../controllers/audit/audit.controller');
const { verifyJWT, requireRole } = require('../../middlewares/auth/auth.middleware');
const { param, query, validationResult } = require('express-validator');

// Validation rules
const validateAudit = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
];

const handleValidation = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return next(Object.assign(new Error('ValidationError'), { status: 400, details: errors.array() }));
  next();
};

// Routes (Admin only)
router.get('/', verifyJWT, requireRole('Admin'), validateAudit, handleValidation, auditCtrl.getLogs);
router.get('/:id', verifyJWT, requireRole('Admin'), [param('id').isMongoId()], handleValidation, auditCtrl.getLogById);

module.exports = router;
