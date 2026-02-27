// services/inventory/item.service.js
const Item = require("../../models/inventory/item.model");
const Supplier = require("../../models/user/supplier.model");
const SalesRepStock = require("../../models/inventory/salesRepStock.model");
const mongoose = require("mongoose");

function toObjectId(id) {
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Apply sales-rep scope to stock queries when the caller is restricted.
function applySalesRepScope(filter = {}, scope = {}) {
  const q = { ...filter };
  if (scope.salesRep) q.salesRep = toObjectId(scope.salesRep);
  return q;
}

// Calculate factorToBase from the UOM tree where primary is the root and base is a descendant.
async function calculateFactorToBase(primaryUomCode, baseUomCode, uoms = []) {
  if (!primaryUomCode || !baseUomCode) throw new Error("Both primaryUom and baseUom are required to calculate factorToBase");

  const uomMap = {};
  uoms.forEach((u) => {
    if (!u.uomCode) return;
    uomMap[u.uomCode] = u;
  });

  const primary = uomMap[primaryUomCode];
  const base = uomMap[baseUomCode];

  if (!primary) throw new Error(`Primary UOM not found in uoms: ${primaryUomCode}`);
  if (!base) throw new Error(`Base UOM not found in uoms: ${baseUomCode}`);

  let factorToBase = 1;
  let currentUOM = base;

  while (currentUOM && currentUOM.uomCode !== primaryUomCode) {
    if (!currentUOM.parentCode) throw new Error(`Base UOM ${baseUomCode} is not under primary UOM ${primaryUomCode} in the hierarchy`);
    const parentUOM = uomMap[currentUOM.parentCode];
    if (!parentUOM) throw new Error(`Parent UOM not found: ${currentUOM.parentCode}`);

    factorToBase *= Number(currentUOM.factorToParent || 0);
    if (!Number.isFinite(factorToBase) || factorToBase <= 0) throw new Error(`Invalid factorToParent for UOM: ${currentUOM.uomCode}`);

    currentUOM = parentUOM;
  }

  if (currentUOM?.uomCode !== primaryUomCode) throw new Error(`Base UOM ${baseUomCode} is not reachable from primary UOM ${primaryUomCode}`);
  return factorToBase;
}

// Compute item stock status using primary-unit reorder thresholds.
function computeStockStatusFromQty(item, qtyOnHandPrimary) {
  const rlPrimary = Number(item.reorderLevel || 0);
  if (qtyOnHandPrimary <= 0) return "out_of_stock";
  if (rlPrimary > 0 && qtyOnHandPrimary <= rlPrimary) return "low_stock";
  return "in_stock";
}

// Build a stock summary map keyed by item ID, optionally scoped to a single sales rep.
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
        qtyOnHandLegacy: { $sum: { $ifNull: ["$qtyOnHand", 0] } }, // Legacy qtyOnHand fallback from older schema records.
      },
    },
  ]);

  const stockMap = new Map();
  stockData.forEach((r) => {
    stockMap.set(String(r._id), { qtyOnHandPrimary: Number(r.qtyOnHandPrimary || 0), qtyOnHandBase: Number(r.qtyOnHandBase || 0), qtyOnHandLegacy: Number(r.qtyOnHandLegacy || 0) });
  });

  return stockMap;
}

// Normalize stock values without converting between UOMs, using legacy qty only as fallback.
function resolveItemStock(item, stock) {
  const safeStock = stock || { qtyOnHandPrimary: 0, qtyOnHandBase: 0, qtyOnHandLegacy: 0 };
  let qtyPrimary = Number(safeStock.qtyOnHandPrimary || 0);
  let qtyBase = Number(safeStock.qtyOnHandBase || 0);
  const qtyLegacy = Number(safeStock.qtyOnHandLegacy || 0);
  const hasBaseUom = !!item.baseUom;

  if (qtyPrimary <= 0 && qtyBase <= 0 && qtyLegacy > 0) {
    qtyPrimary = qtyLegacy; // Assume old qtyOnHand represented primary qty.
    qtyBase = 0;
  }

  if (!hasBaseUom) qtyBase = 0;

  return { qtyOnHandPrimary: qtyPrimary, qtyOnHandBase: qtyBase, qtyOnHandLegacy: qtyLegacy };
}

// Create an item with automatic factor/base-price derivation and supplier/stock sync updates.
async function createItem(payload) {
  if (!payload) throw new Error("Item payload is required");

  const { primaryUom, baseUom, uoms = [] } = payload;

  if (baseUom && (payload.factorToBase === undefined || payload.factorToBase === null)) {
    payload.factorToBase = await calculateFactorToBase(primaryUom, baseUom, uoms);
  }

  if (!baseUom && (payload.factorToBase === undefined || payload.factorToBase === null)) payload.factorToBase = 1; // Keep single-UOM items normalized.

  if (baseUom && (payload.avgCostBase === undefined || payload.avgCostBase === null) && payload.avgCostPrimary !== undefined && payload.avgCostPrimary !== null && Number(payload.factorToBase) > 0) {
    payload.avgCostBase = Number(payload.avgCostPrimary) / Number(payload.factorToBase);
  }

  if (baseUom && (payload.sellingPriceBase === undefined || payload.sellingPriceBase === null) && payload.sellingPricePrimary !== undefined && payload.sellingPricePrimary !== null && Number(payload.factorToBase) > 0) {
    payload.sellingPriceBase = Number(payload.sellingPricePrimary) / Number(payload.factorToBase);
  }

  if (!baseUom) {
    payload.avgCostBase = 0;
    payload.sellingPriceBase = 0;
  }

  const item = await Item.create(payload);

  if (item.supplier) await Supplier.findByIdAndUpdate(item.supplier, { $addToSet: { items: item._id } });

  const salesRepStocks = await SalesRepStock.find({ item: item._id });
  await Promise.all(salesRepStocks.map(async (stock) => {
    stock.stockValuePrimary = Number(stock.qtyOnHandPrimary || 0) * Number(item.avgCostPrimary || 0);
    stock.stockValueBase = Number(stock.qtyOnHandBase || 0) * Number(item.avgCostBase || 0);
    await stock.save();
  }));

  return item.toObject();
}

// List items with populated refs and resolved stock quantities for the current actor scope.
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
  if (actor?.actorType === "SalesRep") forSalesRepId = actor.actorId;
  else if (actor?.actorType === "User" && salesRep) forSalesRepId = salesRep;

  const stockMap = await buildStockMapForItems(items.map((i) => i._id), { forSalesRepId });

  items.forEach((item) => {
    const resolved = resolveItemStock(item, stockMap.get(String(item._id)));
    item.qtyOnHand = { qtyOnHandPrimary: resolved.qtyOnHandPrimary, qtyOnHandBase: resolved.qtyOnHandBase };
    item.stockStatus = computeStockStatusFromQty(item, resolved.qtyOnHandPrimary);
  });

  return items;
}

// Get a single item with resolved stock quantities scoped to the current actor when applicable.
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

  item.qtyOnHand = { qtyOnHandPrimary: resolved.qtyOnHandPrimary, qtyOnHandBase: resolved.qtyOnHandBase };
  item.stockStatus = computeStockStatusFromQty(item, resolved.qtyOnHandPrimary);

  return item;
}

// Update an item, recalculate UOM factors/base prices when needed, and resync supplier/stock values.
async function updateItem(id, payload) {
  const itemId = toObjectId(id);
  if (!itemId) throw new Error("Valid item ID is required");

  const oldItem = await Item.findById(itemId).lean();
  if (!oldItem) throw new Error("Item not found");

  const mergedForFactor = { ...oldItem, ...payload, uoms: payload.uoms || oldItem.uoms || [], primaryUom: payload.primaryUom || oldItem.primaryUom, baseUom: payload.baseUom !== undefined ? payload.baseUom : oldItem.baseUom };

  if (mergedForFactor.baseUom && (payload.primaryUom || payload.baseUom !== undefined || payload.uoms) && (payload.factorToBase === undefined || payload.factorToBase === null)) {
    payload.factorToBase = await calculateFactorToBase(mergedForFactor.primaryUom, mergedForFactor.baseUom, mergedForFactor.uoms);
  }

  if (payload.baseUom === null || payload.baseUom === "") {
    payload.factorToBase = 1;
    payload.avgCostBase = 0;
    payload.sellingPriceBase = 0;
  }

  const effectiveBaseUom = payload.baseUom !== undefined ? payload.baseUom : oldItem.baseUom;
  const effectiveFactorToBase = Number(payload.factorToBase ?? oldItem.factorToBase ?? 0);

  if (effectiveBaseUom && payload.avgCostPrimary !== undefined && payload.avgCostPrimary !== null && (payload.avgCostBase === undefined || payload.avgCostBase === null) && effectiveFactorToBase > 0) {
    payload.avgCostBase = Number(payload.avgCostPrimary) / effectiveFactorToBase;
  }

  if (effectiveBaseUom && payload.sellingPricePrimary !== undefined && payload.sellingPricePrimary !== null && (payload.sellingPriceBase === undefined || payload.sellingPriceBase === null) && effectiveFactorToBase > 0) {
    payload.sellingPriceBase = Number(payload.sellingPricePrimary) / effectiveFactorToBase;
  }

  const updated = await Item.findByIdAndUpdate(itemId, payload, { new: true }).lean();

  const oldSupplierId = oldItem.supplier ? String(oldItem.supplier) : null;
  const newSupplierId = payload.supplier !== undefined ? (payload.supplier ? String(payload.supplier) : null) : oldSupplierId;

  if (oldSupplierId && oldSupplierId !== newSupplierId) await Supplier.findByIdAndUpdate(oldItem.supplier, { $pull: { items: updated._id } });
  if (newSupplierId) await Supplier.findByIdAndUpdate(newSupplierId, { $addToSet: { items: updated._id } });

  const salesRepStocks = await SalesRepStock.find({ item: updated._id });
  await Promise.all(salesRepStocks.map(async (stock) => {
    stock.stockValuePrimary = Number(stock.qtyOnHandPrimary || 0) * Number(updated.avgCostPrimary || 0);
    stock.stockValueBase = Number(stock.qtyOnHandBase || 0) * Number(updated.avgCostBase || 0);
    await stock.save();
  }));

  return updated;
}

// Remove an item and clean up supplier links and related sales-rep stock rows.
async function removeItem(id) {
  const itemId = toObjectId(id);
  if (!itemId) throw new Error("Valid item ID is required");

  const item = await Item.findByIdAndDelete(itemId).lean();
  if (!item) return null;

  if (item.supplier) await Supplier.findByIdAndUpdate(item.supplier, { $pull: { items: item._id } });
  await SalesRepStock.deleteMany({ item: item._id });

  return item;
}

// List items for a supplier with resolved stock quantities for the current actor scope.
async function getItemsBySupplier(supplierId, actor = null, options = {}) {
  const items = await Item.find({ supplier: supplierId })
    .populate("brand", "_id brandCode name")
    .populate("productGroup", "_id groupCode name units")
    .populate("supplier", "_id supplierCode name")
    .lean();

  let forSalesRepId = null;
  if (actor?.actorType === "SalesRep") forSalesRepId = actor.actorId;
  else if (actor?.actorType === "User" && options.salesRep) forSalesRepId = options.salesRep;

  const stockMap = await buildStockMapForItems(items.map((i) => i._id), { forSalesRepId });

  return items.map((item) => {
    const resolved = resolveItemStock(item, stockMap.get(String(item._id)));
    return { ...item, qtyOnHand: { qtyOnHandPrimary: resolved.qtyOnHandPrimary, qtyOnHandBase: resolved.qtyOnHandBase }, stockStatus: computeStockStatusFromQty(item, resolved.qtyOnHandPrimary) };
  });
}

// List per-sales-rep stock rows grouped under each item, with totals and scoped access.
async function listSalesRepStockDetails(filter = {}, scope = {}) {
  const stockQuery = applySalesRepScope({}, scope);
  const stockRows = await SalesRepStock.find(stockQuery).populate("salesRep", "_id repCode name").sort({ updatedAt: -1 }).lean();
  if (!stockRows.length) return [];

  const itemIds = [...new Set(stockRows.map((r) => String(r.item)).filter(Boolean))].map(toObjectId);
  const itemWhere = { ...filter, _id: { $in: itemIds } };

  const items = await Item.find(itemWhere).populate("brand", "_id brandCode name").populate("supplier", "_id supplierCode name").sort({ createdAt: -1 }).lean();
  if (!items.length) return [];

  const rowsByItem = new Map();
  for (const r of stockRows) {
    const key = String(r.item);
    if (!rowsByItem.has(key)) rowsByItem.set(key, []);
    rowsByItem.get(key).push(r);
  }

  return items.map((item) => {
    const hasBaseUom = !!item.baseUom;
    const rows = rowsByItem.get(String(item._id)) || [];

    const details = rows.map((r) => ({
      _id: r._id,
      salesRep: r.salesRep ? { _id: r.salesRep._id, repCode: r.salesRep.repCode, name: r.salesRep.name } : null,
      qtyOnHand: { qtyOnHandPrimary: toNumber(r.qtyOnHandPrimary), qtyOnHandBase: hasBaseUom ? toNumber(r.qtyOnHandBase) : 0 },
      factorToBase: toNumber(r.factorToBase) || toNumber(item.factorToBase) || 1,
      stockValue: { stockValuePrimary: toNumber(r.stockValuePrimary), stockValueBase: hasBaseUom ? toNumber(r.stockValueBase) : 0 },
      uom: { primaryUom: item.primaryUom || null, baseUom: item.baseUom || null },
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    }));

    const totals = details.reduce((acc, row) => {
      acc.qtyOnHandPrimary += toNumber(row.qtyOnHand.qtyOnHandPrimary);
      acc.qtyOnHandBase += toNumber(row.qtyOnHand.qtyOnHandBase);
      acc.stockValuePrimary += toNumber(row.stockValue.stockValuePrimary);
      acc.stockValueBase += toNumber(row.stockValue.stockValueBase);
      return acc;
    }, { qtyOnHandPrimary: 0, qtyOnHandBase: 0, stockValuePrimary: 0, stockValueBase: 0 });

    const stockStatus = computeStockStatusFromQty(item, totals.qtyOnHandPrimary);

    return {
      item: {
        _id: item._id,
        itemCode: item.itemCode,
        name: item.name,
        primaryUom: item.primaryUom || null,
        baseUom: item.baseUom || null,
        factorToBase: toNumber(item.factorToBase) || 1,
        avgCostPrimary: toNumber(item.avgCostPrimary),
        avgCostBase: toNumber(item.avgCostBase),
        sellingPricePrimary: toNumber(item.sellingPricePrimary),
        sellingPriceBase: toNumber(item.sellingPriceBase),
        brand: item.brand || null,
        supplier: item.supplier || null,
      },
      stockStatus,
      rows: details,
      totals,
    };
  });
}

module.exports = { createItem, listItems, getItem, updateItem, removeItem, getItemsBySupplier, listSalesRepStockDetails };