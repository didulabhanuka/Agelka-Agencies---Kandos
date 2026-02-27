/**
 * Period Rollover Routes
 * File: server/src/routes/period/period.routes.js
 *
 * Add this to your server/src/routes/index.js:
 * const periodRoutes = require('./period/period.routes');
 * router.use('/period', periodRoutes);
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const {
  performMonthlyRollover,
  getClosedPeriods,
  getHistoricalData,
} = require('../../services/period/periodRollover.service');
const asyncHandler = require('../../utils/asyncHandler');

// ── Middleware: admin only ────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * POST /api/period/rollover
 * Trigger monthly period rollover — admin only
 * Body: { periodLabel: "2025-01" }
 */
router.post(
  '/rollover',
  authenticate,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { periodLabel } = req.body;

    if (!periodLabel) {
      return res.status(400).json({
        error: 'periodLabel is required',
        example: '2025-01',
      });
    }

    const result = await performMonthlyRollover(periodLabel, req.user._id);

    res.status(200).json({
      message: result.message,
      period: result.period,
      success: true,
    });
  })
);

/**
 * GET /api/period/history
 * Get list of all closed periods
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req, res) => {
    const periods = await getClosedPeriods();
    res.status(200).json({ periods });
  })
);

/**
 * GET /api/period/data/:model/:period
 * Query historical data
 * Example: GET /api/period/data/invoices/2025-01
 * Example: GET /api/period/data/invoices/current
 */
router.get(
  '/data/:model/:period',
  authenticate,
  asyncHandler(async (req, res) => {
    const { model, period } = req.params;
    const data = await getHistoricalData(model, period);
    res.status(200).json({ period, model, count: data.length, data });
  })
);

module.exports = router;
