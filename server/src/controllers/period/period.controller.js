// server/src/controllers/period/period.controller.js
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const {
  performRollover,
  getCurrentCounts,
  getClosedPeriods,
  getRolloverStatus,
  getHistoricalData,
} = require('../../services/period/periodRollover.service');

// POST /api/period/rollover — Trigger or resume a period rollover. Admin only.
// Body: { periodLabel, fromDate, toDate }
exports.rollover = asyncHandler(async (req, res) => {
  const { periodLabel, fromDate, toDate } = req.body;

  if (!periodLabel) throw new ApiError(400, 'periodLabel is required');
  if (!fromDate)    throw new ApiError(400, 'fromDate is required (YYYY-MM-DD)');
  if (!toDate)      throw new ApiError(400, 'toDate is required (YYYY-MM-DD)');

  const result = await performRollover(periodLabel, fromDate, toDate, req.user.userId);

  await logAction({
    userId: req.user.userId,
    action: 'period.rollover',
    module: 'Period',
    details: { period: result.period, fromDate, toDate, summary: result.summary },
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

// GET /api/period/status — Active or failed rollover job. Admin only.
exports.status = asyncHandler(async (req, res) => {
  const activeJob = await getRolloverStatus();
  res.json({ activeJob, hasActiveJob: !!activeJob });
});

// GET /api/period/counts?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
// Returns live document counts filtered by date range. Admin only.
exports.counts = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;
  const counts = await getCurrentCounts(fromDate || null, toDate || null);
  res.json(counts);
});

// GET /api/period/history — All closed periods.
exports.history = asyncHandler(async (req, res) => {
  const periods = await getClosedPeriods();
  res.json({ periods, count: periods.length });
});

// GET /api/period/data/:model/:period — Historical data for a closed period.
exports.historicalData = asyncHandler(async (req, res) => {
  const { model, period } = req.params;
  const data = await getHistoricalData(model, period.toUpperCase());
  res.json({ period: period.toUpperCase(), model, count: data.length, data });
});