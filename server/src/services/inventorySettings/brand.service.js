const Brand = require("../../models/inventorySettings/brand.model");
const ProductGroup = require("../../models/inventorySettings/productGroup.model");

// Build a reusable paginated list query with optional text search for common master-data models.
function withCommonListQuery(Model, fields = {}) {
  return async (filter = {}, { page = 1, limit = 50, q } = {}) => {
    const where = { ...filter };

    if (q) {
      where.$or = [
        { brandCode: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    return Model.find(where, fields).skip((page - 1) * limit).limit(Number(limit)).lean();
  };
}

// List brands using the shared paginated/search query helper.
const list = withCommonListQuery(Brand);

// Create and return a new brand document.
async function create(payload) {
  const brand = await Brand.create(payload);
  return brand.toObject();
}

// Get a brand by ID with linked product groups populated.
async function get(id) {
  return Brand.findById(id).populate("groups", "groupCode name").lean();
}

// Update a brand by ID and return the populated result.
async function update(id, payload) {
  return Brand.findByIdAndUpdate(id, payload, { new: true }).populate("groups", "groupCode name").lean();
}

// Delete a brand and unlink the deleted brand from related product groups.
async function remove(id) {
  const brand = await Brand.findByIdAndDelete(id).lean();

  if (brand?.groups?.length) {
    await ProductGroup.updateMany({ _id: { $in: brand.groups } }, { $unset: { brand: "" } });
  }

  return brand;
}

// Find an existing brand by code or name, or create one if it does not exist.
async function findOrCreateByNameOrCode({ brandCode, name, description, status }) {
  if (!brandCode && !name) throw Object.assign(new Error("brandCode or name required"), { status: 400 });

  const query = brandCode ? { brandCode } : { name };
  let doc = await Brand.findOne(query).lean();

  if (!doc) {
    const code = brandCode || name.toUpperCase().replace(/\s+/g, "_");
    doc = await Brand.create({ brandCode: code, name: name || code, description, status }).then((d) => d.toObject());
  }

  return doc;
}

// Attach a product group to a brand without creating duplicate links.
async function attachGroupToBrand(brandId, groupId) {
  if (!brandId || !groupId) return;
  await Brand.findByIdAndUpdate(brandId, { $addToSet: { groups: groupId } });
}

module.exports = { list, create, get, update, remove, findOrCreateByNameOrCode, attachGroupToBrand };