const { asyncHandler } = require('../../utils/asyncHandler');
const { logAction } = require('../../services/audit/audit.service');
const {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
} = require('../../services/user/user.service');
const { ApiError } = require('../../middlewares/error');

// Create user (Admin)
exports.userCreate = asyncHandler(async (req, res) => {
  const { username, password, email, role, number, branch } = req.body;
  const user = await createUser({ username, password, email, role, number, branch });

  await logAction({
    userId: req.user.userId,
    action: 'users.create',
    module: 'User Management',
    details: { createdUserId: user._id, username, role },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.status(201).json({
    id: user._id,
    username: user.username,
    email: user.email ?? null,
    role: user.role,
    number: user.number ?? null,
    branch: user.branch ?? null,
  });
});

// List users
exports.list = asyncHandler(async (req, res) => {
  const { role, active } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (active !== undefined) filter.active = active === 'true';

  const users = await listUsers(filter);
  res.json(users);
});

// Get user by ID
exports.get = asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json(user);
});

// Update user
exports.update = asyncHandler(async (req, res) => {
  const updated = await updateUser(req.params.id, req.body);
  await logAction({
    userId: req.user.userId,
    action: 'users.update',
    module: 'User Management',
    details: { userId: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });
  res.json(updated);
});

// Delete user
exports.remove = asyncHandler(async (req, res) => {
  const removed = await deleteUser(req.params.id);
  if (!removed) throw new ApiError(404, 'User not found');

  await logAction({
    userId: req.user.userId,
    action: 'users.delete',
    module: 'User Management',
    details: { userId: req.params.id },
    ip: req.ip,
    ua: req.headers['user-agent'],
  });

  res.json({ message: 'User deleted' });
});
