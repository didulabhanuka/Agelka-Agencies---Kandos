// src/controllers/user/saleRep.controller.js
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const svc = require('../../services/user/salesRep.service');

// POST /users/sales-reps - Creates a sales rep and records an audit log entry.
exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.createSalesRep(req.body);

  // Write audit log for sales rep creation.
  await logAction({
    userId: req.user.userId,
    action: 'master.salesReps.create',
    module: 'Masterfile',
    details: { id: doc._id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.status(201).json(doc);
});

// GET /users/sales-reps - Lists sales reps with pagination, search, and optional status filter.
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status } = req.query;
  const data = await svc.listSalesReps({ ...(status ? { status } : {}) }, { page, limit, q });
  res.json(data);
});

// GET /users/sales-reps/:id - Returns a single sales rep by id.
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getSalesRep(req.params.id);
  if (!doc) throw new ApiError(404, 'Sales rep not found');
  res.json(doc);
});

// PUT /users/sales-reps/:id - Updates a sales rep and records an audit log entry.
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.updateSalesRep(req.params.id, req.body);
  if (!doc) throw new ApiError(404, 'Sales rep not found');

  // Write audit log for sales rep update.
  await logAction({
    userId: req.user.userId,
    action: 'master.salesReps.update',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json(doc);
});

// DELETE /users/sales-reps/:id - Deletes a sales rep and records an audit log entry.
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.removeSalesRep(req.params.id);
  if (!doc) throw new ApiError(404, 'Sales rep not found');

  // Write audit log for sales rep deletion.
  await logAction({
    userId: req.user.userId,
    action: 'master.salesReps.delete',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json({ success: true });
});