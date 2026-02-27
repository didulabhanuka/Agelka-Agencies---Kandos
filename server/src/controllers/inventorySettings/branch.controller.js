// controllers/inventorySettings/branch.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const svc = require("../../services/inventorySettings/branch.service");
const { logAction } = require("../../services/audit/audit.service");

// POST /inventory/branches - Creates a branch and records an audit log entry.
exports.create = asyncHandler(async (req, res) => {
  const result = await svc.createBranch(req.body, req.user.userId);

  // Write audit log for branch creation.
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

// GET /inventory/branches - Lists branches using query-based filters from the service layer.
exports.list = asyncHandler(async (req, res) => {
  const data = await svc.listBranches(req.query);
  res.json({ success: true, data });
});

// GET /inventory/branches/:id - Returns a single branch by id.
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getBranch(req.params.id);
  res.json({ success: true, data: doc });
});

// PUT /inventory/branches/:id - Updates a branch and logs update/activation/deactivation actions.
exports.update = asyncHandler(async (req, res) => {
  const updated = await svc.updateBranch(req.params.id, req.body, req.user.userId);

  // Write audit log and classify action based on resulting status transition.
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

// DELETE /inventory/branches/:id - Permanently deletes a branch and records audit log.
exports.delete = asyncHandler(async (req, res) => {
  const deleted = await svc.deleteBranch(req.params.id);

  // Write audit log for hard delete action.
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