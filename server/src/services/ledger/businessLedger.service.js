// services/ledger/businessLedger.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");

const StockLedger = require("../../models/ledger/StockLedger.model");
const SalesLedger = require("../../models/ledger/SalesLedger.model");
const Branch = require("../../models/inventorySettings/branch.model");
const Item = require("../../models/inventory/item.model");

// UOM Helpers
const { formatQtySplit, splitFromBaseEquivalent } = require("../../utils/uomDisplay");

// Utility function to convert value to ObjectId
function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

// Utility function to convert value to finite number, fallback to 0
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Supported sales transaction types
const SALES_TYPES = ["sale", "sales-return", "adj-sale", "adj-sales-return"];

// Revenue impact per transaction type
const REVENUE_SIGN = {
  sale: 1,
  "adj-sale": 1,
  "sales-return": -1,
  "adj-sales-return": -1,
};

// COGS impact per transaction type
const COST_SIGN = {
  sale: 1,
  "adj-sale": 1,
  "sales-return": -1,
  "adj-sales-return": -1,
};

// Get Business Summary: Revenue, COGS, Profit & Margin
async function getBusinessSummary({
  branch = null,
  salesRep = null,
  from = null,
  to = null,
} = {}) {
  // SalesLedger match for revenue
  const salesMatch = { transactionType: { $in: SALES_TYPES } };
  if (branch) salesMatch.branch = toObjectId(branch);
  if (salesRep) salesMatch.salesRep = toObjectId(salesRep);
  if (from || to) {
    salesMatch.createdAt = {};
    if (from) salesMatch.createdAt.$gte = from;
    if (to) salesMatch.createdAt.$lte = to;
  }

  const salesAgg = await SalesLedger.aggregate([
    { $match: salesMatch },
    {
      $group: {
        _id: "$transactionType",
        total: { $sum: "$totalSellingValue" },
      },
    },
  ]);

  let totalRevenue = 0;
  let salesReturn = 0;
  let adjSalesReturn = 0;

  // Calculate total revenue based on transaction types
  for (const { _id: type, total: grossValRaw } of salesAgg) {
    const grossVal = toNumber(grossValRaw);
    const sign = REVENUE_SIGN[type] || 0;
    const signedVal = grossVal * sign;

    totalRevenue += signedVal;
    if (type === "sales-return") salesReturn += signedVal;
    if (type === "adj-sales-return") adjSalesReturn += signedVal;
  }

  // StockLedger match for COGS
  const costMatch = { transactionType: { $in: SALES_TYPES } };
  if (branch) costMatch.branch = toObjectId(branch);
  if (salesRep) costMatch.salesRep = toObjectId(salesRep);
  if (from || to) {
    costMatch.createdAt = {};
    if (from) costMatch.createdAt.$gte = from;
    if (to) costMatch.createdAt.$lte = to;
  }

  const costAgg = await StockLedger.aggregate([
    { $match: costMatch },
    {
      $group: {
        _id: "$transactionType",
        total: { $sum: "$itemTotalValue" },
      },
    },
  ]);

  let totalCostRaw = 0;
  let costReturn = 0;
  let costAdjSalesReturn = 0;

  // Calculate total cost based on transaction types
  for (const { _id: type, total: grossValRaw } of costAgg) {
    const grossVal = toNumber(grossValRaw);
    const sign = COST_SIGN[type] || 0;
    const signedVal = grossVal * sign;

    totalCostRaw += signedVal;
    if (type === "sales-return") costReturn += signedVal;
    if (type === "adj-sales-return") costAdjSalesReturn += signedVal;
  }

  // Calculate net COGS and profit margin
  const totalCost = Math.abs(totalCostRaw);
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue ? (profit / totalRevenue) * 100 : 0;

  const returnImpactRevenue = salesReturn + adjSalesReturn;
  const returnImpactCost = costReturn + costAdjSalesReturn;
  const returnImpactTotal = returnImpactRevenue - returnImpactCost;

  return {
    totalRevenue,
    totalCost,
    profit,
    margin: Number(margin.toFixed(2)),
    returnImpact: {
      salesReturn,
      adjSalesReturn,
      costReturn,
      costAdjSalesReturn,
      returnImpactRevenue,
      returnImpactCost,
      returnImpactTotal,
    },
  };
}

// Get Item Summary per Item & Branch (multi-UOM aware)
async function getItemSummary({
  branch = null,
  salesRep = null,
  from = null,
  to = null,
} = {}) {
  // SalesLedger aggregation for revenue and quantities
  const salesMatch = { transactionType: { $in: SALES_TYPES } };
  if (branch) salesMatch.branch = toObjectId(branch);
  if (salesRep) salesMatch.salesRep = toObjectId(salesRep);
  if (from || to) {
    salesMatch.createdAt = {};
    if (from) salesMatch.createdAt.$gte = from;
    if (to) salesMatch.createdAt.$lte = to;
  }

  const salesAgg = await SalesLedger.aggregate([
    { $match: salesMatch },
    {
      $project: {
        item: 1,
        branch: 1,
        transactionType: 1,
        totalSellingValue: 1,

        primaryQty: { $ifNull: ["$primaryQty", 0] },
        baseQty: { $ifNull: ["$baseQty", 0] },
        factorToBase: { $ifNull: ["$factorToBase", 1] },

        // sign for sales vs returns
        sign: {
          $switch: {
            branches: [
              { case: { $in: ["$transactionType", ["sale", "adj-sale"]] }, then: 1 },
              {
                case: {
                  $in: ["$transactionType", ["sales-return", "adj-sales-return"]],
                },
                then: -1,
              },
            ],
            default: 0,
          },
        },
      },
    },
    {
      $project: {
        item: 1,
        branch: 1,

        // signed primary/base qty
        signedPrimaryQty: {
          $multiply: ["$primaryQty", "$sign"],
        },
        signedBaseQty: {
          $multiply: ["$baseQty", "$sign"],
        },

        // base-equivalent with sign (for numeric use if needed)
        qtyBaseEqAdj: {
          $multiply: [
            {
              $add: [
                "$baseQty",
                { $multiply: ["$primaryQty", "$factorToBase"] },
              ],
            },
            "$sign",
          ],
        },

        // revenue with sign
        revenueAdj: {
          $multiply: ["$totalSellingValue", "$sign"],
        },
      },
    },
    {
      $group: {
        _id: { item: "$item", branch: "$branch" },
        qtyPrimary: { $sum: "$signedPrimaryQty" },   // net primary qty
        qtyBase: { $sum: "$signedBaseQty" },         // net base qty
        qtyBaseEq: { $sum: "$qtyBaseEqAdj" },        // net base-equivalent
        totalRevenue: { $sum: "$revenueAdj" },
      },
    },
  ]);

  const revenueMap = new Map(); // key: `${itemId}_${branchId}`
  for (const row of salesAgg) {
    const itemId = String(row._id.item);
    const branchId = String(row._id.branch);
    const key = `${itemId}_${branchId}`;

    revenueMap.set(key, {
      qtyPrimary: toNumber(row.qtyPrimary),
      qtyBase: toNumber(row.qtyBase),
      qtyBaseEq: toNumber(row.qtyBaseEq),
      totalRevenue: toNumber(row.totalRevenue),
    });
  }

  // StockLedger aggregation for COGS
  const costMatch = { transactionType: { $in: SALES_TYPES } };
  if (branch) costMatch.branch = toObjectId(branch);
  if (salesRep) costMatch.salesRep = toObjectId(salesRep);
  if (from || to) {
    costMatch.createdAt = {};
    if (from) costMatch.createdAt.$gte = from;
    if (to) costMatch.createdAt.$lte = to;
  }

  const costAgg = await StockLedger.aggregate([
    { $match: costMatch },
    {
      $group: {
        _id: { item: "$item", branch: "$branch", transactionType: "$transactionType" },
        totalCostGross: { $sum: "$itemTotalValue" },
      },
    },
  ]);

  const costMap = new Map(); // key -> signed cost
  for (const { _id, totalCostGross = 0 } of costAgg) {
    const itemId = String(_id.item);
    const branchId = String(_id.branch);
    const type = _id.transactionType;
    const key = `${itemId}_${branchId}`;

    const signedCost = toNumber(totalCostGross) * (COST_SIGN[type] || 0);
    costMap.set(key, (costMap.get(key) || 0) + signedCost);
  }

  // Convert to net positive cost (sales - returns)
  for (const [key, val] of costMap.entries()) {
    costMap.set(key, Math.abs(val));
  }

  // Enrich with Item & Branch metadata
  const allKeys = new Set([...revenueMap.keys(), ...costMap.keys()]);
  const itemIds = [...allKeys].map((k) => k.split("_")[0]);
  const branchIds = [...allKeys].map((k) => k.split("_")[1]);

  const [items, branches] = await Promise.all([
    Item.find({ _id: { $in: itemIds } })
      .select("name itemCode brand factorToBase primaryUom baseUom")
      .lean(),
    Branch.find({ _id: { $in: branchIds } })
      .select("name branchCode")
      .lean(),
  ]);

  const itemMap = new Map(items.map((i) => [String(i._id), i]));
  const branchMap = new Map(branches.map((b) => [String(b._id), b]));

  const result = [];
  for (const key of allKeys) {
    const [itemId, branchId] = key.split("_");
    const rev = revenueMap.get(key) || {
      qtyPrimary: 0,
      qtyBase: 0,
      qtyBaseEq: 0,
      totalRevenue: 0,
    };
    const totalCost = costMap.get(key) || 0;

    const qtyPrimary = toNumber(rev.qtyPrimary);
    const qtyBase = toNumber(rev.qtyBase);
    const qtyBaseEq = toNumber(rev.qtyBaseEq);
    const totalRevenue = toNumber(rev.totalRevenue);

    const profit = totalRevenue - totalCost;
    const margin = totalRevenue ? (profit / totalRevenue) * 100 : 0;

    const itemInfo = itemMap.get(itemId) || {};
    const branchInfo = branchMap.get(branchId) || {};

    const primaryLabel = itemInfo.primaryUom || "PRIMARY";
    const baseLabel = itemInfo.baseUom || "BASE";

    const qtyDisplay = formatQtySplit({
      primaryQty: qtyPrimary,
      baseQty: qtyBase,
      primaryLabel,
      baseLabel,
    });

    result.push({
      itemId,
      itemCode: itemInfo.itemCode || "",
      itemName: itemInfo.name || "Unknown",
      branchId,
      branchName: branchInfo.name || "Unknown",
      branchCode: branchInfo.branchCode || "",

      qtySoldBaseEq: qtyBaseEq, // net base-equivalent (for charts / calc)
      qtyPrimary,
      qtyBase,
      qtyDisplay,
      qtySold: qtyDisplay, // backwards-compatible

      totalRevenue,
      totalCost,
      profit,
      margin: Number(margin.toFixed(2)),
    });
  }

  return result;
}

// Get Branch Summary: Item count + Financials per Branch
async function getBranchSummary({
  branch = null,
  salesRep = null,
  from = null,
  to = null,
} = {}) {
  // Revenue aggregation (SalesLedger)
  const salesMatch = { transactionType: { $in: SALES_TYPES } };
  if (branch) salesMatch.branch = toObjectId(branch);
  if (salesRep) salesMatch.salesRep = toObjectId(salesRep);
  if (from || to) {
    salesMatch.createdAt = {};
    if (from) salesMatch.createdAt.$gte = from;
    if (to) salesMatch.createdAt.$lte = to;
  }

  // Revenue per branch (sales positive, returns negative)
  const salesRevenueAgg = await SalesLedger.aggregate([
    { $match: salesMatch },
    {
      $project: {
        branch: 1,
        transactionType: 1,
        totalSellingValue: { $ifNull: ["$totalSellingValue", 0] },
        sign: {
          $switch: {
            branches: [
              { case: { $in: ["$transactionType", ["sale", "adj-sale"]] }, then: 1 },
              {
                case: {
                  $in: ["$transactionType", ["sales-return", "adj-sales-return"]],
                },
                then: -1,
              },
            ],
            default: 0,
          },
        },
      },
    },
    {
      $project: {
        branch: 1,
        revenueAdj: { $multiply: ["$totalSellingValue", "$sign"] },
      },
    },
    {
      $group: {
        _id: "$branch",
        totalRevenue: { $sum: "$revenueAdj" },
      },
    },
  ]);

  const branchRev = new Map(); // branchId -> { totalRevenue }
  for (const row of salesRevenueAgg) {
    const branchId = String(row._id);
    branchRev.set(branchId, {
      totalRevenue: toNumber(row.totalRevenue),
    });
  }

  // Distinct item count sold per branch (net sold > 0)
  const salesItemCountAgg = await SalesLedger.aggregate([
    { $match: salesMatch },
    {
      $project: {
        branch: 1,
        item: 1,
        transactionType: 1,
        primaryQty: { $ifNull: ["$primaryQty", 0] },
        baseQty: { $ifNull: ["$baseQty", 0] },
        factorToBase: { $ifNull: ["$factorToBase", 1] },
        sign: {
          $switch: {
            branches: [
              { case: { $in: ["$transactionType", ["sale", "adj-sale"]] }, then: 1 },
              {
                case: {
                  $in: ["$transactionType", ["sales-return", "adj-sales-return"]],
                },
                then: -1,
              },
            ],
            default: 0,
          },
        },
      },
    },
    {
      $project: {
        branch: 1,
        item: 1,
        qtyBaseEqAdj: {
          $multiply: [
            {
              $add: [
                "$baseQty",
                { $multiply: ["$primaryQty", "$factorToBase"] },
              ],
            },
            "$sign",
          ],
        },
      },
    },
    {
      $group: {
        _id: { branch: "$branch", item: "$item" },
        netQtyBaseEq: { $sum: "$qtyBaseEqAdj" },
      },
    },
    {
      $match: {
        netQtyBaseEq: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: "$_id.branch",
        itemCountSold: { $sum: 1 },
      },
    },
  ]);

  const branchItemCount = new Map(); // branchId -> count
  for (const row of salesItemCountAgg) {
    const branchId = String(row._id);
    branchItemCount.set(branchId, toNumber(row.itemCountSold));
  }

  // COGS aggregation (StockLedger)
  const costMatch = { transactionType: { $in: SALES_TYPES } };
  if (branch) costMatch.branch = toObjectId(branch);
  if (salesRep) costMatch.salesRep = toObjectId(salesRep);
  if (from || to) {
    costMatch.createdAt = {};
    if (from) costMatch.createdAt.$gte = from;
    if (to) costMatch.createdAt.$lte = to;
  }

  const costAgg = await StockLedger.aggregate([
    { $match: costMatch },
    {
      $group: {
        _id: { branch: "$branch", transactionType: "$transactionType" },
        totalCostGross: { $sum: "$itemTotalValue" },
      },
    },
  ]);

  const branchCostRaw = new Map(); // branchId -> signed cost
  for (const { _id, totalCostGross = 0 } of costAgg) {
    const branchId = String(_id.branch);
    const type = _id.transactionType;
    const signedCost = toNumber(totalCostGross) * (COST_SIGN[type] || 0);

    branchCostRaw.set(branchId, (branchCostRaw.get(branchId) || 0) + signedCost);
  }

  const branchCost = new Map();
  for (const [branchId, val] of branchCostRaw.entries()) {
    branchCost.set(branchId, Math.abs(val));
  }

  // Enrich with Branch metadata
  const branchIds = [
    ...new Set([...branchRev.keys(), ...branchCost.keys(), ...branchItemCount.keys()]),
  ];

  const branches = await Branch.find({ _id: { $in: branchIds } })
    .select("name branchCode")
    .lean();

  const branchMap = new Map(branches.map((b) => [String(b._id), b]));

  const result = [];
  for (const id of branchIds) {
    const rev = branchRev.get(id) || { totalRevenue: 0 };
    const cost = branchCost.get(id) || 0;
    const itemCountSold = branchItemCount.get(id) || 0;

    const profit = rev.totalRevenue - cost;
    const margin = rev.totalRevenue ? (profit / rev.totalRevenue) * 100 : 0;
    const info = branchMap.get(id) || {};

    result.push({
      branchId: id,
      branchName: info.name || "Unknown",
      branchCode: info.branchCode || "",

      totalRevenue: rev.totalRevenue,
      totalCost: cost,
      profit,
      margin: Number(margin.toFixed(2)),

      itemCountSold, // distinct items/SKUs with net sold qty > 0
    });
  }

  return result;
}

// Get Business Snapshot: Summary + Branch + Item
async function getBusinessSnapshot(filters = {}) {
  const [summary, branches, items] = await Promise.all([
    getBusinessSummary(filters),
    getBranchSummary(filters),
    getItemSummary(filters),
  ]);

  return {
    generatedAt: new Date(),
    totalRevenue: summary.totalRevenue,
    totalCost: summary.totalCost,
    profit: summary.profit,
    margin: summary.margin,
    returnImpact: summary.returnImpact,
    branchCount: branches.length,
    itemCount: items.length,
    branches,
    items,
  };
}

module.exports = {
  getBusinessSummary,
  getItemSummary,
  getBranchSummary,
  getBusinessSnapshot,
};
