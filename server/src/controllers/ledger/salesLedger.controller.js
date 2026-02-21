// controllers/inventory/salesLedger.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const Branch = require("../../models/inventorySettings/branch.model");

const {
  listSalesLedger,
  getSalesSummaryByItem,
  getSalesSummaryByCustomer,
  getSalesSnapshot,
} = require("../../services/ledger/salesLedger.service");

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

function resolveSalesRepScope(req) {
  // SalesRep actor => force own
  if (req.authActor?.actorType === "SalesRep") return String(req.authActor.id);
  // staff => allow optional query.salesRep
  return req.query.salesRep || null;
}

// LIST SALES LEDGER
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
    salesRep: resolveSalesRepScope(req), // ✅ NEW
    from: fromDate,
    to: toDate,
  });

  res.json(rows);
});

// ITEM SUMMARY
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
    salesRep: resolveSalesRepScope(req), // ✅ NEW
    from: fromDate,
    to: toDate,
  });

  res.json(summary);
});

// CUSTOMER SUMMARY
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
    salesRep: resolveSalesRepScope(req), // ✅ NEW
    from: fromDate,
    to: toDate,
  });

  res.json(summary);
});

// FULL SNAPSHOT
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
    salesRep: resolveSalesRepScope(req), // ✅ NEW
    from: fromDate,
    to: toDate,
  });

  res.json({
    message: "✅ Sales snapshot retrieved successfully.",
    ...snapshot,
  });
});
