const Supplier = require('../../models/user/supplier.model');

//-------------------- [ Create a New Supplier ] ----------------------
async function createSupplier(payload) {
  const doc = await Supplier.create(payload);
  return doc.toObject();
}


//-------------------- [ List Suppliers with Pagination & Search ] ----------------------
async function listSuppliers(filter = {}, { page = 1, limit = 50, q } = {}) {
  const where = { ...filter };

  // Apply search query if provided
  if (q) {
    where.$or = [
      { supplierCode: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
    ];
  }

  return Supplier.find(where)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate('salesRep', 'name')  // Populate the salesRep field with only the name
    .lean();
}



//-------------------- [ Get Supplier by ID ] ----------------------
async function getSupplier(id) {
  return Supplier.findById(id)
    .populate('salesRep', 'name')  // Populate salesRep and include only the name
    .lean();
}


//-------------------- [ Update Supplier by ID ] ----------------------
async function updateSupplier(id, payload) {
  return Supplier.findByIdAndUpdate(id, payload, { new: true }).lean();
}


//-------------------- [ Delete Supplier by ID ] ----------------------
async function removeSupplier(id) {
  return Supplier.findByIdAndDelete(id).lean();
}

module.exports = { createSupplier, listSuppliers, getSupplier, updateSupplier, removeSupplier };
