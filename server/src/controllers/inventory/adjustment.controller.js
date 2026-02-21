// controllers/inventory/adjustment.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/inventory/adjustment.service");

function getActor(req) {
  const actorType = req.user?.actorType;
  const userId = req.user?.userId || null;
  const salesRepId = req.user?.salesRepId || null;

  const auditActorId = userId || salesRepId || null;

  return { actorType, userId, salesRepId, auditActorId };
}

// --------------------------------------------------
// CREATE
// --------------------------------------------------
exports.create = asyncHandler(async (req, res) => {
  const { actorType, userId, salesRepId, auditActorId } = getActor(req);

  const payload = {
    ...req.body,
    branch: req.body.branch,
  };

  // ✅ enforce ownership
  if (actorType === "SalesRep") {
    payload.salesRep = salesRepId;
    payload.createdBy = null;
    payload.createdBySalesRep = salesRepId;
  } else {
    // Admin/DataEntry
    payload.createdBy = userId;
    payload.createdBySalesRep = null;
    // Admin can set salesRep explicitly (required)
  }

  const adj = await svc.createAdjustment(payload);

  await logAction({
    userId: auditActorId,
    action: "transactions.adjustment.create",
    module: "Transactions",
    details: {
      adjustmentId: adj._id,
      adjustmentNo: adj.adjustmentNo,
      type: adj.type,
      branch: adj.branch,
      salesRep: adj.salesRep || null,
      totalValue: adj.totalValue,
      itemCount: adj.items?.length || 0,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.status(201).json(adj);
});

// --------------------------------------------------
// APPROVE (Admin/DataEntry only via routes)
// --------------------------------------------------
exports.approve = asyncHandler(async (req, res) => {
  const { userId } = getActor(req);

  const adjDoc = await svc.getAdjustment(req.params.id);
  if (!adjDoc) throw new ApiError(404, "Adjustment not found");

  if (adjDoc.status !== "waiting_for_approval") {
    throw new ApiError(400, "Only adjustments in 'waiting_for_approval' can be approved");
  }

  const updated = await svc.approveAdjustment(req.params.id, userId);

  await logAction({
    userId,
    action: "transactions.adjustment.approve",
    module: "Transactions",
    details: {
      adjustmentId: updated._id,
      adjustmentNo: updated.adjustmentNo,
      branch: updated.branch,
      type: updated.type,
      salesRep: updated.salesRep || null,
      approvedAt: updated.approvedAt || null,
      itemCount: updated.items?.length || 0,
      newStatus: updated.status,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json(updated);
});

// --------------------------------------------------
// LIST (scoped)
// --------------------------------------------------
exports.list = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActor(req);

  const { status, branch, salesRep } = req.query;

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const list = await svc.listAdjustments({ status, branch, salesRep }, scope);

  res.json(list);
});

// --------------------------------------------------
// GET (scoped)
// --------------------------------------------------
exports.get = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActor(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const doc = await svc.getAdjustment(req.params.id, scope);

  if (!doc) throw new ApiError(404, "Adjustment not found");
  res.json(doc);
});

// --------------------------------------------------
// DELETE (scoped)
// --------------------------------------------------
exports.delete = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActor(req);

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const deleted = await svc.deleteAdjustment(req.params.id, scope);

  await logAction({
    userId: auditActorId,
    action: "transactions.adjustment.delete",
    module: "Transactions",
    details: { adjustmentId: req.params.id },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({ message: "Stock Adjustment deleted successfully", ...deleted });
});

// --------------------------------------------------
// UPDATE (scoped)
// --------------------------------------------------
exports.update = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActor(req);

  const payload = { ...req.body };

  // ✅ SalesRep cannot change salesRep ownership
  if (actorType === "SalesRep") delete payload.salesRep;

  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const updated = await svc.updateAdjustment(req.params.id, payload, scope);

  await logAction({
    userId: auditActorId,
    action: "transactions.adjustment.update",
    module: "Transactions",
    details: { adjustmentId: updated._id, branch: updated.branch },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json(updated);
});
