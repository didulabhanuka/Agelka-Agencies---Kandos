// src/controllers/user/customer.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/user/customer.service");

exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.createCustomer(req.body);
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

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status, salesRep } = req.query;
  const filter = { ...(status ? { status } : {}), ...(salesRep ? { salesRep } : {}) };
  const data = await svc.listCustomers(filter, { page, limit, q });
  res.json(data);
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getCustomer(req.params.id);
  if (!doc) throw new ApiError(404, "Customer not found");
  res.json(doc);
});

exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.updateCustomer(req.params.id, req.body);
  if (!doc) throw new ApiError(404, "Customer not found");
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

exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.removeCustomer(req.params.id);
  if (!doc) throw new ApiError(404, "Customer not found");
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

// ------------------ MANUAL CREDIT CONTROL ------------------
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

exports.snapshot = asyncHandler(async (req, res) => {
  const data = await svc.getCustomerSnapshot(req.params.id);
  res.json(data);
});
