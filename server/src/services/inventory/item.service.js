// //services/inventory/item.service.js
// const Item = require("../../models/inventory/item.model");
// const Supplier = require("../../models/user/supplier.model");
// const SalesRepStock = require("../../models/inventory/salesRepStock.model");

// const mongoose = require("mongoose");

// function toObjectId(id) {
//   if (id instanceof mongoose.Types.ObjectId) return id;
//   try { return new mongoose.Types.ObjectId(id); } catch { return null; }
// }

// function computeStockStatusFromQty(item, qtyOnHand) {
//   const rl = Number(item.reorderLevel || 0);
//   if (qtyOnHand <= 0) return "out_of_stock";
//   if (rl > 0 && qtyOnHand <= rl) return "low_stock";
//   return "in_stock";
// }

// async function buildStockMapForItems(itemIds, { forSalesRepId = null } = {}) {
//   const ids = itemIds.map((x) => toObjectId(x)).filter(Boolean);
//   if (ids.length === 0) return new Map();

//   // ✅ SalesRep-specific stock
//   if (forSalesRepId) {
//     const repId = toObjectId(forSalesRepId);
//     if (!repId) return new Map();

//     const rows = await SalesRepStock.find({ salesRep: repId, item: { $in: ids } }).lean();
//     const map = new Map();
//     rows.forEach((r) => map.set(String(r.item), Number(r.qtyOnHand || 0)));
//     return map;
//   }

//   // ✅ Total stock across all reps (Admin/DataEntry default)
//   const agg = await SalesRepStock.aggregate([
//     { $match: { item: { $in: ids } } },
//     { $group: { _id: "$item", qty: { $sum: "$qtyOnHand" } } },
//   ]);

//   const map = new Map();
//   agg.forEach((r) => map.set(String(r._id), Number(r.qty || 0)));
//   return map;
// }

// // ---------------------------------------------------------------------
// // CREATE ITEM
// // ---------------------------------------------------------------------
// async function createItem(payload) {
//   if (!payload) throw new Error("Item payload is required");

//   const item = await Item.create(payload);

//   // attach to supplier
//   if (item.supplier) {
//     await Supplier.findByIdAndUpdate(item.supplier, { $addToSet: { items: item._id } });
//   }

//   return item.toObject();
// }

// // ---------------------------------------------------------------------
// // LIST ITEMS (with SalesRep stock)
// // ---------------------------------------------------------------------
// async function listItems(filter = {}, options = {}, actor = null) {
//   const { page = 1, limit = 50, q, status, salesRep } = options;

//   const where = { ...filter };
//   if (status) where.status = status;

//   if (q) {
//     const regex = new RegExp(q, "i");
//     where.$or = [{ itemCode: regex }, { name: regex }, { description: regex }];
//   }

//   const items = await Item.find(where)
//     .populate("brand", "_id brandCode name")
//     .populate("productGroup", "_id groupCode name units")
//     .populate("supplier", "_id supplierCode name")
//     .skip((page - 1) * limit)
//     .limit(Number(limit))
//     .lean();

//   // ✅ decide stock mode
//   let forSalesRepId = null;

//   // SalesRep sees their own qty
//   if (actor?.actorType === "SalesRep") {
//     forSalesRepId = actor.actorId;
//   }
//   // Admin/DataEntry can request specific rep stock
//   else if (actor?.actorType === "User" && salesRep) {
//     forSalesRepId = salesRep;
//   }
//   // else Admin/DataEntry sees total across all reps

//   const stockMap = await buildStockMapForItems(items.map((i) => i._id), { forSalesRepId });

//   items.forEach((item) => {
//     const qty = stockMap.get(String(item._id)) || 0;
//     item.qtyOnHand = qty;
//     item.stockStatus = computeStockStatusFromQty(item, qty);
//   });

//   return items;
// }

// // ---------------------------------------------------------------------
// // GET SINGLE ITEM (with SalesRep stock)
// // ---------------------------------------------------------------------
// async function getItem(id, actor = null, options = {}) {
//   const itemId = toObjectId(id);
//   if (!itemId) throw new Error("Valid item ID is required");

//   const item = await Item.findById(itemId)
//     .populate("brand", "_id brandCode name")
//     .populate("productGroup", "_id groupCode name units")
//     .populate("supplier", "_id supplierCode name")
//     .lean();

//   if (!item) return null;

//   let forSalesRepId = null;
//   if (actor?.actorType === "SalesRep") forSalesRepId = actor.actorId;
//   else if (actor?.actorType === "User" && options.salesRep) forSalesRepId = options.salesRep;

//   const stockMap = await buildStockMapForItems([item._id], { forSalesRepId });
//   const qty = stockMap.get(String(item._id)) || 0;

//   item.qtyOnHand = qty;
//   item.stockStatus = computeStockStatusFromQty(item, qty);

//   return item;
// }

// // ---------------------------------------------------------------------
// // UPDATE ITEM
// // ---------------------------------------------------------------------
// async function updateItem(id, payload) {
//   const itemId = toObjectId(id);
//   if (!itemId) throw new Error("Valid item ID is required");

//   const oldItem = await Item.findById(itemId).lean();
//   if (!oldItem) throw new Error("Item not found");

//   const updated = await Item.findByIdAndUpdate(itemId, payload, { new: true }).lean();

//   // supplier change sync
//   if (oldItem.supplier && oldItem.supplier.toString() !== payload.supplier?.toString()) {
//     await Supplier.findByIdAndUpdate(oldItem.supplier, { $pull: { items: updated._id } });
//   }
//   if (payload.supplier) {
//     await Supplier.findByIdAndUpdate(payload.supplier, { $addToSet: { items: updated._id } });
//   }

//   return updated;
// }

// // ---------------------------------------------------------------------
// // REMOVE ITEM
// // ---------------------------------------------------------------------
// async function removeItem(id) {
//   const itemId = toObjectId(id);
//   if (!itemId) throw new Error("Valid item ID is required");

//   const item = await Item.findByIdAndDelete(itemId).lean();
//   if (!item) return null;

//   if (item.supplier) {
//     await Supplier.findByIdAndUpdate(item.supplier, { $pull: { items: item._id } });
//   }

//   // optional cleanup: remove all SalesRepStock rows for this item
//   await SalesRepStock.deleteMany({ item: item._id });

//   return item;
// }

// // ---------------------------------------------------------------------
// // LIST ITEMS BY SUPPLIER (with SalesRep stock)
// // ---------------------------------------------------------------------
// async function getItemsBySupplier(supplierId, actor = null, options = {}) {
//   const items = await Item.find({ supplier: supplierId })
//     .populate("brand", "_id brandCode name")
//     .populate("productGroup", "_id groupCode name units")
//     .populate("supplier", "_id supplierCode name")
//     .lean();

//   let forSalesRepId = null;
//   if (actor?.actorType === "SalesRep") forSalesRepId = actor.actorId;
//   else if (actor?.actorType === "User" && options.salesRep) forSalesRepId = options.salesRep;

//   const stockMap = await buildStockMapForItems(items.map((i) => i._id), { forSalesRepId });

//   return items.map((item) => {
//     const qty = stockMap.get(String(item._id)) || 0;
//     return {
//       ...item,
//       qtyOnHand: qty,
//       stockStatus: computeStockStatusFromQty(item, qty),
//     };
//   });
// }

// module.exports = {
//   createItem,
//   listItems,
//   getItem,
//   updateItem,
//   removeItem,
//   getItemsBySupplier,
// };







const Item = require("../../models/inventory/item.model");
const Supplier = require("../../models/user/supplier.model");
const SalesRepStock = require("../../models/inventory/salesRepStock.model");
const mongoose = require("mongoose");

// Helper function to convert ID to ObjectId type
function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

/**
 * Helper: calculate factorToBase based on UOM hierarchy
 *
 * ✅ New semantics:
 * - primaryUom is the ROOT (parentCode: null, factorToParent: 1)
 * - baseUom is somewhere BELOW primaryUom in the tree
 * - For any child UOM:
 *      factorToParent = how many of THIS uom per 1 PARENT uom
 */
async function calculateFactorToBase(primaryUomCode, baseUomCode, uoms = []) {
  if (!primaryUomCode || !baseUomCode) {
    throw new Error("Both primaryUom and baseUom are required to calculate factorToBase");
  }

  const uomMap = {};
  uoms.forEach((u) => {
    if (!u.uomCode) return;
    uomMap[u.uomCode] = u;
  });

  const primary = uomMap[primaryUomCode];
  const base = uomMap[baseUomCode];

  if (!primary) {
    throw new Error(`Primary UOM not found in uoms: ${primaryUomCode}`);
  }
  if (!base) {
    throw new Error(`Base UOM not found in uoms: ${baseUomCode}`);
  }

  let factorToBase = 1;
  let currentUOM = base;

  while (currentUOM && currentUOM.uomCode !== primaryUomCode) {
    if (!currentUOM.parentCode) {
      throw new Error(
        `Base UOM ${baseUomCode} is not under primary UOM ${primaryUomCode} in the hierarchy`
      );
    }

    const parentUOM = uomMap[currentUOM.parentCode];
    if (!parentUOM) {
      throw new Error(`Parent UOM not found: ${currentUOM.parentCode}`);
    }

    factorToBase *= Number(currentUOM.factorToParent || 0);
    if (!Number.isFinite(factorToBase) || factorToBase <= 0) {
      throw new Error(`Invalid factorToParent for UOM: ${currentUOM.uomCode}`);
    }

    currentUOM = parentUOM;
  }

  if (currentUOM?.uomCode !== primaryUomCode) {
    throw new Error(
      `Base UOM ${baseUomCode} is not reachable from primary UOM ${primaryUomCode}`
    );
  }

  return factorToBase;
}

// ✅ reorderLevel is in PRIMARY units
function computeStockStatusFromQty(item, qtyOnHandPrimary) {
  const rlPrimary = Number(item.reorderLevel || 0);

  if (qtyOnHandPrimary <= 0) return "out_of_stock";
  if (rlPrimary > 0 && qtyOnHandPrimary <= rlPrimary) return "low_stock";
  return "in_stock";
}

// Build stock map for items (aggregated across all reps or a specific rep)
// Returns map(itemId -> { qtyOnHandPrimary, qtyOnHandBase, qtyOnHandLegacy })
async function buildStockMapForItems(itemIds, { forSalesRepId = null } = {}) {
  const ids = itemIds.map((x) => toObjectId(x)).filter(Boolean);
  if (ids.length === 0) return new Map();

  const match = { item: { $in: ids } };

  if (forSalesRepId) {
    const repId = toObjectId(forSalesRepId);
    if (!repId) return new Map();
    match.salesRep = repId;
  }

  const stockData = await SalesRepStock.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$item",
        qtyOnHandPrimary: { $sum: { $ifNull: ["$qtyOnHandPrimary", 0] } },
        qtyOnHandBase: { $sum: { $ifNull: ["$qtyOnHandBase", 0] } },

        // Legacy fallback (old schema data, if any)
        qtyOnHandLegacy: { $sum: { $ifNull: ["$qtyOnHand", 0] } },
      },
    },
  ]);

  const stockMap = new Map();
  stockData.forEach((r) => {
    stockMap.set(String(r._id), {
      qtyOnHandPrimary: Number(r.qtyOnHandPrimary || 0),
      qtyOnHandBase: Number(r.qtyOnHandBase || 0),
      qtyOnHandLegacy: Number(r.qtyOnHandLegacy || 0),
    });
  });

  return stockMap;
}

// Normalizer only (NO deriving between primary/base)
// Keeps DB values as-is and only handles legacy fallback
function resolveItemStock(item, stock) {
  const safeStock = stock || {
    qtyOnHandPrimary: 0,
    qtyOnHandBase: 0,
    qtyOnHandLegacy: 0,
  };

  let qtyPrimary = Number(safeStock.qtyOnHandPrimary || 0);
  let qtyBase = Number(safeStock.qtyOnHandBase || 0);
  const qtyLegacy = Number(safeStock.qtyOnHandLegacy || 0);

  const hasBaseUom = !!item.baseUom;

  // Legacy fallback only
  // Assume old qtyOnHand represented PRIMARY qty.
  if (qtyPrimary <= 0 && qtyBase <= 0 && qtyLegacy > 0) {
    qtyPrimary = qtyLegacy;
    qtyBase = 0;
  }

  // No base UOM => base qty should always be 0
  if (!hasBaseUom) {
    qtyBase = 0;
  }

  return {
    qtyOnHandPrimary: qtyPrimary,
    qtyOnHandBase: qtyBase,
    qtyOnHandLegacy: qtyLegacy,
  };
}

// CREATE ITEM (with automated UOM price calculations)
async function createItem(payload) {
  if (!payload) throw new Error("Item payload is required");

  const { primaryUom, baseUom, uoms = [] } = payload;

  // Calculate factorToBase only when baseUom exists
  if (
    baseUom &&
    (payload.factorToBase === undefined || payload.factorToBase === null)
  ) {
    payload.factorToBase = await calculateFactorToBase(primaryUom, baseUom, uoms);
  }

  // For single-UOM items (no base), keep factorToBase = 1 for consistency
  if (!baseUom && (payload.factorToBase === undefined || payload.factorToBase === null)) {
    payload.factorToBase = 1;
  }

  // Automatically calculate base UOM prices only if base UOM exists
  if (
    baseUom &&
    (payload.avgCostBase === undefined || payload.avgCostBase === null) &&
    payload.avgCostPrimary !== undefined &&
    payload.avgCostPrimary !== null &&
    Number(payload.factorToBase) > 0
  ) {
    payload.avgCostBase = Number(payload.avgCostPrimary) / Number(payload.factorToBase);
  }

  if (
    baseUom &&
    (payload.sellingPriceBase === undefined || payload.sellingPriceBase === null) &&
    payload.sellingPricePrimary !== undefined &&
    payload.sellingPricePrimary !== null &&
    Number(payload.factorToBase) > 0
  ) {
    payload.sellingPriceBase = Number(payload.sellingPricePrimary) / Number(payload.factorToBase);
  }

  // If no baseUom, force base prices to 0 (or keep null if your schema allows null)
  if (!baseUom) {
    payload.avgCostBase = 0;
    payload.sellingPriceBase = 0;
  }

  const item = await Item.create(payload);

  if (item.supplier) {
    await Supplier.findByIdAndUpdate(item.supplier, { $addToSet: { items: item._id } });
  }

  const salesRepStocks = await SalesRepStock.find({ item: item._id });
  await Promise.all(
    salesRepStocks.map(async (stock) => {
      stock.stockValuePrimary =
        Number(stock.qtyOnHandPrimary || 0) * Number(item.avgCostPrimary || 0);
      stock.stockValueBase = Number(stock.qtyOnHandBase || 0) * Number(item.avgCostBase || 0);
      await stock.save();
    })
  );

  return item.toObject();
}

// LIST ITEMS (with SalesRep stock)
async function listItems(filter = {}, options = {}, actor = null) {
  const { page = 1, limit = 50, q, status, salesRep } = options;

  const where = { ...filter };
  if (status) where.status = status;
  if (q) {
    const regex = new RegExp(q, "i");
    where.$or = [{ itemCode: regex }, { name: regex }, { description: regex }];
  }

  const items = await Item.find(where)
    .populate("brand", "_id brandCode name")
    .populate("productGroup", "_id groupCode name units")
    .populate("supplier", "_id supplierCode name")
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  let forSalesRepId = null;
  if (actor?.actorType === "SalesRep") {
    forSalesRepId = actor.actorId;
  } else if (actor?.actorType === "User" && salesRep) {
    forSalesRepId = salesRep;
  }

  const stockMap = await buildStockMapForItems(
    items.map((i) => i._id),
    { forSalesRepId }
  );

  items.forEach((item) => {
    const resolved = resolveItemStock(item, stockMap.get(String(item._id)));

    // ✅ nested qtyOnHand object
    item.qtyOnHand = {
      qtyOnHandPrimary: resolved.qtyOnHandPrimary,
      qtyOnHandBase: resolved.qtyOnHandBase,
    };

    // ✅ reorderLevel is in PRIMARY units
    item.stockStatus = computeStockStatusFromQty(item, resolved.qtyOnHandPrimary);
  });

  return items;
}

// GET SINGLE ITEM (with SalesRep stock)
async function getItem(id, actor = null, options = {}) {
  const itemId = toObjectId(id);
  if (!itemId) throw new Error("Valid item ID is required");

  const item = await Item.findById(itemId)
    .populate("brand", "_id brandCode name")
    .populate("productGroup", "_id groupCode name units")
    .populate("supplier", "_id supplierCode name")
    .lean();

  if (!item) return null;

  let forSalesRepId = null;
  if (actor?.actorType === "SalesRep") forSalesRepId = actor.actorId;
  else if (actor?.actorType === "User" && options.salesRep) forSalesRepId = options.salesRep;

  const stockMap = await buildStockMapForItems([item._id], { forSalesRepId });
  const resolved = resolveItemStock(item, stockMap.get(String(item._id)));

  item.qtyOnHand = {
    qtyOnHandPrimary: resolved.qtyOnHandPrimary,
    qtyOnHandBase: resolved.qtyOnHandBase,
  };
  item.stockStatus = computeStockStatusFromQty(item, resolved.qtyOnHandPrimary);

  return item;
}

// UPDATE ITEM
async function updateItem(id, payload) {
  const itemId = toObjectId(id);
  if (!itemId) throw new Error("Valid item ID is required");

  const oldItem = await Item.findById(itemId).lean();
  if (!oldItem) throw new Error("Item not found");

  const mergedForFactor = {
    ...oldItem,
    ...payload,
    uoms: payload.uoms || oldItem.uoms || [],
    primaryUom: payload.primaryUom || oldItem.primaryUom,
    baseUom: payload.baseUom !== undefined ? payload.baseUom : oldItem.baseUom,
  };

  // Recalculate factor only when a base UOM exists and factor not provided
  if (
    mergedForFactor.baseUom &&
    (payload.primaryUom || payload.baseUom !== undefined || payload.uoms) &&
    (payload.factorToBase === undefined || payload.factorToBase === null)
  ) {
    payload.factorToBase = await calculateFactorToBase(
      mergedForFactor.primaryUom,
      mergedForFactor.baseUom,
      mergedForFactor.uoms
    );
  }

  // If baseUom removed, normalize factor/base prices
  if (payload.baseUom === null || payload.baseUom === "") {
    payload.factorToBase = 1;
    payload.avgCostBase = 0;
    payload.sellingPriceBase = 0;
  }

  const effectiveBaseUom =
    payload.baseUom !== undefined ? payload.baseUom : oldItem.baseUom;
  const effectiveFactorToBase = Number(
    payload.factorToBase ??
      oldItem.factorToBase ??
      0
  );

  // Recalculate base prices only for items that actually have a baseUom
  if (
    effectiveBaseUom &&
    payload.avgCostPrimary !== undefined &&
    payload.avgCostPrimary !== null &&
    (payload.avgCostBase === undefined || payload.avgCostBase === null) &&
    effectiveFactorToBase > 0
  ) {
    payload.avgCostBase = Number(payload.avgCostPrimary) / effectiveFactorToBase;
  }

  if (
    effectiveBaseUom &&
    payload.sellingPricePrimary !== undefined &&
    payload.sellingPricePrimary !== null &&
    (payload.sellingPriceBase === undefined || payload.sellingPriceBase === null) &&
    effectiveFactorToBase > 0
  ) {
    payload.sellingPriceBase = Number(payload.sellingPricePrimary) / effectiveFactorToBase;
  }

  const updated = await Item.findByIdAndUpdate(itemId, payload, { new: true }).lean();

  // Supplier change sync
  const oldSupplierId = oldItem.supplier ? String(oldItem.supplier) : null;
  const newSupplierId =
    payload.supplier !== undefined
      ? (payload.supplier ? String(payload.supplier) : null)
      : oldSupplierId;

  if (oldSupplierId && oldSupplierId !== newSupplierId) {
    await Supplier.findByIdAndUpdate(oldItem.supplier, { $pull: { items: updated._id } });
  }
  if (newSupplierId) {
    await Supplier.findByIdAndUpdate(newSupplierId, { $addToSet: { items: updated._id } });
  }

  // Update SalesRepStock values after item update
  const salesRepStocks = await SalesRepStock.find({ item: updated._id });
  await Promise.all(
    salesRepStocks.map(async (stock) => {
      stock.stockValuePrimary =
        Number(stock.qtyOnHandPrimary || 0) * Number(updated.avgCostPrimary || 0);
      stock.stockValueBase = Number(stock.qtyOnHandBase || 0) * Number(updated.avgCostBase || 0);
      await stock.save();
    })
  );

  return updated;
}

// REMOVE ITEM
async function removeItem(id) {
  const itemId = toObjectId(id);
  if (!itemId) throw new Error("Valid item ID is required");

  const item = await Item.findByIdAndDelete(itemId).lean();
  if (!item) return null;

  if (item.supplier) {
    await Supplier.findByIdAndUpdate(item.supplier, { $pull: { items: item._id } });
  }

  await SalesRepStock.deleteMany({ item: item._id });

  return item;
}

// LIST ITEMS BY SUPPLIER (with SalesRep stock)
async function getItemsBySupplier(supplierId, actor = null, options = {}) {
  const items = await Item.find({ supplier: supplierId })
    .populate("brand", "_id brandCode name")
    .populate("productGroup", "_id groupCode name units")
    .populate("supplier", "_id supplierCode name")
    .lean();

  let forSalesRepId = null;
  if (actor?.actorType === "SalesRep") forSalesRepId = actor.actorId;
  else if (actor?.actorType === "User" && options.salesRep) forSalesRepId = options.salesRep;

  const stockMap = await buildStockMapForItems(
    items.map((i) => i._id),
    { forSalesRepId }
  );

  return items.map((item) => {
    const resolved = resolveItemStock(item, stockMap.get(String(item._id)));

    return {
      ...item,
      qtyOnHand: {
        qtyOnHandPrimary: resolved.qtyOnHandPrimary,
        qtyOnHandBase: resolved.qtyOnHandBase,
      },
      stockStatus: computeStockStatusFromQty(item, resolved.qtyOnHandPrimary),
    };
  });
}

module.exports = {
  createItem,
  listItems,
  getItem,
  updateItem,
  removeItem,
  getItemsBySupplier,
};