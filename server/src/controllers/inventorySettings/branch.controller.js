// controllers/inventory/branch.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const svc = require("../../services/inventorySettings/branch.service");
const { logAction } = require("../../services/audit/audit.service");

// ---------- Create ----------
exports.create = asyncHandler(async (req, res) => {
  const result = await svc.createBranch(req.body, req.user.userId);
  await logAction({
    userId: req.user.userId,
    action: "master.branch.create",
    module: "Masterfile",
    details: { branchCode: result.branchCode, name: result.name },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });
  res.status(201).json({ success: true, data: result });
});

// ---------- List ----------
exports.list = asyncHandler(async (req, res) => {
  const data = await svc.listBranches(req.query);
  res.json({ success: true, data });
});

// ---------- Get ----------
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getBranch(req.params.id);
  res.json({ success: true, data: doc });
});

// ---------- Update ----------
exports.update = asyncHandler(async (req, res) => {
  const updated = await svc.updateBranch(req.params.id, req.body, req.user.userId);

  await logAction({
    userId: req.user.userId,
    action:
      req.body.status && req.body.status !== updated.status
        ? `master.branch.${updated.status === "active" ? "activate" : "deactivate"}`
        : "master.branch.update",
    module: "Masterfile",
    details: { branchCode: updated.branchCode, name: updated.name, newStatus: updated.status },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({ success: true, data: updated });
});

// ---------- Delete (Hard Delete) ----------
exports.delete = asyncHandler(async (req, res) => {
  const deleted = await svc.deleteBranch(req.params.id);

  await logAction({
    userId: req.user.userId,
    action: "master.branch.delete",
    module: "Masterfile",
    details: { branchCode: deleted.branchCode, name: deleted.name },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({
    success: true,
    message: "Branch permanently deleted.",
    data: deleted,
  });
});