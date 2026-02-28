// src/controllers/period/period.controller.js
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const {
  performRollover,
  getClosedPeriods,
  getRolloverStatus,
  getHistoricalData,
} = require('../../services/period/periodRollover.service');

// POST /api/period/rollover — Triggers or resumes a period rollover. Admin only.
exports.rollover = asyncHandler(async (req, res) => {
  const { periodLabel } = req.body;

  if (!periodLabel) {
    throw new ApiError(400, 'periodLabel is required (e.g. "2025-Q1", "JAN-2025")');
  }

  const result = await performRollover(periodLabel, req.user.userId);

  // Write audit log for period rollover.
  await logAction({
    userId: req.user.userId,
    action: 'period.rollover',
    module: 'Period',
    details: { period: result.period, summary: result.summary },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.status(200).json({
    success: true,
    message: result.message,
    period: result.period,
    summary: result.summary,
  });
});

// GET /api/period/status — Returns active or failed rollover job. Admin only.
exports.status = asyncHandler(async (req, res) => {
  const activeJob = await getRolloverStatus();
  res.json({
    activeJob,
    hasActiveJob: !!activeJob,
  });
});

// GET /api/period/history — Returns all successfully closed periods.
exports.history = asyncHandler(async (req, res) => {
  const periods = await getClosedPeriods();
  res.json({ periods, count: periods.length });
});

// GET /api/period/data/:model/:period — Returns historical data for a closed period.
// Valid models: invoices | returns | adjustments | repStocks |
//               grns | salesLedger | purchaseLedger | stockLedger | payments
exports.historicalData = asyncHandler(async (req, res) => {
  const { model, period } = req.params;
  const data = await getHistoricalData(model, period.toUpperCase());
  res.json({
    period: period.toUpperCase(),
    model,
    count: data.length,
    data,
  });
});