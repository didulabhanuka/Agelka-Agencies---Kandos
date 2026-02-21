// controllers/inventory/businessLedger.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const svc = require("../../services/ledger/businessLedger.service");

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

// ✅ SalesRep scope resolver (same pattern as other ledger controllers)
function resolveSalesRepScope(req) {
  if (req.authActor?.actorType === "SalesRep") return String(req.authActor.id);
  return req.query.salesRep || null;
}

// --------------------------------------------------
// 📊 Get Overall Business Summary
// --------------------------------------------------
exports.getBusinessSummary = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch;
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // ✅ NEW
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const summary = await svc.getBusinessSummary(filters);

  res.status(200).json({
    message: "✅ Business summary retrieved successfully.",
    summary,
  });
});

// --------------------------------------------------
// 🧾 Get Item-wise Profitability
// --------------------------------------------------
exports.getItemSummary = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch;
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // ✅ NEW
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const items = await svc.getItemSummary(filters);

  res.status(200).json({
    message: "✅ Item-wise summary retrieved.",
    count: items.length,
    items,
  });
});

// --------------------------------------------------
// 🏢 Get Branch-wise Profitability
// --------------------------------------------------
exports.getBranchSummary = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch; // ✅ allow optional branch filter
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // ✅ NEW
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const branches = await svc.getBranchSummary(filters);

  res.status(200).json({
    message: "✅ Branch summary retrieved.",
    count: branches.length,
    branches,
  });
});

// --------------------------------------------------
// 🧠 Get Full Business Snapshot (summary + branch + item)
// --------------------------------------------------
exports.getBusinessSnapshot = asyncHandler(async (req, res) => {
  const { branch, from, to } = req.query;
  const { fromDate, toDate } = normalizeDateRange(from, to);

  const filters = {};
  if (branch) filters.branch = branch;
  if (fromDate) filters.from = fromDate;
  if (toDate) filters.to = toDate;

  // ✅ NEW
  const scopedSalesRep = resolveSalesRepScope(req);
  if (scopedSalesRep) filters.salesRep = scopedSalesRep;

  const snapshot = await svc.getBusinessSnapshot(filters);

  res.status(200).json({
    message: "✅ Business snapshot retrieved successfully.",
    ...snapshot,
  });
});
