// controllers/sale/salesReturn.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/sale/salesReturn.service");

function getActorIds(req) {
  return {
    actorType: req.user?.actorType,
    userId: req.user?.userId || null,
    salesRepId: req.user?.salesRepId || null,
    auditActorId: req.user?.userId || req.user?.salesRepId || null,
  };
}

// -------------------- CREATE --------------------
exports.create = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActorIds(req);

  const payload = { ...req.body };

  // ✅ SalesRep creates return => force ownership
  if (actorType === "SalesRep") payload.salesRep = salesRepId;

  const result = await svc.createSalesReturn(payload);

  await logAction({
    userId: auditActorId,
    action: "transactions.salesReturn.create",
    module: "Transactions",
    details: {
      salesReturnId: result._id,
      returnNo: result.returnNo,
      branch: result.branch,
      totalReturnValue: result.totalReturnValue,
      originalInvoice: result.originalInvoice || null,
      salesRep: result.salesRep || null,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.status(201).json({
    message: "✅ Sales Return created and awaiting approval.",
    salesReturn: result,
  });
});

// -------------------- GET SINGLE (scoped) --------------------
exports.get = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const doc = await svc.getSalesReturn(req.params.id, scope);

  if (!doc) throw new ApiError(404, "Sales Return not found");
  res.json(doc);
});

// -------------------- LIST (scoped) --------------------
exports.list = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);

  const { customer, status, limit, branch, originalInvoice, salesRep } = req.query;

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const docs = await svc.listSalesReturns(
    { customer, status, branch, originalInvoice, salesRep },
    { limit: Number(limit) || 100 },
    scope
  );

  res.json(docs);
});

// -------------------- APPROVE (Admin/DataEntry only by routes) --------------------
exports.approve = asyncHandler(async (req, res) => {
  const { userId } = getActorIds(req);

  const updated = await svc.approveSalesReturn(req.params.id, userId);
  if (!updated) throw new ApiError(404, "Sales Return not found");

  await logAction({
    userId,
    action: "transactions.salesReturn.approve",
    module: "Transactions",
    details: {
      salesReturnId: updated._id,
      returnNo: updated.returnNo,
      status: updated.status,
      branch: updated.branch,
      originalInvoice: updated.originalInvoice || null,
      salesRep: updated.salesRep || null,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({
    message: "✅ Sales Return approved — ledgers updated with returned quantities.",
    salesReturn: updated,
  });
});

module.exports = exports;
