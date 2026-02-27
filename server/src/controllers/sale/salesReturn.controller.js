// controllers/sale/salesReturn.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/sale/salesReturn.service");

// Extracts authenticated actor ids used for scope enforcement and audit logging.
function getActorIds(req) {
  return {
    actorType: req.user?.actorType,
    userId: req.user?.userId || null,
    salesRepId: req.user?.salesRepId || null,
    auditActorId: req.user?.userId || req.user?.salesRepId || null,
  };
}

// POST /sales/returns - Creates a sales return and enforces SalesRep ownership when applicable.
exports.create = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActorIds(req);

  const payload = { ...req.body };

  // Force salesRep ownership when the return is created by a SalesRep actor.
  if (actorType === "SalesRep") payload.salesRep = salesRepId;

  const result = await svc.createSalesReturn(payload);

  // Write audit log for sales return creation.
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

// GET /sales/returns/:id - Returns one sales return within actor scope (SalesRep restricted to own records).
exports.get = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const doc = await svc.getSalesReturn(req.params.id, scope);

  if (!doc) throw new ApiError(404, "Sales Return not found");
  res.json(doc);
});

// GET /sales/returns - Lists sales returns with query filters and actor-based scope.
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

// POST /sales/returns/:id/approve - Approves a sales return (route-restricted to Admin/DataEntry) and updates ledgers.
exports.approve = asyncHandler(async (req, res) => {
  const { userId } = getActorIds(req);

  const updated = await svc.approveSalesReturn(req.params.id, userId);
  if (!updated) throw new ApiError(404, "Sales Return not found");

  // Write audit log for sales return approval.
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

// DELETE /sales/returns/:id - Deletes a sales return if not approved.
exports.delete = asyncHandler(async (req, res) => {
  const { userId } = getActorIds(req);

  // Delete the sales return
  const result = await svc.deleteSalesReturn(req.params.id);
  if (!result) throw new ApiError(404, "Sales Return not found");

  // Write audit log for sales return deletion
  await logAction({
    userId,
    action: "transactions.salesReturn.delete",
    module: "Transactions",
    details: {
      salesReturnId: req.params.id,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({
    message: "✅ Sales Return deleted successfully.",
  });
});

// PUT /sales/returns/:id - Updates a sales return if not approved.
exports.update = asyncHandler(async (req, res) => {
  const { userId } = getActorIds(req);

  // Update the sales return
  const updated = await svc.updateSalesReturn(req.params.id, req.body);
  if (!updated) throw new ApiError(404, "Sales Return not found");

  // Write audit log for sales return update
  await logAction({
    userId,
    action: "transactions.salesReturn.update",
    module: "Transactions",
    details: {
      salesReturnId: updated._id,
      returnNo: updated.returnNo,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({
    message: "✅ Sales Return updated successfully.",
    salesReturn: updated,
  });
});

module.exports = exports;