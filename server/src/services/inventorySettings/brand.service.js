const Brand = require('../../models/inventorySettings/brand.model');
const ProductGroup = require('../../models/inventorySettings/productGroup.model');


//-------------------- [ Generic List Query with Pagination & Search ] ----------------------
function withCommonListQuery(Model, fields = {}) {
  return async (filter = {}, { page = 1, limit = 50, q } = {}) => {
    const where = { ...filter };

    //-------------------- [ Search by Query String (brandCode, name, description) ] ----------------------
    if (q) {
      where.$or = [
        { brandCode: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    return Model.find(where, fields)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
  };
}

//-------------------- [ Brand List Query Using Common Function ] ----------------------
const list = withCommonListQuery(Brand);


//-------------------- [ Create a New Brand ] ----------------------
async function create(payload) {
  const brand = await Brand.create(payload);
  return brand.toObject();
}


//-------------------- [ Get Brand by ID with Groups ] ----------------------
async function get(id) {
  return Brand.findById(id)
    .populate("groups", "groupCode name")
    .lean();
}


//-------------------- [ Update Brand by ID with Groups ] ----------------------
async function update(id, payload) {
  return Brand.findByIdAndUpdate(id, payload, { new: true })
    .populate("groups", "groupCode name")
    .lean();
}


//-------------------- [ Delete Brand and Unlink Groups ] ----------------------
async function remove(id) {
  const brand = await Brand.findByIdAndDelete(id).lean();

  if (brand?.groups?.length) {
    await ProductGroup.updateMany(
      { _id: { $in: brand.groups } },
      { $unset: { brand: "" } }
    );
  }

  return brand;
}


//-------------------- [ Find or Create Brand by Code or Name ] ----------------------
async function findOrCreateByNameOrCode({ brandCode, name, description, status }) {
  if (!brandCode && !name) {
    throw Object.assign(new Error("brandCode or name required"), { status: 400 });
  }

  const query = brandCode ? { brandCode } : { name };
  let doc = await Brand.findOne(query).lean();

  if (!doc) {
    const code = brandCode || name.toUpperCase().replace(/\s+/g, "_");
    doc = await Brand.create({
      brandCode: code,
      name: name || code,
      description,
      status,
    }).then(d => d.toObject());
  }

  return doc;
}


//-------------------- [ Attach Product Group to Brand ] ----------------------
async function attachGroupToBrand(brandId, groupId) {
  if (!brandId || !groupId) return;

  await Brand.findByIdAndUpdate(
    brandId,
    { $addToSet: { groups: groupId } }
  );
}

module.exports = {
  list,
  create,
  get,
  update,
  remove,
  findOrCreateByNameOrCode,
  attachGroupToBrand,
};
