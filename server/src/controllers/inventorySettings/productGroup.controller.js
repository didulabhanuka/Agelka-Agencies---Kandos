const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const svc = require('../../services/inventorySettings/productGroup.service');

exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.create(req.body);
  await logAction({ userId: req.user.userId, action: 'master.groups.create', module: 'Masterfile', details: { id: doc._id }, ip: req.ip, ua: req.headers['user-agent'] });
  res.status(201).json(doc);
});
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status, brand } = req.query;
  const data = await svc.list({ ...(status ? { status } : {}), ...(brand ? { brand } : {}) }, { page, limit, q });
  res.json(data);
});
exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.get(req.params.id);
  if (!doc) throw new ApiError(404, 'Product group not found');
  res.json(doc);
});
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.update(req.params.id, req.body);
  if (!doc) throw new ApiError(404, 'Product group not found');
  await logAction({ userId: req.user.userId, action: 'master.groups.update', module: 'Masterfile', details: { id: req.params.id }, ip: req.ip, ua: req.headers['user-agent'] });
  res.json(doc);
});
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.remove(req.params.id);
  if (!doc) throw new ApiError(404, 'Product group not found');
  await logAction({ userId: req.user.userId, action: 'master.groups.delete', module: 'Masterfile', details: { id: req.params.id }, ip: req.ip, ua: req.headers['user-agent'] });
  res.json({ success: true });
});
