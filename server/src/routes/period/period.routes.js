// src/routes/period/period.routes.js
const router = require('express').Router();
const { verifyJWT, requireRole } = require('../../middlewares/auth/auth.middleware');
const periodCtrl = require('../../controllers/period/period.controller');

// Auth guards
const adminOnly = [verifyJWT, requireRole('Admin')];

router
  .post('/rollover', ...adminOnly, periodCtrl.rollover)
  .get('/status',   ...adminOnly, periodCtrl.status)
  .get('/history',  verifyJWT,    periodCtrl.history)
  .get('/data/:model/:period', verifyJWT, periodCtrl.historicalData);

module.exports = router;