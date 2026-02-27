// controllers/inventorySettings/productGroup.controller.js
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const svc = require('../../services/inventorySettings/productGroup.service');

// POST /inventory/product-groups - Creates a product group and records an audit log entry.
exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.create(req.body);

  // Write audit log for product group creation.
  await logAction({
    userId: req.user.userId,
    action: 'master.groups.create',
    module: 'Masterfile',
    details: { id: doc._id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.status(201).json(doc);
});

// GET /inventory/product-groups - Lists product groups with pagination, search, and optional filters.
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status, brand } = req.query;
  const data = await svc.list(
    { ...(status ? { status } : {}), ...(brand ? { brand } : {}) },
    { page, limit, q }
  );
  res.json(data);
});

// GET /inventory/product-groups/:id - Returns a single product group by id.
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.get(req.params.id);
  if (!doc) throw new ApiError(404, 'Product group not found');
  res.json(doc);
});

// PUT /inventory/product-groups/:id - Updates a product group and records an audit log entry.
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.update(req.params.id, req.body);
  if (!doc) throw new ApiError(404, 'Product group not found');

  // Write audit log for product group update.
  await logAction({
    userId: req.user.userId,
    action: 'master.groups.update',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json(doc);
});

// DELETE /inventory/product-groups/:id - Deletes a product group and records an audit log entry.
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.remove(req.params.id);
  if (!doc) throw new ApiError(404, 'Product group not found');

  // Write audit log for product group deletion.
  await logAction({
    userId: req.user.userId,
    action: 'master.groups.delete',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json({ success: true });
});