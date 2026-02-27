// controllers/inventorySettings/brand.controller.js
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const svc = require('../../services/inventorySettings/brand.service');

// POST /inventory/brands - Creates a brand and records an audit log entry.
exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.create(req.body);

  // Write audit log for brand creation.
  await logAction({
    userId: req.user.userId,
    action: 'master.brands.create',
    module: 'Masterfile',
    details: { id: doc._id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.status(201).json(doc);
});

// GET /inventory/brands - Lists brands with pagination, search, and optional status filter.
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status } = req.query;
  const data = await svc.list({ ...(status ? { status } : {}) }, { page, limit, q });
  res.json(data);
});

// GET /inventory/brands/:id - Returns a single brand by id.
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.get(req.params.id);
  if (!doc) throw new ApiError(404, 'Brand not found');
  res.json(doc);
});

// PUT /inventory/brands/:id - Updates a brand and records an audit log entry.
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.update(req.params.id, req.body);
  if (!doc) throw new ApiError(404, 'Brand not found');

  // Write audit log for brand update.
  await logAction({
    userId: req.user.userId,
    action: 'master.brands.update',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json(doc);
});

// DELETE /inventory/brands/:id - Deletes a brand and records an audit log entry.
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.remove(req.params.id);
  if (!doc) throw new ApiError(404, 'Brand not found');

  // Write audit log for brand deletion.
  await logAction({
    userId: req.user.userId,
    action: 'master.brands.delete',
    module: 'Masterfile',
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json({ success: true });
});