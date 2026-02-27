// services/user/salesRep.service.js
const SalesRep = require("../../models/user/salesRep.model");
const { hashPassword } = require("../../utils/passwordUtils");

async function createSalesRep(payload) {
  const data = { ...payload };

  // Default role to SalesRep when not provided.
  if (!data.role) data.role = "SalesRep";

  // Hash plaintext password and enable login when password is supplied.
  if (data.password) {
    data.passwordHash = await hashPassword(data.password);
    data.canLogin = true;
    delete data.password;
  }

  const doc = await SalesRep.create(data);
  const obj = doc.toObject();
  delete obj.passwordHash; // Remove password hash from response payload.
  return obj;
}

async function listSalesReps(filter = {}, { page = 1, limit = 50, q } = {}) {
  const where = { ...filter };

  // Apply case-insensitive search on rep code or rep name.
  if (q) where.$or = [{ repCode: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }];

  return SalesRep.find(where).skip((page - 1) * limit).limit(Number(limit)).lean();
}

// Fetch single sales rep by id.
async function getSalesRep(id) {
  return SalesRep.findById(id).lean();
}

async function updateSalesRep(id, payload) {
  const update = { ...payload };

  // Hash new plaintext password and enable login when updating password.
  if (update.password) {
    update.passwordHash = await hashPassword(update.password);
    update.canLogin = true;
    delete update.password;
  }

  // Prevent direct password hash updates from request payload.
  if ("passwordHash" in update) delete update.passwordHash;

  return SalesRep.findByIdAndUpdate(id, update, { new: true }).lean();
}

// Delete sales rep by id.
async function removeSalesRep(id) {
  return SalesRep.findByIdAndDelete(id).lean();
}

module.exports = { createSalesRep, listSalesReps, getSalesRep, updateSalesRep, removeSalesRep };