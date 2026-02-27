// services/inventory/productGroup.service.js
const ProductGroup = require("../../models/inventorySettings/productGroup.model");

// Build a reusable paginated list query helper with optional text search.
function withCommonListQuery(Model) {
  return async (filter = {}, { page = 1, limit = 50, q } = {}) => {
    const where = { ...filter };

    if (q) {
      where.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
      ];
    }

    return Model.find(where).skip((page - 1) * Number(limit)).limit(Number(limit)).lean();
  };
}

// List product groups using the shared paginated/search helper.
const list = withCommonListQuery(ProductGroup);

// Create a product group (UOM definition) with required fields and normalized code/name.
async function create(payload) {
  const { name, code, uomType, status } = payload || {};
  if (!name) throw Object.assign(new Error("name is required"), { status: 400 });
  if (!uomType) throw Object.assign(new Error("uomType is required"), { status: 400 });

  const docToCreate = { name: name.trim(), code: (code || name).toUpperCase().trim(), uomType, status: status || "active" };
  const created = await ProductGroup.create(docToCreate);

  return created.toObject();
}

// Get a product group by ID.
async function get(id) {
  return ProductGroup.findById(id).lean();
}

// Update a product group with normalized editable fields only.
async function update(id, payload) {
  const updatePayload = {};

  if (payload.name) updatePayload.name = payload.name.trim();
  if (payload.code) updatePayload.code = payload.code.toUpperCase().trim();
  if (payload.uomType) updatePayload.uomType = payload.uomType; // Enum validation is enforced at the model layer.
  if (payload.status) updatePayload.status = payload.status;

  const group = await ProductGroup.findByIdAndUpdate(id, updatePayload, { new: true }).lean();
  return group;
}

// Delete a product group by ID.
async function remove(id) {
  const group = await ProductGroup.findByIdAndDelete(id).lean();
  return group;
}

// Find a product group by normalized code and uomType, or create it if missing.
async function findOrCreate({ name, code, uomType, status = "active" }) {
  if (!name && !code) throw Object.assign(new Error("Either name or code is required"), { status: 400 });
  if (!uomType) throw Object.assign(new Error("uomType is required"), { status: 400 });

  const finalCode = (code || name).toUpperCase().trim();
  let doc = await ProductGroup.findOne({ code: finalCode, uomType }).lean();

  if (!doc) {
    const created = await ProductGroup.create({ name: name || finalCode, code: finalCode, uomType, status });
    doc = created.toObject();
  }

  return doc;
}

module.exports = { list, create, get, update, remove, findOrCreate };