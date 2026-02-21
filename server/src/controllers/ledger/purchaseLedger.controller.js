// controllers/inventory/purchaseLedger.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const Branch = require("../../models/inventorySettings/branch.model");
const {
  listPurchaseLedger,
  getPurchaseSummaryBySupplier,
  getPurchaseSummaryByItem,
  getPurchaseSnapshot,
} = require("../../services/ledger/purchaseLedger.service");

const normalizeDateRange = (from, to) => {
  let fromDate = null, toDate = null;
  if (from) { fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0); }
  if (to) { toDate = new Date(to); toDate.setHours(23, 59, 59, 999); }
  return { fromDate, toDate };
};

function resolveSalesRepScope(req) {
  // SalesRep actor => force own
  if (req.authActor?.actorType === "SalesRep") return String(req.authActor.id);
  // staff => allow optional query.salesRep
  return req.query.salesRep || null;
}

exports.list = asyncHandler(async (req, res) => {
  const { branch, supplier, from, to } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const { fromDate, toDate } = normalizeDateRange(from, to);

  const rows = await listPurchaseLedger({
    branch: branchObj,
    supplier,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json(rows);
});

exports.summaryBySupplier = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const { fromDate, toDate } = normalizeDateRange(from, to);

  const summary = await getPurchaseSummaryBySupplier({
    branch: branchObj,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json(summary);
});

exports.summaryByItem = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const { fromDate, toDate } = normalizeDateRange(from, to);

  const summary = await getPurchaseSummaryByItem({
    branch: branchObj,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json(summary);
});

exports.snapshot = asyncHandler(async (req, res) => {
  const { branch, supplier, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const snapshot = await getPurchaseSnapshot({
    branch: branchObj,
    supplier,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json({ message: "✅ Purchase snapshot retrieved successfully.", ...snapshot });
});
