// controllers/purchases/grn.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/purchases/grn.service");

const actor = (req) => ({
  actorType: req.authActor?.actorType,
  actorId: req.authActor?.id,
});

// CREATE GRN (Admin/DataEntry/SalesRep)
exports.create = asyncHandler(async (req, res) => {
  const result = await svc.createGRN(
    {
      ...req.body,
      branch: req.body.branch,
    },
    actor(req)
  );

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

// GET SINGLE GRN (scoped by middleware in list routes; still safe-check here)
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getGRN(req.params.id);
  if (!doc) throw new ApiError(404, "GRN not found");

  // SalesRep can only view own
  if (req.authActor?.actorType === "SalesRep") {
    if (String(doc.salesRep?._id || doc.salesRep) !== String(req.authActor.id)) {
      throw new ApiError(403, "Forbidden");
    }
  }

  res.json(doc);
});

// LIST GRNs (Admin/DataEntry all, SalesRep own via scopeFilter)
// LIST GRNs (Admin/DataEntry all, SalesRep own via scopeFilter)
exports.list = asyncHandler(async (req, res) => {
  console.log('Request Headers:', req.headers);
  const { supplier, status, limit, branch } = req.query;

  const query = { ...req.scopeFilter };  // Ensures the scope filter is applied
  if (supplier) query.supplier = supplier;
  if (status) query.status = status;
  if (branch) query.branch = branch;
  if (req.query.salesRep) query.salesRep = req.query.salesRep;  // Add SalesRep filter here

  const docs = await svc.listGRN(query, { limit: Number(limit) || 100 });
  res.json(docs);
});


// SUMMARY
exports.summary = asyncHandler(async (_req, res) => {
  const data = await svc.getGRNSummary();
  res.json(data);
});

// APPROVE GRN (Admin/DataEntry only)
exports.approve = asyncHandler(async (req, res) => {
  if (req.authActor?.actorType !== "User") throw new ApiError(403, "Forbidden");

  const updatedGRN = await svc.approveGRN(req.params.id, req.authActor.id);
  if (!updatedGRN) throw new ApiError(404, "GRN not found");

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

// UPDATE GRN (Admin/DataEntry/SalesRep, SalesRep only own)
exports.update = asyncHandler(async (req, res) => {
  const updated = await svc.updateGRN(req.params.id, req.body, actor(req));

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

// DELETE GRN (Admin/DataEntry/SalesRep, SalesRep only own)
exports.delete = asyncHandler(async (req, res) => {
  const result = await svc.deleteGRN(req.params.id, actor(req));

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
