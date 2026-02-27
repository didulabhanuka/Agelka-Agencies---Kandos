// controllers/ledger/stockLedger.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const Branch = require("../../models/inventorySettings/branch.model");
const {
  postLedger,
  getItemBalance,
  getItemHistory,
  getCurrentStock,
  getStockSnapshot,
} = require("../../services/ledger/stockLedger.service");

// Normalizes query date strings into inclusive day-bound Date objects.
const normalizeDateRange = (from, to) => {
  let fromDate = null, toDate = null;
  if (from) { fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0); }
  if (to) { toDate = new Date(to); toDate.setHours(23, 59, 59, 999); }
  return { fromDate, toDate };
};

// Resolves effective sales rep scope (forced self-scope for SalesRep actors, optional query scope for staff).
function resolveSalesRepScope(req) {
  if (req.authActor?.actorType === "SalesRep") return String(req.authActor.id);
  return req.query.salesRep || null;
}

// POST /ledger/stock/manual - Creates a manual stock ledger entry (staff-only route).
exports.postEntry = asyncHandler(async (req, res) => {
  const {
    item,
    branch,
    salesRep,
    transactionType,
    refModel,
    refId,
    qty,
    avgCostBase,
    itemTotalValue,
    remarks,
  } = req.body;

  // Validate branch before posting the ledger entry.
  if (!branch) throw new ApiError(400, "Branch ID is required");
  const branchDoc = await Branch.findById(branch).lean();
  if (!branchDoc) throw new ApiError(400, "Invalid branch selected");

  const entry = await postLedger({
    item,
    branch: branchDoc._id,
    salesRep: salesRep || null,
    transactionType,
    refModel,
    refId,
    qty,
    avgCostBase,
    itemTotalValue,
    remarks,
    createdBy: req.authActor?.actorType === "User" ? req.authActor.id : null,
  });

  res.status(201).json(entry);
});

// GET /ledger/stock/balance/:itemId - Returns current stock balance and stock value for one item in a branch.
exports.getBalance = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const branch = req.query.branch;

  // Validate required route/query parameters.
  if (!itemId) throw new ApiError(400, "Item ID is required");
  if (!branch) throw new ApiError(400, "Branch ID is required");

  // Resolve and validate branch id.
  const branchDoc = await Branch.findById(branch).lean();
  if (!branchDoc) throw new ApiError(400, "Invalid branch selected");

  // Read current item balance with sales rep scope applied when relevant.
  const qtyOnHand = await getItemBalance(itemId, branchDoc._id, resolveSalesRepScope(req));

  res.json({
    itemId,
    branchId: branchDoc._id,
    branchName: branchDoc.name,
    salesRep: resolveSalesRepScope(req),
    qtyOnHand: {
      baseQty: qtyOnHand.qtyOnHand?.baseQty || 0,
      primaryQty: qtyOnHand.qtyOnHand?.primaryQty || 0,
    },
    itemTotalValue: qtyOnHand.itemTotalValue || 0,
  });
});

// GET /ledger/stock/history/:itemId - Returns stock ledger history for one item with optional branch and limit filters.
exports.getHistory = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { branch, limit } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const history = await getItemHistory(itemId, {
    branch: branchObj,
    salesRep: resolveSalesRepScope(req),
    limit: Number(limit) || 100,
  });

  res.json(history);
});

// GET /ledger/stock/current - Returns latest on-hand stock rows for the selected branch and sales rep scope.
exports.getStock = asyncHandler(async (req, res) => {
  const { branch } = req.query;

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const rows = await getCurrentStock(branchObj, resolveSalesRepScope(req));
  res.json(rows);
});

// GET /ledger/stock/snapshot - Returns stock movement and on-hand snapshot for the selected filters.
exports.snapshot = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  let branchObj = null;
  if (branch) {
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new ApiError(400, "Invalid branch selected");
    branchObj = branchDoc._id;
  }

  const snapshot = await getStockSnapshot({
    branch: branchObj,
    salesRep: resolveSalesRepScope(req),
    from: fromDate,
    to: toDate,
  });

  res.json({ message: "✅ Stock snapshot retrieved successfully.", ...snapshot });
});