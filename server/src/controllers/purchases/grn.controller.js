// controllers/purchases/grn.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/purchases/grn.service");

// Returns normalized actor context used for service-layer authorization and ownership rules.
const actor = (req) => ({
  actorType: req.authActor?.actorType,
  actorId: req.authActor?.id,
});

// POST /purchases/grn - Creates a GRN (drafted as waiting_for_approval) for User or SalesRep actors.
exports.create = asyncHandler(async (req, res) => {
  const result = await svc.createGRN(
    {
      ...req.body,
      branch: req.body.branch,
    },
    actor(req)
  );

  // Write audit log for GRN creation.
  await logAction({
    userId: req.authActor?.id,
    action: "transactions.grn.create",
    module: "Transactions",
    details: {
      grnId: result._id,
      grnNo: result.grnNo,
      branch: result.branch,
      supplierInvoiceNo: result.supplierInvoiceNo || null,
      totalValue: result.totalValue,
      salesRep: result.salesRep,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.status(201).json({ message: "✅ GRN created (waiting_for_approval).", grn: result });
});

// GET /purchases/grn/:id - Returns a single GRN with an additional ownership check for SalesRep actors.
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getGRN(req.params.id);
  if (!doc) throw new ApiError(404, "GRN not found");

  // Enforce SalesRep ownership when a sales rep requests a single GRN.
  if (req.authActor?.actorType === "SalesRep") {
    if (String(doc.salesRep?._id || doc.salesRep) !== String(req.authActor.id)) {
      throw new ApiError(403, "Forbidden");
    }
  }

  res.json(doc);
});

// GET /purchases/grn - Lists GRNs using route scope filter plus optional supplier/status/branch/salesRep filters.
exports.list = asyncHandler(async (req, res) => {
  console.log('Request Headers:', req.headers);
  const { supplier, status, limit, branch } = req.query;

  // Start from middleware-provided scope filter (e.g., SalesRep own records only).
  const query = { ...req.scopeFilter };
  if (supplier) query.supplier = supplier;
  if (status) query.status = status;
  if (branch) query.branch = branch;
  if (req.query.salesRep) query.salesRep = req.query.salesRep;

  const docs = await svc.listGRN(query, { limit: Number(limit) || 100 });
  res.json(docs);
});

// GET /purchases/grn/summary - Returns GRN summary metrics.
exports.summary = asyncHandler(async (_req, res) => {
  const data = await svc.getGRNSummary();
  res.json(data);
});

// POST /purchases/grn/:id/approve - Approves a GRN (User actors only) and posts ledger impacts.
exports.approve = asyncHandler(async (req, res) => {
  if (req.authActor?.actorType !== "User") throw new ApiError(403, "Forbidden");

  const updatedGRN = await svc.approveGRN(req.params.id, req.authActor.id);
  if (!updatedGRN) throw new ApiError(404, "GRN not found");

  // Write audit log for GRN approval.
  await logAction({
    userId: req.authActor.id,
    action: "transactions.grn.approve",
    module: "Transactions",
    details: {
      grnId: updatedGRN._id,
      grnNo: updatedGRN.grnNo,
      status: updatedGRN.status,
      branch: updatedGRN.branch,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({ message: "✅ GRN approved — ledgers updated.", grn: updatedGRN });
});

// PUT /purchases/grn/:id - Updates a GRN with actor-based authorization handled in the service layer.
exports.update = asyncHandler(async (req, res) => {
  const updated = await svc.updateGRN(req.params.id, req.body, actor(req));

  // Write audit log for GRN update.
  await logAction({
    userId: req.authActor?.id,
    action: "transactions.grn.update",
    module: "Transactions",
    details: {
      grnId: req.params.id,
      grnNo: updated.grnNo,
      branch: updated.branch,
      totalValue: updated.totalValue,
      salesRep: updated.salesRep,
    },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({ message: "📝 GRN updated successfully.", grn: updated });
});

// DELETE /purchases/grn/:id - Deletes a GRN with actor-based authorization handled in the service layer.
exports.delete = asyncHandler(async (req, res) => {
  const result = await svc.deleteGRN(req.params.id, actor(req));

  // Write audit log for GRN deletion.
  await logAction({
    userId: req.authActor?.id,
    action: "transactions.grn.delete",
    module: "Transactions",
    details: { grnId: result.deletedId, grnNo: result.grnNo },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({ message: "🗑 GRN deleted successfully.", deletedId: result.deletedId });
});