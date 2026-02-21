// services/user/user.service.js
const User = require("../../models/user/user.model");
const { hashPassword } = require("../../utils/passwordUtils");

const ALLOWED_ROLES = ["Admin", "DataEntry"];

async function createUser({ username, password, email, role, number, branch }) {
  if (!ALLOWED_ROLES.includes(role)) throw new Error("Invalid role");

  const passwordHash = await hashPassword(password);
  const user = await User.create({ username, passwordHash, email, role, number, branch });
  return user.toObject();
}

async function listUsers(filter = {}) {
  return User.find(filter).populate("branch").lean();
}

async function getUser(id) {
  return User.findById(id).populate("branch").lean();
}

async function updateUser(id, data) {
  const update = { ...data };

  if (update.password) {
    update.passwordHash = await hashPassword(update.password);
    delete update.password;
  }

  if (update.role && !ALLOWED_ROLES.includes(update.role)) {
    throw new Error("Invalid role");
  }

  return User.findByIdAndUpdate(id, update, { new: true })
    .populate("branch")
    .lean();
}

async function deleteUser(id) {
  return User.findByIdAndDelete(id).lean();
}

module.exports = { createUser, listUsers, getUser, updateUser, deleteUser };
