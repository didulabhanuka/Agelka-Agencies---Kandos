// src/controllers/user/customer.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/user/customer.service");

// POST /users/customers - Creates a customer and records an audit log entry.
exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.createCustomer(req.body);

  // Write audit log for customer creation.
  await logAction({
    userId: req.user.userId,
    action: "master.customers.create",
    module: "Masterfile",
    details: { id: doc._id },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.status(201).json(doc);
});

// GET /users/customers - Lists customers with pagination, search, and optional status/salesRep filters.
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status, salesRep } = req.query;
  const filter = { ...(status ? { status } : {}), ...(salesRep ? { salesRep } : {}) };
  const data = await svc.listCustomers(filter, { page, limit, q });
  res.json(data);
});

// GET /users/customers/:id - Returns a single customer by id.
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getCustomer(req.params.id);
  if (!doc) throw new ApiError(404, "Customer not found");
  res.json(doc);
});

// PUT /users/customers/:id - Updates a customer and records an audit log entry.
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.updateCustomer(req.params.id, req.body);
  if (!doc) throw new ApiError(404, "Customer not found");

  // Write audit log for customer update.
  await logAction({
    userId: req.user.userId,
    action: "master.customers.update",
    module: "Masterfile",
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json(doc);
});

// DELETE /users/customers/:id - Deletes a customer and records an audit log entry.
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.removeCustomer(req.params.id);
  if (!doc) throw new ApiError(404, "Customer not found");

  // Write audit log for customer deletion.
  await logAction({
    userId: req.user.userId,
    action: "master.customers.delete",
    module: "Masterfile",
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({ success: true });
});

// PATCH /users/customers/:id/toggle-credit - Manually toggles customer credit block status.
exports.toggleCredit = asyncHandler(async (req, res) => {
  const doc = await svc.toggleCustomerCreditBlock(req.params.id);

  res.json({
    message:
      doc.creditStatus === "blocked"
        ? "Customer credit BLOCKED"
        : "Customer credit UNBLOCKED (auto recalculated)",
    creditStatus: doc.creditStatus,
  });
});

// GET /users/customers/:id/snapshot - Returns customer financial/credit snapshot details.
exports.snapshot = asyncHandler(async (req, res) => {
  const data = await svc.getCustomerSnapshot(req.params.id);
  res.json(data);
});