// controllers/ledger/businessLedger.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const svc = require("../../services/ledger/businessLedger.service");

// Normalizes query date strings into inclusive day-bound Date objects.
const normalizeDateRange = (from, to) => {
  let fromDate = null;
  let toDate = null;

  if (from) {
    fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
  }

  if (to) {
    toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
  }

  return { fromDate, toDate };
};

// Resolves effective sales rep scope (forced self-scope for SalesRep actors, optional query scope for internal users).
function resolveSalesRepScope(req) {
  if (req.authActor?.actorType === "SalesRep") return String(req.authActor.id);
  return req.query.salesRep || null;
}

// GET /ledger/business/summary - Returns overall business revenue/cost/profit summary for the selected filters.
exports.getBusinessSummary = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch;
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // Apply sales rep scope when provided or when request is from a SalesRep actor.
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const summary = await svc.getBusinessSummary(filters);

  res.status(200).json({
    message: "✅ Business summary retrieved successfully.",
    summary,
  });
});

// GET /ledger/business/items - Returns item-wise profitability summary for the selected filters.
exports.getItemSummary = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch;
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // Apply sales rep scope when provided or when request is from a SalesRep actor.
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const items = await svc.getItemSummary(filters);

  res.status(200).json({
    message: "✅ Item-wise summary retrieved.",
    count: items.length,
    items,
  });
});

// GET /ledger/business/branches - Returns branch-wise profitability summary for the selected filters.
exports.getBranchSummary = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch;
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // Apply sales rep scope when provided or when request is from a SalesRep actor.
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const branches = await svc.getBranchSummary(filters);

  res.status(200).json({
    message: "✅ Branch summary retrieved.",
    count: branches.length,
    branches,
  });
});

// GET /ledger/business/snapshot - Returns combined business snapshot (summary, branch breakdown, item breakdown).
exports.getBusinessSnapshot = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch;
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // Apply sales rep scope when provided or when request is from a SalesRep actor.
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const snapshot = await svc.getBusinessSnapshot(filters);

  res.status(200).json({
    message: "✅ Business snapshot retrieved successfully.",
    ...snapshot,
  });
});