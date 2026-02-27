// src/controllers/user/supplier.controller.js
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const svc = require('../../services/user/supplier.service');

// POST /users/suppliers - Creates a supplier and records an audit log entry.
exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.createSupplier(req.body);

  // Write audit log for supplier creation.
  await logAction({
    userId: req.user.userId,
    action: 'master.suppliers.create',
    module: 'Masterfile',
    details: { id: doc._id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.status(201).json(doc);
});

// GET /users/suppliers - Lists suppliers with pagination, search, and optional status filter.
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status } = req.query;
  const data = await svc.listSuppliers({ ...(status ? { status } : {}) }, { page, limit, q });
  res.json(data);
});

// GET /users/suppliers/:id - Returns a single supplier by id.
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getSupplier(req.params.id);
  if (!doc) throw new ApiError(404, 'Supplier not found');
  res.json(doc);
});

// PUT /users/suppliers/:id - Updates a supplier and records an audit log entry.
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.updateSupplier(req.params.id, req.body);
  if (!doc) throw new ApiError(404, 'Supplier not found');

  // Write audit log for supplier update.
  await logAction({
    userId: req.user.userId,
    action: 'master.suppliers.update',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json(doc);
});

// DELETE /users/suppliers/:id - Deletes a supplier and records an audit log entry.
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.removeSupplier(req.params.id);
  if (!doc) throw new ApiError(404, 'Supplier not found');

  // Write audit log for supplier deletion.
  await logAction({
    userId: req.user.userId,
    action: 'master.suppliers.delete',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json({ success: true });
});