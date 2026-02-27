// controllers/inventory/adjustment.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/inventory/adjustment.service");

// Extracts authenticated actor context used for authorization and audit logging.
function getActor(req) {
  const actorType = req.user?.actorType;
  const userId = req.user?.userId || null;
  const salesRepId = req.user?.salesRepId || null;

  const auditActorId = userId || salesRepId || null;

  return { actorType, userId, salesRepId, auditActorId };
}

// POST /inventory/adjustments - Creates a stock adjustment with actor-based ownership enforcement.
exports.create = asyncHandler(async (req, res) => {
  const { actorType, userId, salesRepId, auditActorId } = getActor(req);

  const payload = {
    ...req.body,
    branch: req.body.branch,
  };

  // Enforce creator/owner fields based on authenticated actor type.
  if (actorType === "SalesRep") {
    payload.salesRep = salesRepId;
    payload.createdBy = null;
    payload.createdBySalesRep = salesRepId;
  } else {
    // Internal users (Admin / DataEntry) are recorded as createdBy and may assign salesRep explicitly.
    payload.createdBy = userId;
    payload.createdBySalesRep = null;
  }

  const adj = await svc.createAdjustment(payload);

  // Write audit log for adjustment creation.
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

// POST /inventory/adjustments/:id/approve - Approves a pending adjustment (restricted by route middleware to Admin/DataEntry).
exports.approve = asyncHandler(async (req, res) => {
  const { userId } = getActor(req);

  const adjDoc = await svc.getAdjustment(req.params.id);
  if (!adjDoc) throw new ApiError(404, "Adjustment not found");

  // Only pending adjustments can transition to approved state.
  if (adjDoc.status !== "waiting_for_approval") {
    throw new ApiError(400, "Only adjustments in 'waiting_for_approval' can be approved");
  }

  const updated = await svc.approveAdjustment(req.params.id, userId);

  // Write audit log for approval action.
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

// GET /inventory/adjustments - Lists adjustments with role-based scope filtering.
exports.list = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActor(req);

  const { status, branch, salesRep } = req.query;

  // Sales reps can only see their own adjustments.
  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const list = await svc.listAdjustments({ status, branch, salesRep }, scope);

  res.json(list);
});

// GET /inventory/adjustments/:id - Returns a single adjustment within actor scope.
exports.get = asyncHandler(async (req, res) => {
  const { actorType, salesRepId } = getActor(req);

  // Sales reps can only access their own adjustment records.
  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const doc = await svc.getAdjustment(req.params.id, scope);

  if (!doc) throw new ApiError(404, "Adjustment not found");
  res.json(doc);
});

// DELETE /inventory/adjustments/:id - Deletes an adjustment within actor scope and records audit log.
exports.delete = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActor(req);

  // Sales reps can only delete their own adjustments.
  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const deleted = await svc.deleteAdjustment(req.params.id, scope);

  // Write audit log for delete action.
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

// PUT /inventory/adjustments/:id - Updates an adjustment within actor scope and records audit log.
exports.update = asyncHandler(async (req, res) => {
  const { actorType, salesRepId, auditActorId } = getActor(req);

  const payload = { ...req.body };

  // Prevent sales reps from changing adjustment ownership.
  if (actorType === "SalesRep") delete payload.salesRep;

  // Sales reps can only update their own adjustments.
  const scope = actorType === "SalesRep" ? { salesRep: salesRepId } : {};
  const updated = await svc.updateAdjustment(req.params.id, payload, scope);

  // Write audit log for update action.
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