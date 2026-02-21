// services/user/salesRep.service.js
const SalesRep = require("../../models/user/salesRep.model");
const { hashPassword } = require("../../utils/passwordUtils");

async function createSalesRep(payload) {
  const data = { ...payload };

  // Set default role if not provided
  if (!data.role) {
    data.role = "SalesRep";
  }

  if (data.password) {
    data.passwordHash = await hashPassword(data.password);
    data.canLogin = true;
    delete data.password;
  }

  const doc = await SalesRep.create(data);
  const obj = doc.toObject();
  delete obj.passwordHash;
  return obj;
}

async function listSalesReps(filter = {}, { page = 1, limit = 50, q } = {}) {
  const where = { ...filter };
  if (q) {
    where.$or = [
      { repCode: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
    ];
  }

  return SalesRep.find(where)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();
}

async function getSalesRep(id) {
  return SalesRep.findById(id).lean();
}

async function updateSalesRep(id, payload) {
  const update = { ...payload };

  if (update.password) {
    update.passwordHash = await hashPassword(update.password);
    update.canLogin = true;
    delete update.password;
  }

  // prevent setting passwordHash directly
  if ("passwordHash" in update) delete update.passwordHash;

  return SalesRep.findByIdAndUpdate(id, update, { new: true }).lean();
}

async function removeSalesRep(id) {
  return SalesRep.findByIdAndDelete(id).lean();
}

module.exports = { createSalesRep, listSalesReps, getSalesRep, updateSalesRep, removeSalesRep };
