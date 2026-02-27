// services/ledger/salesLedger.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");
const SalesLedger = require("../../models/ledger/SalesLedger.model");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const { formatQtySplit, splitFromBaseEquivalent } = require("../../utils/uomDisplay");

// Convert value to ObjectId when present.
function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

// Safely coerce value to finite number.
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Post sales ledger entry with multi-UOM qty, prices, and net/gross values.
async function postSalesLedger({
  item,
  branch,
  customer = null,
  salesRep = null,
  transactionType,
  refModel,
  refId,
  factorToBase,
  primaryQty,
  baseQty,
  sellingPriceBase = 0,
  sellingPricePrimary = 0,
  grossSellingValue = null,
  discountAmount = null,
  totalSellingValue = 0,
  remarks = "",
  createdBy = null,
  session = null,
}) {
  if (!item) throw new Error("item is required for sales ledger post");
  if (!branch) throw new Error("branch is required for sales ledger post");
  if (!transactionType) throw new Error("transactionType is required");
  if (!refModel || !refId) throw new Error("refModel and refId are required");
  if (factorToBase === undefined || factorToBase === null) throw new Error("factorToBase is required for sales ledger post");

  const branchObj = toObjectId(branch);
  const salesRepObj = salesRep ? toObjectId(salesRep) : null;
  const factorNum = toNumber(factorToBase) || 1;

  // Reject invalid factor values to preserve UOM math consistency.
  if (factorNum <= 0) {
    throw Object.assign(new Error("factorToBase must be > 0 for sales ledger post"), { status: 500, code: "INVALID_FACTOR_TO_BASE", meta: { item, branch, transactionType, factorToBase } });
  }

  // Store positive qty values only; transaction type controls sign in reporting.
  const primaryQtyNum = Math.abs(toNumber(primaryQty));
  const baseQtyNum = Math.abs(toNumber(baseQty));
  const priceBaseNum = toNumber(sellingPriceBase);
  const pricePrimaryNum = toNumber(sellingPricePrimary);

  // Derive gross value from qty and prices when caller does not send one.
  let grossValue = grossSellingValue !== null && grossSellingValue !== undefined ? toNumber(grossSellingValue) : primaryQtyNum * pricePrimaryNum + baseQtyNum * priceBaseNum;

  // Default net value to gross value when discount is not explicitly provided.
  let netValue = toNumber(totalSellingValue);
  if (!netValue) netValue = grossValue;

  // Derive discount from gross and net when not supplied.
  let discountVal = discountAmount !== null && discountAmount !== undefined ? toNumber(discountAmount) : grossValue - netValue;

  const [entry] = await SalesLedger.create([{
    item,
    branch: branchObj,
    customer,
    salesRep: salesRepObj,
    transactionType,
    refModel,
    refId,
    factorToBase: factorNum,
    primaryQty: primaryQtyNum,
    baseQty: baseQtyNum,
    sellingPriceBase: priceBaseNum,
    sellingPricePrimary: pricePrimaryNum,
    grossSellingValue: grossValue,
    discountAmount: discountVal,
    totalSellingValue: netValue,
    remarks,
    createdBy,
  }], { session });

  return entry.toObject();
}

// Post sales return ledger entry with positive qty values via postSalesLedger.
async function postSalesReturnLedger({
  item,
  branch,
  customer = null,
  salesRep = null,
  transactionType,
  refModel,
  refId,
  factorToBase,
  primaryQty,
  baseQty,
  sellingPriceBase = 0,
  sellingPricePrimary = 0,
  grossSellingValue = null,
  discountAmount = null,
  totalSellingValue = 0,
  remarks = "",
  createdBy = null,
  session = null,
}) {
  if (!item) throw new Error("item is required for sales return ledger");
  if (!branch) throw new Error("branch is required for sales return ledger");
  if (!refModel || !refId) throw new Error("refModel and refId are required for sales return ledger");
  if (!["sales-return", "adj-sales-return"].includes(transactionType)) throw new Error(`Invalid sales return transactionType: ${transactionType}`);

  // Store returns as positive qty values and handle sign later in aggregations.
  const primaryQtyAbs = Math.abs(toNumber(primaryQty));
  const baseQtyAbs = Math.abs(toNumber(baseQty));

  return postSalesLedger({ item, branch, customer, salesRep, transactionType, refModel, refId, factorToBase, primaryQty: primaryQtyAbs, baseQty: baseQtyAbs, sellingPriceBase, sellingPricePrimary, grossSellingValue, discountAmount, totalSellingValue, remarks, createdBy, session });
}

// List sales ledger rows with filters, joins, and human-readable qty display.
async function listSalesLedger({ branch = null, customer = null, salesRep = null, from = null, to = null, limit = 200 }) {
  const query = {};
  if (branch) query.branch = toObjectId(branch);
  if (customer) query.customer = toObjectId(customer);
  if (salesRep) query.salesRep = toObjectId(salesRep);
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const rows = await SalesLedger.find(query).populate("item", "itemCode name primaryUom baseUom factorToBase").populate("branch", "name branchCode").populate("customer", "name").populate("salesRep", "repCode name").sort({ createdAt: -1 }).limit(limit).lean();

  // Add formatted split qty label for each sales ledger row.
  return rows.map((row) => {
    const primaryLabel = row.item?.primaryUom || "CARTON", baseLabel = row.item?.baseUom || "PC";
    const qtyDisplay = formatQtySplit({ primaryQty: row.primaryQty, baseQty: row.baseQty, primaryLabel, baseLabel });
    return { ...row, qtyDisplay };
  });
}

// Build item-wise sales summary with signed net qty and revenue across sales/returns.
async function getSalesSummaryByItem({ branch = null, salesRep = null, from = null, to = null } = {}) {
  const match = {};
  if (branch) match.branch = toObjectId(branch);
  if (salesRep) match.salesRep = toObjectId(salesRep);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const pipeline = [
    { $match: match },
    {
      $project: {
        item: 1,
        branch: 1,
        transactionType: 1,
        factorToBase: 1,
        primaryQty: { $ifNull: ["$primaryQty", 0] },
        baseQty: { $ifNull: ["$baseQty", 0] },
        totalSellingValue: 1,
        primaryAdj: { $multiply: [{ $ifNull: ["$primaryQty", 0] }, { $switch: { branches: [{ case: { $eq: ["$transactionType", "sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 }, { case: { $eq: ["$transactionType", "adj-sales-return"] }, then: -1 }], default: 0 } }] },
        baseAdj: { $multiply: [{ $ifNull: ["$baseQty", 0] }, { $switch: { branches: [{ case: { $eq: ["$transactionType", "sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 }, { case: { $eq: ["$transactionType", "adj-sales-return"] }, then: -1 }], default: 0 } }] },
        revenueAdj: { $multiply: [{ $ifNull: ["$totalSellingValue", 0] }, { $switch: { branches: [{ case: { $eq: ["$transactionType", "sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 }, { case: { $eq: ["$transactionType", "adj-sales-return"] }, then: -1 }], default: 0 } }] },
      },
    },
    { $group: { _id: { item: "$item", branch: "$branch" }, netPrimaryQty: { $sum: "$primaryAdj" }, netBaseQty: { $sum: "$baseAdj" }, totalRevenue: { $sum: "$revenueAdj" }, factorToBase: { $first: "$factorToBase" } } },
    { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
    { $unwind: "$itemInfo" },
    { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branchInfo" } },
    { $unwind: "$branchInfo" },
    {
      $project: {
        _id: 0,
        itemId: "$_id.item",
        branchId: "$_id.branch",
        itemName: "$itemInfo.name",
        itemCode: "$itemInfo.itemCode",
        branchName: "$branchInfo.name",
        netPrimaryQty: 1,
        netBaseQty: 1,
        totalRevenue: 1,
        factorToBase: { $ifNull: ["$factorToBase", "$itemInfo.factorToBase"] },
        primaryUom: "$itemInfo.primaryUom",
        baseUom: "$itemInfo.baseUom",
      },
    },
    { $sort: { branchName: 1, itemName: 1 } },
  ];

  const rows = await SalesLedger.aggregate(pipeline);

  // Add analytics-safe net qty, base-equivalent qty, and UI-safe display values.
  return rows.map((row) => {
    const factor = toNumber(row.factorToBase) || 1;
    const netPrimaryQty = toNumber(row.netPrimaryQty);
    const netBaseQty = toNumber(row.netBaseQty);
    const qtySoldBaseEq = netBaseQty + netPrimaryQty * factor;
    const displayPrimaryQty = Math.max(0, netPrimaryQty);
    const displayBaseQty = Math.max(0, netBaseQty);
    const primaryLabel = row.primaryUom || "CARTON";
    const baseLabel = row.baseUom || "PC";
    const qtyDisplay = formatQtySplit({ primaryQty: displayPrimaryQty, baseQty: displayBaseQty, primaryLabel, baseLabel });
    return { ...row, netPrimaryQty, netBaseQty, qtySoldBaseEq, displayPrimaryQty, displayBaseQty, qtyDisplay };
  });
}

// Build customer + branch sales summary with nested item-level qty/value breakdown.
async function getSalesSummaryByCustomer({ branch = null, salesRep = null, from = null, to = null } = {}) {
  const match = {};
  if (branch) match.branch = toObjectId(branch);
  if (salesRep) match.salesRep = toObjectId(salesRep);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const pipeline = [
    { $match: match },
    {
      $project: {
        customer: 1,
        branch: 1,
        item: 1,
        transactionType: 1,
        factorToBase: { $ifNull: ["$factorToBase", 1] },
        primaryQty: { $ifNull: ["$primaryQty", 0] },
        baseQty: { $ifNull: ["$baseQty", 0] },
        totalSellingValue: { $ifNull: ["$totalSellingValue", 0] },
        sign: { $switch: { branches: [{ case: { $eq: ["$transactionType", "sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 }, { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 }, { case: { $eq: ["$transactionType", "adj-sales-return"] }, then: -1 }], default: 0 } },
      },
    },
    { $project: { customer: 1, branch: 1, item: 1, factorToBase: 1, netPrimaryQty: { $multiply: ["$primaryQty", "$sign"] }, netBaseQty: { $multiply: ["$baseQty", "$sign"] }, totalValue: { $multiply: ["$totalSellingValue", "$sign"] } } },
    { $group: { _id: { customer: "$customer", branch: "$branch", item: "$item" }, netPrimaryQty: { $sum: "$netPrimaryQty" }, netBaseQty: { $sum: "$netBaseQty" }, totalValue: { $sum: "$totalValue" }, factorToBase: { $first: "$factorToBase" } } },
    { $lookup: { from: "customers", localField: "_id.customer", foreignField: "_id", as: "customerInfo" } },
    { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branchInfo" } },
    { $unwind: "$branchInfo" },
    { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
    { $unwind: { path: "$itemInfo", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        customerId: "$_id.customer",
        branchId: "$_id.branch",
        itemId: "$_id.item",
        customerName: { $ifNull: ["$customerInfo.name", "Unknown Customer"] },
        branchName: "$branchInfo.name",
        itemName: { $ifNull: ["$itemInfo.name", "Unknown Item"] },
        itemCode: "$itemInfo.itemCode",
        primaryUom: "$itemInfo.primaryUom",
        baseUom: "$itemInfo.baseUom",
        factorToBase: 1,
        netPrimaryQty: 1,
        netBaseQty: 1,
        totalValue: 1,
      },
    },
    { $sort: { customerName: 1, itemName: 1 } },
  ];

  const rows = await SalesLedger.aggregate(pipeline);
  const grouped = new Map();

  // Group rows by customer + branch and build nested item summaries.
  for (const row of rows) {
    const factor = toNumber(row.factorToBase) || 1;
    const netPrimaryQty = toNumber(row.netPrimaryQty);
    const netBaseQty = toNumber(row.netBaseQty);
    const totalValue = toNumber(row.totalValue);
    const qtySoldBaseEq = netBaseQty + netPrimaryQty * factor;
    const displayPrimaryQty = Math.max(0, netPrimaryQty);
    const displayBaseQty = Math.max(0, netBaseQty);
    const qtyDisplay = formatQtySplit({ primaryQty: displayPrimaryQty, baseQty: displayBaseQty, primaryLabel: row.primaryUom || "CARTON", baseLabel: row.baseUom || "PC" });
    const key = `${row.customerId || "null"}::${row.branchId || "null"}`;

    if (!grouped.has(key)) grouped.set(key, { customerId: row.customerId || null, branchId: row.branchId || null, customerName: row.customerName || "Unknown Customer", branchName: row.branchName || "Unknown Branch", totalRevenue: 0, itemsSold: [] });

    const customerBucket = grouped.get(key);
    customerBucket.itemsSold.push({ itemId: row.itemId || null, itemName: row.itemName || "Unknown Item", itemCode: row.itemCode || null, qtySoldBaseEq, qtySold: { primaryQty: displayPrimaryQty, baseQty: displayBaseQty, qtyDisplay }, totalValue });
    customerBucket.totalRevenue += totalValue;
  }

  // Sort nested items and customers by descending revenue.
  const result = Array.from(grouped.values()).map((customerRow) => {
    customerRow.itemsSold.sort((a, b) => b.totalValue - a.totalValue);
    return customerRow;
  });
  result.sort((a, b) => b.totalRevenue - a.totalRevenue);

  return result;
}

// Build full sales snapshot with revenue, qty totals, invoices, and summaries.
async function getSalesSnapshot({ branch = null, customer = null, salesRep = null, from = null, to = null } = {}) {
  const match = {};
  if (branch) match.branch = toObjectId(branch);
  if (customer) match.customer = toObjectId(customer);
  if (salesRep) match.salesRep = toObjectId(salesRep);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const mainAgg = await SalesLedger.aggregate([
    { $match: match },
    {
      $project: {
        transactionType: 1,
        grossSellingValue: { $ifNull: ["$grossSellingValue", 0] },
        totalSellingValue: { $ifNull: ["$totalSellingValue", 0] },
        qtyBaseEquivalent: { $add: [{ $ifNull: ["$baseQty", 0] }, { $multiply: [{ $ifNull: ["$primaryQty", 0] }, { $ifNull: ["$factorToBase", 1] }] }] },
        signedPrimaryQty: { $multiply: [{ $ifNull: ["$primaryQty", 0] }, { $switch: { branches: [{ case: { $in: ["$transactionType", ["sale", "adj-sale"]] }, then: 1 }, { case: { $in: ["$transactionType", ["sales-return", "adj-sales-return"]] }, then: -1 }], default: 0 } }] },
        signedBaseQty: { $multiply: [{ $ifNull: ["$baseQty", 0] }, { $switch: { branches: [{ case: { $in: ["$transactionType", ["sale", "adj-sale"]] }, then: 1 }, { case: { $in: ["$transactionType", ["sales-return", "adj-sales-return"]] }, then: -1 }], default: 0 } }] },
      },
    },
    { $group: { _id: "$transactionType", netRevenue: { $sum: "$totalSellingValue" }, grossRevenue: { $sum: "$grossSellingValue" }, totalQty: { $sum: "$qtyBaseEquivalent" }, netPrimaryQty: { $sum: "$signedPrimaryQty" }, netBaseQty: { $sum: "$signedBaseQty" }, docCount: { $sum: 1 } } },
  ]);

  let totalNetRevenue = 0, totalGrossRevenue = 0, totalNetQtyBaseEq = 0, totalNetPrimaryQty = 0, totalNetBaseQty = 0;
  let salesReturnRevenue = 0, saleReversalRevenue = 0, salesReturnReversalRevenue = 0;

  // Combine per-transaction totals into final sales and returns metrics.
  for (const row of mainAgg) {
    const type = row._id, netRevenue = toNumber(row.netRevenue), grossRevenue = toNumber(row.grossRevenue), qtyBaseEq = toNumber(row.totalQty), netPrimaryForType = toNumber(row.netPrimaryQty), netBaseForType = toNumber(row.netBaseQty);

    if (["sale", "adj-sale"].includes(type)) {
      totalGrossRevenue += grossRevenue;
      totalNetRevenue += netRevenue;
      totalNetQtyBaseEq += qtyBaseEq;
      totalNetPrimaryQty += netPrimaryForType;
      totalNetBaseQty += netBaseForType;
    }

    if (["sales-return", "adj-sales-return"].includes(type)) {
      salesReturnRevenue += netRevenue;
      totalGrossRevenue -= grossRevenue;
      totalNetRevenue -= netRevenue;
      totalNetQtyBaseEq -= qtyBaseEq;
      totalNetPrimaryQty += netPrimaryForType;
      totalNetBaseQty += netBaseForType;
    }
  }

  const totalNetReturns = salesReturnRevenue + saleReversalRevenue + salesReturnReversalRevenue;

  const [invoiceIds, customerIds, branchIds] = await Promise.all([SalesLedger.distinct("refId", match), SalesLedger.distinct("customer", match), SalesLedger.distinct("branch", match)]);
  const invoiceCount = invoiceIds.length;
  const customerCount = customerIds.filter(Boolean).length;
  const branchCount = branchIds.length;

  // Build detailed item and customer sales summaries for snapshot consumers.
  const [items, customers] = await Promise.all([getSalesSummaryByItem({ branch, salesRep, from, to }), getSalesSummaryByCustomer({ branch, salesRep, from, to })]);

  // Load invoice statuses using the same ledger-level filters.
  const invoiceMatch = { ...match };
  const allInvoices = await SalesInvoice.find(invoiceMatch, { status: 1 }).lean();

  const invoiceStatus = {
    approved: allInvoices.filter((i) => i.status === "approved").length,
    waiting_for_approval: allInvoices.filter((i) => i.status === "waiting_for_approval").length,
    cancelled: allInvoices.filter((i) => i.status === "cancelled").length,
  };

  // Return consolidated sales snapshot payload.
  return {
    generatedAt: new Date(),
    totalGrossRevenue,
    totalNetRevenue,
    totalNetItems: { itemsCount: items.length, qty: { primaryQty: totalNetPrimaryQty, baseQty: totalNetBaseQty } },
    totalNetReturns,
    customerCount,
    branchCount,
    invoices: { invoiceCount, status: invoiceStatus },
    items,
    customers,
  };
}

module.exports = { postSalesLedger, postSalesReturnLedger, listSalesLedger, getSalesSummaryByItem, getSalesSummaryByCustomer, getSalesSnapshot };