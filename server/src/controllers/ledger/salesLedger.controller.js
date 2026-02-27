// controllers/ledger/salesLedger.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const Branch = require("../../models/inventorySettings/branch.model");

const {
  listSalesLedger,
  getSalesSummaryByItem,
  getSalesSummaryByCustomer,
  getSalesSnapshot,
} = require("../../services/ledger/salesLedger.service");

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

// Resolves effective sales rep scope (forced self-scope for SalesRep actors, optional query scope for staff).
function resolveSalesRepScope(req) {
  // SalesRep actor is always restricted to their own records.
  if (req.authActor?.actorType === "SalesRep") return String(req.authActor.id);
  // Staff users may optionally filter by salesRep.
  return req.query.salesRep || null;
}

// GET /ledger/sales - Returns sales ledger rows filtered by branch, customer, salesRep scope, and date range.
exports.list = asyncHandler(async (req, res) => {
  const { branch, customer, from, to } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const { fromDate, toDate } = normalizeDateRange(from, to);

  const rows = await listSalesLedger({
    branch: branchObj,
    customer,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json(rows);
});

// GET /ledger/sales/summary/items - Returns item-wise sales summary for selected filters.
exports.summaryByItem = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const { fromDate, toDate } = normalizeDateRange(from, to);

  const summary = await getSalesSummaryByItem({
    branch: branchObj,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json(summary);
});

// GET /ledger/sales/summary/customers - Returns customer-wise sales summary for selected filters.
exports.summaryByCustomer = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const { fromDate, toDate } = normalizeDateRange(from, to);

  const summary = await getSalesSummaryByCustomer({
    branch: branchObj,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json(summary);
});

// GET /ledger/sales/snapshot - Returns aggregated sales snapshot (summary + breakdowns) for selected filters.
exports.snapshot = asyncHandler(async (req, res) => {
  const { branch, customer, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const snapshot = await getSalesSnapshot({
    branch: branchObj,
    customer,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json({
    message: "✅ Sales snapshot retrieved successfully.",
    ...snapshot,
  });
});