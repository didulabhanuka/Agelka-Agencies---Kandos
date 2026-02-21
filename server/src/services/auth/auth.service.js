// services/auth/auth.service.js
const User = require("../../models/user/user.model");
const SalesRep = require("../../models/user/salesRep.model");
const { comparePassword } = require("../../utils/passwordUtils");

/**
 * Try to login as Admin/DataEntry (User model) first.
 * User.passwordHash is select:false in your model :contentReference[oaicite:2]{index=2}
 */
async function loginUser({ username, password }) {
  if (!username || !password) return null;

  const user = await User.findOne({ username })
    .select("+passwordHash") // ✅ required because select:false
    .lean();

  if (!user || !user.active) return null;

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return null;

  // update lastLogin async
  User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).catch(() => {});
  return user;
}

/**
 * Login as SalesRep (SalesRep model)
 * SalesRep.passwordHash is select:false in your model :contentReference[oaicite:3]{index=3}
 */
async function loginSalesRep({ repCode, password }) {
  if (!repCode || !password) return null;

  const rep = await SalesRep.findOne({ repCode })
    .select("+passwordHash")
    .lean();

  if (!rep) return null;
  if (rep.status !== "active") return null;
  if (!rep.canLogin || !rep.passwordHash) return null;

  const ok = await comparePassword(password, rep.passwordHash);
  if (!ok) return null;

  SalesRep.findByIdAndUpdate(rep._id, { lastLogin: new Date() }).catch(() => {});
  return rep;
}

module.exports = { loginUser, loginSalesRep };
