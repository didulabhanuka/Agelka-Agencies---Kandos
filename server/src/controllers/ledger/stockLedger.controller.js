// controllers/inventory/stockLedger.controller.js
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

const normalizeDateRange = (from, to) => {
  let fromDate = null, toDate = null;
  if (from) { fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0); }
  if (to) { toDate = new Date(to); toDate.setHours(23, 59, 59, 999); }
  return { fromDate, toDate };
};

function resolveSalesRepScope(req) {
  if (req.authActor?.actorType === "SalesRep") return String(req.authActor.id);
  return req.query.salesRep || null;
}

// Manual post (staff only route)
exports.postEntry = asyncHandler(async (req, res) => {
  const { item, branch, salesRep, transactionType, refModel, refId, qty, avgCostBase, itemTotalValue, remarks } = req.body;

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

exports.getBalance = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const branch = req.query.branch;

  // Validate required parameters
  if (!itemId) throw new ApiError(400, "Item ID is required");
  if (!branch) throw new ApiError(400, "Branch ID is required");

  // Fetch the branch document
  const branchDoc = await Branch.findById(branch).lean();
  if (!branchDoc) throw new ApiError(400, "Invalid branch selected");

  // Get the current stock balance for the given item, branch, and sales rep (if applicable)
  const qtyOnHand = await getItemBalance(itemId, branchDoc._id, resolveSalesRepScope(req));

  // Return the response with structured data
  res.json({
    itemId,
    branchId: branchDoc._id,
    branchName: branchDoc.name,
    salesRep: resolveSalesRepScope(req),
    qtyOnHand: {
      baseQty: qtyOnHand.qtyOnHand?.baseQty || 0,   // Ensure it's always a number, default to 0
      primaryQty: qtyOnHand.qtyOnHand?.primaryQty || 0  // Ensure it's always a number, default to 0
    },
    itemTotalValue: qtyOnHand.itemTotalValue || 0, // Default to 0 if missing
  });
});


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
