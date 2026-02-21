const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../middlewares/error');
const { logAction } = require('../../services/audit/audit.service');
const svc = require('../../services/user/supplier.service');

exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.createSupplier(req.body);
  await logAction({ userId: req.user.userId, action: 'master.suppliers.create', module: 'Masterfile', details: { id: doc._id }, ip: req.ip, ua: req.headers['user-agent'] });
  res.status(201).json(doc);
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status } = req.query;
  const data = await svc.listSuppliers({ ...(status ? { status } : {}) }, { page, limit, q });
  res.json(data);
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await svc.getSupplier(req.params.id);
  if (!doc) throw new ApiError(404, 'Supplier not found');
  res.json(doc);
});

exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.updateSupplier(req.params.id, req.body);
  if (!doc) throw new ApiError(404, 'Supplier not found');
  await logAction({ userId: req.user.userId, action: 'master.suppliers.update', module: 'Masterfile', details: { id: req.params.id }, ip: req.ip, ua: req.headers['user-agent'] });
  res.json(doc);
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.removeSupplier(req.params.id);
  if (!doc) throw new ApiError(404, 'Supplier not found');
  await logAction({ userId: req.user.userId, action: 'master.suppliers.delete', module: 'Masterfile', details: { id: req.params.id }, ip: req.ip, ua: req.headers['user-agent'] });
  res.json({ success: true });
});
