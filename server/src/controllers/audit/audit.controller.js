const { asyncHandler } = require('../../utils/asyncHandler');
const AuditLog = require('../../models/audit/auditLog.model');
const { ApiError } = require('../../middlewares/error');

/**
 * @desc Get audit logs (admin only)
 * @route GET /api/audit
 * @access Admin
 */
exports.getLogs = asyncHandler(async (req, res) => {
  const { userId, action, module, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (userId) filter.userId = userId;
  if (action) filter.action = action;
  if (module) filter.module = module;

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'username email role')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    data: logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc Get single audit log by ID
 * @route GET /api/audit/:id
 * @access Admin
 */
exports.getLogById = asyncHandler(async (req, res) => {
  const log = await AuditLog.findById(req.params.id)
    .populate('userId', 'username email role')
    .lean();

  if (!log) throw new ApiError(404, 'Audit log not found');
  res.json(log);
});
