// services/auth/auth.service.js
const User = require("../../models/user/user.model");
const SalesRep = require("../../models/user/salesRep.model");
const { comparePassword } = require("../../utils/passwordUtils");

// Authenticate admin/data-entry user and return user record on success, otherwise null.
async function loginUser({ username, password }) {
  if (!username || !password) return null;
  const user = await User.findOne({ username }).select("+passwordHash").lean(); // passwordHash is excluded by default.
  if (!user || !user.active) return null;
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return null;
  User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).catch(() => {}); // Fire-and-forget last login update.
  return user;
}

// Authenticate sales rep and return rep record on success, otherwise null.
async function loginSalesRep({ repCode, password }) {
  if (!repCode || !password) return null;
  const rep = await SalesRep.findOne({ repCode }).select("+passwordHash").lean(); 
  if (!rep || rep.status !== "active" || !rep.canLogin || !rep.passwordHash) return null;
  const ok = await comparePassword(password, rep.passwordHash);
  if (!ok) return null;
  SalesRep.findByIdAndUpdate(rep._id, { lastLogin: new Date() }).catch(() => {}); 
  return rep;
}

module.exports = { loginUser, loginSalesRep };