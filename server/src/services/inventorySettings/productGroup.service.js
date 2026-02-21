// const ProductGroup = require('../../models/inventorySettings/productGroup.model');
// const Brand = require('../../models/inventorySettings/brand.model');


// //-------------------- [ Helper: Common List Query Generator ] ----------------------
// function withCommonListQuery(Model) {
//   return async (filter = {}, { page = 1, limit = 50, q } = {}) => {
//     const where = { ...filter };

//     //-------------------- [ Apply text search if query exists ] ----------------------
//     if (q) {
//       where.$or = [
//         { groupCode:   { $regex: q, $options: "i" } },
//         { name:        { $regex: q, $options: "i" } },
//         { description: { $regex: q, $options: "i" } },
//       ];
//     }

//     //-------------------- [ Execute query with pagination ] ----------------------
//     return Model.find(where)
//       .populate("brands", "brandCode name")
//       .skip((page - 1) * limit)
//       .limit(Number(limit))
//       .lean();
//   };
// }


// //-------------------- [ Instance: ProductGroup List Query ] ----------------------
// const list = withCommonListQuery(ProductGroup);


// //-------------------- [ Create Product Group & Sync Brand Links ] ----------------------
// async function create(p) {
//   const group = await ProductGroup.create(p);

//   //-------------------- [ Update brand associations ] ----------------------
//   if (p.brands?.length) {
//     await Brand.updateMany(
//       { _id: { $in: p.brands } },
//       { $addToSet: { groups: group._id } }
//     );
//   }

//   return group.toObject();
// }


// //-------------------- [ Fetch Product Group by ID ] ----------------------
// async function get(id) {
//   return ProductGroup.findById(id)
//     .populate("brands", "brandCode name")

//     .lean();
// }


// //-------------------- [ Update Product Group ] ----------------------
// async function update(id, payload) {
//   const group = await ProductGroup.findByIdAndUpdate(id, payload, { new: true })
//     .populate("brands", "brandCode name")
//     .lean();

//   //-------------------- [ Sync brand ↔ group relationship ] ----------------------
//   if (payload.brands) {
//     await Brand.updateMany({}, { $pull: { groups: id } });
//     await Brand.updateMany(
//       { _id: { $in: payload.brands } },
//       { $addToSet: { groups: id } }
//     );
//   }

//   return group;
// }


// //-------------------- [ Remove Product Group ] ----------------------
// async function remove(id) {
//   const group = await ProductGroup.findByIdAndDelete(id).lean();

//   if (group) {
//     await Brand.updateMany({}, { $pull: { groups: group._id } });
//   }

//   return group;
// }

// //-------------------- [ Find or Create Product Group ] ----------------------
// async function findOrCreate({ groupCode, name, description, brands = [], status }) {
//   const code = groupCode || (name || "").toUpperCase().replace(/\s+/g, "_");
//   if (!code) {
//     throw Object.assign(new Error("groupCode or name required"), { status: 400 });
//   }

//   let doc = await ProductGroup.findOne({ groupCode: code }).lean();

//   if (!doc) {
//     doc = await ProductGroup.create({
//       groupCode: code,
//       name,
//       description,
//       brands,
//       status,
//     }).then((d) => d.toObject());

//     if (brands?.length) {
//       await Brand.updateMany(
//         { _id: { $in: brands } },
//         { $addToSet: { groups: doc._id } }
//       );
//     }
//   }

//   return doc;
// }


// module.exports = { list, create, get, update, remove, findOrCreate };

// services/inventory/productGroup.service.js
const ProductGroup = require('../../models/inventorySettings/productGroup.model');

//-------------------- [ Helper: Common List Query Generator ] ----------------------
function withCommonListQuery(Model) {
  return async (filter = {}, { page = 1, limit = 50, q } = {}) => {
    const where = { ...filter };

    //-------------------- [ Apply text search if query exists ] ----------------------
    if (q) {
      where.$or = [
        { name: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
      ];
    }

    //-------------------- [ Execute query with pagination ] ----------------------
    return Model.find(where)
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
  };
}

//-------------------- [ Instance: ProductGroup List Query ] ----------------------
const list = withCommonListQuery(ProductGroup);

//-------------------- [ Create single ProductGroup UOM ] ----------------------
async function create(payload) {
  const { name, code, uomType, status } = payload || {};

  if (!name) {
    throw Object.assign(new Error('name is required'), { status: 400 });
  }
  if (!uomType) {
    throw Object.assign(new Error('uomType is required'), { status: 400 });
  }

  const docToCreate = {
    name: name.trim(),
    code: (code || name).toUpperCase().trim(),
    uomType,                          // 'primary' | 'base'
    status: status || 'active',       // default active
  };

  const created = await ProductGroup.create(docToCreate);
  return created.toObject();
}

//-------------------- [ Fetch ProductGroup UOM by ID ] ----------------------
async function get(id) {
  return ProductGroup.findById(id).lean();
}

//-------------------- [ Update single ProductGroup UOM ] ----------------------
async function update(id, payload) {
  const updatePayload = {};

  if (payload.name) {
    updatePayload.name = payload.name.trim();
  }

  if (payload.code) {
    updatePayload.code = payload.code.toUpperCase().trim();
  }

  if (payload.uomType) {
    updatePayload.uomType = payload.uomType; // validate at model level (enum)
  }

  if (payload.status) {
    updatePayload.status = payload.status;
  }

  const group = await ProductGroup.findByIdAndUpdate(id, updatePayload, {
    new: true,
  }).lean();

  return group;
}

//-------------------- [ Remove ProductGroup UOM ] ----------------------
async function remove(id) {
  const group = await ProductGroup.findByIdAndDelete(id).lean();
  return group;
}

//-------------------- [ Find or Create single UOM ] ----------------------
// args: { name, code, uomType, status }
async function findOrCreate({ name, code, uomType, status = 'active' }) {
  if (!name && !code) {
    throw Object.assign(new Error('Either name or code is required'), {
      status: 400,
    });
  }
  if (!uomType) {
    throw Object.assign(new Error('uomType is required'), { status: 400 });
  }

  const finalCode = (code || name).toUpperCase().trim();

  // Try find by code + uomType
  let doc = await ProductGroup.findOne({
    code: finalCode,
    uomType,
  }).lean();

  if (!doc) {
    const created = await ProductGroup.create({
      name: name || finalCode,
      code: finalCode,
      uomType,
      status,
    });
    doc = created.toObject();
  }

  return doc;
}

module.exports = { list, create, get, update, remove, findOrCreate };
