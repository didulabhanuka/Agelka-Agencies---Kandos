// controllers/sale/salesInvoice.controller.js
const mongoose = require("mongoose");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/sale/salesInvoice.service");

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

  // ✅ SalesRep creates invoice => force ownership
  if (actorType === "SalesRep") payload.salesRep = salesRepId;

  const result = await svc.createSalesInvoice(payload);

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

// -------------------- GET SINGLE --------------------
exports.get = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const doc = await svc.getInvoice(req.params.id, scope);

  if (!doc) throw new ApiError(404, "Sales Invoice not found");
  return res.json(doc);
});

// -------------------- LIST --------------------
exports.list = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);

  const { customer, status, limit, branch, salesRep } = req.query;

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const docs = await svc.listInvoices(
    { customer, status, branch, salesRep }, // Admin can filter by query
    { limit: Number(limit) || 100 },
    scope
  );

  return res.json(docs);
});

// -------------------- APPROVE INVOICE (Admin/DataEntry only by routes) --------------------
exports.approve = asyncHandler(async (req, res) => {
  const { userId } = getActorIds(req);

  const updated = await svc.approveInvoice(req.params.id, userId);
  if (!updated) throw new ApiError(404, "Sales Invoice not found");

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

// -------------------- DELETE (scoped) --------------------
exports.delete = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActorIds(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const deleted = await svc.deleteInvoice(req.params.id, scope);

  if (!deleted) throw new ApiError(404, "Sales Invoice not found");

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

// -------------------- UPDATE (scoped) --------------------
exports.update = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActorIds(req);

  // ✅ SalesRep should NOT change salesRep field via payload
  const payload = { ...req.body };
  if (actorType === "SalesRep") delete payload.salesRep;

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const updated = await svc.updateInvoice(req.params.id, payload, scope);

  if (!updated) throw new ApiError(404, "Sales Invoice not found");

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

// -------------------- AVAILABLE ITEMS (scoped by salesRep) --------------------
exports.listAvailableItems = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActorIds(req);

  const branchId = req.query.branch || req.body.branch;
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new ApiError(400, "Invalid branch ID");
  }

  const items = await svc.listAvailableSaleItems(branchId, actorType === "SalesRep" ? salesRepId : null);
  return res.json({ success: true, data: items });
});

module.exports = exports;
