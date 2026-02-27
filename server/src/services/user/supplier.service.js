// services/user/supplier.service.js
const Supplier = require("../../models/user/supplier.model");

// Create supplier record.
async function createSupplier(payload) {
  const doc = await Supplier.create(payload);
  return doc.toObject();
}

// List suppliers with pagination, search, and sales rep name.
async function listSuppliers(filter = {}, { page = 1, limit = 50, q } = {}) {
  const where = { ...filter };
  if (q) where.$or = [{ supplierCode: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }];
  return Supplier.find(where).skip((page - 1) * limit).limit(Number(limit)).populate("salesRep", "name").lean();
}

// Fetch supplier by id with sales rep name.
async function getSupplier(id) {
  return Supplier.findById(id).populate("salesRep", "name").lean();
}

// Update supplier by id.
async function updateSupplier(id, payload) {
  return Supplier.findByIdAndUpdate(id, payload, { new: true }).lean();
}

// Delete supplier by id.
async function removeSupplier(id) {
  return Supplier.findByIdAndDelete(id).lean();
}

module.exports = { createSupplier, listSuppliers, getSupplier, updateSupplier, removeSupplier };