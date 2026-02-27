// controllers/sale/salesInvoice.controller.js
const mongoose = require("mongoose");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/sale/salesInvoice.service");

// Extracts authenticated actor ids used for scope enforcement and audit logging.
function getActorIds(req) {
  return {
    actorType: req.user?.actorType,
    userId: req.user?.userId || null,
    salesRepId: req.user?.salesRepId || null,
    auditActorId: req.user?.userId || req.user?.salesRepId || null,
  };
}

// POST /sales/invoices - Creates a sales invoice and enforces SalesRep ownership when applicable.
exports.create = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActorIds(req);

  const payload = { ...req.body };

  // Force salesRep ownership when the invoice is created by a SalesRep actor.
  if (actorType === "SalesRep") payload.salesRep = salesRepId;

  const result = await svc.createSalesInvoice(payload);

  // Write audit log for invoice creation.
  await logAction({
    userId: auditActorId,
    action: "transactions.salesInvoice.create",
    module: "Transactions",
    details: {
      invoiceId: result._id,
      invoiceNo: result.invoiceNo,
      branch: result.branch,
      totalValue: result.totalValue,
      customer: result.customer,
      salesRep: result.salesRep || null,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.status(201).json({
    message: "✅ Sales Invoice created and awaiting approval.",
    invoice: result,
  });
});

// GET /sales/invoices/:id - Returns one invoice within actor scope (SalesRep restricted to own records).
exports.get = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const doc = await svc.getInvoice(req.params.id, scope);

  if (!doc) throw new ApiError(404, "Sales Invoice not found");
  return res.json(doc);
});

// GET /sales/invoices - Lists invoices with query filters and actor-based scope.
exports.list = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);
  const { customer, status, limit, branch, salesRep } = req.query;

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const docs = await svc.listInvoices(
    { customer, status, branch, salesRep },
    { limit: Number(limit) || 100 },
    scope
  );

  return res.json(docs);
});

// POST /sales/invoices/:id/approve - Approves an invoice (route-restricted to Admin/DataEntry) and posts ledger updates.
exports.approve = asyncHandler(async (req, res) => {
  const { userId } = getActorIds(req);

  const updated = await svc.approveInvoice(req.params.id, userId);
  if (!updated) throw new ApiError(404, "Sales Invoice not found");

  // Write audit log for invoice approval.
  await logAction({
    userId,
    action: "transactions.salesInvoice.approve",
    module: "Transactions",
    details: {
      invoiceId: updated._id,
      invoiceNo: updated.invoiceNo,
      status: updated.status,
      branch: updated.branch,
      salesRep: updated.salesRep || null,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  return res.json({
    message: "✅ Sales Invoice approved — ledgers updated and credit re-evaluated.",
    invoice: updated,
  });
});

// DELETE /sales/invoices/:id - Deletes an invoice within actor scope and records an audit log.
exports.delete = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActorIds(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const deleted = await svc.deleteInvoice(req.params.id, scope);

  if (!deleted) throw new ApiError(404, "Sales Invoice not found");

  // Write audit log for invoice deletion.
  await logAction({
    userId: auditActorId,
    action: "transactions.salesInvoice.delete",
    module: "Transactions",
    details: {
      invoiceId: deleted._id,
      invoiceNo: deleted.invoiceNo,
      branch: deleted.branch,
      salesRep: deleted.salesRep || null,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  return res.json({
    message: "🗑️ Sales Invoice deleted successfully.",
    invoice: deleted,
  });
});

// PUT /sales/invoices/:id - Updates an invoice within actor scope and prevents SalesRep ownership changes.
exports.update = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActorIds(req);

  // Prevent SalesRep actors from changing invoice ownership via payload.
  const payload = { ...req.body };
  if (actorType === "SalesRep") delete payload.salesRep;

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const updated = await svc.updateInvoice(req.params.id, payload, scope);

  if (!updated) throw new ApiError(404, "Sales Invoice not found");

  // Write audit log for invoice update.
  await logAction({
    userId: auditActorId,
    action: "transactions.salesInvoice.update",
    module: "Transactions",
    details: {
      invoiceId: updated._id,
      invoiceNo: updated.invoiceNo,
      branch: updated.branch,
      salesRep: updated.salesRep || null,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  return res.json({
    message: "✏️ Sales Invoice updated successfully.",
    invoice: updated,
  });
});

// GET /sales/invoices/available-items - Returns sellable items for a branch, scoped to SalesRep stock when applicable.
exports.listAvailableItems = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, userId } = getActorIds(req);

  const branchId = req.query.branch || req.body.branch;
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new ApiError(400, "Invalid branch ID");
  }

  const resolvedSalesRepId = actorType === "SalesRep" 
    ? salesRepId 
    : req.query.salesRep || req.body.salesRep;

  if (!resolvedSalesRepId || !mongoose.Types.ObjectId.isValid(resolvedSalesRepId)) {
    throw new ApiError(400, "Sales Rep ID is required to load available items");
  }

  const items = await svc.listAvailableSaleItems(branchId, resolvedSalesRepId);

  return res.json({ success: true, data: items });
});

module.exports = exports;