// services/inventory/stockLedger.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");
const StockLedger = require("../../models/ledger/StockLedger.model");
const { formatQtySplit } = require("../../utils/uomDisplay");
const { calcBaseQty, splitToPrimaryBase } = require("../../utils/uomMath");

// Get latest running balance for item + branch (+ optional sales rep stream).
async function getLastBalance(itemId, branchId, salesRepId, session) {
  const query = { item: itemId, branch: new mongoose.Types.ObjectId(branchId) };
  if (salesRepId) query.salesRep = new mongoose.Types.ObjectId(salesRepId);
  const last = await StockLedger.findOne(query).sort({ createdAt: -1, _id: -1 }).session(session).lean();
  return last ? last.runningBalance : 0;
}

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

// Post stock ledger entry with validation and running balance update.
async function postLedger({
  item,
  branch,
  salesRep = null,
  transactionType,
  refModel,
  refId,
  factorToBase,
  primaryQty,
  baseQty,
  avgCostBase = 0,
  avgCostPrimary = 0,
  sellingPriceBase = 0,
  sellingPricePrimary = 0,
  itemTotalValue = 0,
  remarks = "",
  createdBy = null,
  allowNegative = false,
  session = null,
}) {
  if (!item) throw new Error("item is required for ledger post");
  if (!transactionType) throw new Error("transactionType is required");
  if (!refModel || !refId) throw new Error("refModel and refId are required");
  if (!branch) throw new Error("branch is required for ledger post");
  if (factorToBase === undefined || factorToBase === null) throw new Error("factorToBase is required for stock ledger post");

  const directionMap = { purchase: 1, "adj-goods-receive": 1, "sales-return": 1, "adj-sales-return": 1, sale: -1, "adj-sale": -1, "purchase-return": -1, "adj-goods-return": -1 };
  const direction = directionMap[transactionType];
  if (direction === undefined) throw new Error(`Unknown transactionType '${transactionType}' in postLedger`);

  const branchObj = new mongoose.Types.ObjectId(branch);
  const salesRepObj = salesRep ? new mongoose.Types.ObjectId(salesRep) : null;
  const factorNum = toNumber(factorToBase) || 1;
  const primaryQtyNum = Math.abs(toNumber(primaryQty));
  const baseQtyNum = Math.abs(toNumber(baseQty));

  // Compute base-equivalent movement for running balance tracking.
  const qtyBaseEq = calcBaseQty(primaryQtyNum, baseQtyNum, factorNum);

  // Read previous balance from the same item/branch/salesRep stream.
  const prevBal = await getLastBalance(item, branchObj, salesRepObj, session);
  const signedMovement = qtyBaseEq * direction;
  const newBal = prevBal + signedMovement;

  // Block negative stock unless explicitly allowed.
  if (!allowNegative && newBal < 0) throw new Error(`Insufficient stock at branch ${branch}. Current: ${prevBal}, trying to move: ${signedMovement}`);

  const safeAvgCostBase = toNumber(avgCostBase);
  const safeAvgCostPrimary = toNumber(avgCostPrimary);
  const safeSellingPriceBase = toNumber(sellingPriceBase);
  const safeSellingPricePrimary = toNumber(sellingPricePrimary);

  // Derive movement value from qty and average costs when not supplied.
  let movementValue = toNumber(itemTotalValue);
  if (!movementValue) movementValue = baseQtyNum * safeAvgCostBase + primaryQtyNum * safeAvgCostPrimary;

  const [entry] = await StockLedger.create([{
    item,
    branch: branchObj,
    salesRep: salesRepObj,
    transactionType,
    refModel,
    refId,
    factorToBase: factorNum,
    primaryQty: primaryQtyNum,
    baseQty: baseQtyNum,
    avgCostBase: safeAvgCostBase,
    avgCostPrimary: safeAvgCostPrimary,
    sellingPriceBase: safeSellingPriceBase,
    sellingPricePrimary: safeSellingPricePrimary,
    itemTotalValue: movementValue,
    runningBalance: newBal, // Running balance is always stored in base-equivalent units.
    remarks,
    createdBy,
  }], { session });

  return entry.toObject();
}

// Post stock return ledger entry with normalized quantities and movement value.
async function postStockReturnLedger({
  item,
  branch,
  salesRep = null,
  transactionType,
  refModel,
  refId,
  factorToBase,
  primaryQty,
  baseQty,
  avgCostBase = 0,
  avgCostPrimary = 0,
  sellingPriceBase = 0,
  sellingPricePrimary = 0,
  itemTotalValue = 0,
  remarks = "",
  createdBy = null,
  allowNegative = false,
  session = null,
}) {
  if (!item) throw new Error("item is required for stock return ledger");
  if (!branch) throw new Error("branch is required for stock return ledger");
  if (!transactionType) throw new Error("transactionType is required");
  if (!refModel || !refId) throw new Error("refModel and refId are required for stock return ledger");

  const primaryQtyAbs = Math.abs(toNumber(primaryQty));
  const baseQtyAbs = Math.abs(toNumber(baseQty));
  const costBaseNum = toNumber(avgCostBase);
  const costPrimaryNum = toNumber(avgCostPrimary);

  // Recompute movement value when omitted.
  let movementValue = toNumber(itemTotalValue);
  if (!movementValue) movementValue = baseQtyAbs * costBaseNum + primaryQtyAbs * costPrimaryNum;

  return postLedger({ item, branch, salesRep, transactionType, refModel, refId, factorToBase, primaryQty: primaryQtyAbs, baseQty: baseQtyAbs, avgCostBase: costBaseNum, avgCostPrimary: costPrimaryNum, sellingPriceBase, sellingPricePrimary, itemTotalValue: movementValue, remarks, createdBy, allowNegative, session });
}

// Get latest item balance in base-equivalent units.
async function getItemBalance(itemId, branchId = null, salesRepId = null) {
  const query = { item: toObjectId(itemId) };
  if (branchId) query.branch = toObjectId(branchId);
  if (salesRepId) query.salesRep = toObjectId(salesRepId);
  const last = await StockLedger.findOne(query).sort({ createdAt: -1, _id: -1 }).lean();
  return last ? toNumber(last.runningBalance) : 0;
}

// Get stock ledger history with optional branch/salesRep filters and qty display formatting.
async function getItemHistory(itemId, { branch = null, salesRep = null, limit = 100 } = {}) {
  const query = { item: itemId };
  if (branch) query.branch = new mongoose.Types.ObjectId(branch);
  if (salesRep) query.salesRep = new mongoose.Types.ObjectId(salesRep);

  const rows = await StockLedger.find(query).populate("branch", "name branchCode").populate("salesRep", "repCode name").populate("item", "itemCode name primaryUom baseUom factorToBase").sort({ createdAt: -1 }).limit(limit).lean();

  // Add formatted split quantity label for each movement row.
  return rows.map((row) => {
    const primaryLabel = row.item?.primaryUom || "PRIMARY", baseLabel = row.item?.baseUom || "BASE", p = toNumber(row.primaryQty), b = toNumber(row.baseQty);
    const qtyDisplay = formatQtySplit({ primaryQty: p, baseQty: b, primaryLabel, baseLabel });
    return { ...row, qtyDisplay };
  });
}

// Get latest current stock snapshot per item + branch + optional sales rep.
async function getCurrentStock(branchId = null, salesRepId = null) {
  const match = {};
  if (branchId) match.branch = new mongoose.Types.ObjectId(branchId);
  if (salesRepId) match.salesRep = new mongoose.Types.ObjectId(salesRepId);

  const RAW_IN_TYPES = ["purchase", "adj-goods-receive", "sales-return", "adj-sales-return"];
  const NORM_IN_TYPES = ["purchase", "adj-goods-receive", "adj-sales-return"];
  const OUT_TYPES = ["sale", "adj-sale", "purchase-return", "adj-goods-return"];

  // Build conditional quantity sum for a given field and transaction type set.
  const sumQty = (field, types) => ({ $sum: { $cond: [{ $in: ["$transactionType", types] }, { $ifNull: [`$${field}`, 0] }, 0] } });

  const pipeline = [
    { $match: match },
    { $sort: { item: 1, branch: 1, salesRep: 1, createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: { item: "$item", branch: "$branch", salesRep: "$salesRep" },
        runningBalance: { $first: "$runningBalance" },
        avgCostBaseLedger: { $first: "$avgCostBase" },
        avgCostPrimaryLedger: { $first: "$avgCostPrimary" },
        sellingPriceBaseLedger: { $first: "$sellingPriceBase" },
        sellingPricePrimaryLedger: { $first: "$sellingPricePrimary" },
        factorToBaseLedger: { $first: "$factorToBase" },
        inBaseQtyRaw: sumQty("baseQty", RAW_IN_TYPES),
        inPrimaryQtyRaw: sumQty("primaryQty", RAW_IN_TYPES),
        inBaseQtyNorm: sumQty("baseQty", NORM_IN_TYPES),
        inPrimaryQtyNorm: sumQty("primaryQty", NORM_IN_TYPES),
        outBaseQty: sumQty("baseQty", OUT_TYPES),
        outPrimaryQty: sumQty("primaryQty", OUT_TYPES),
      },
    },
    { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branchInfo" } },
    { $unwind: "$branchInfo" },
    { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
    { $unwind: "$itemInfo" },
    {
      $addFields: {
        avgCostBase: { $ifNull: ["$avgCostBaseLedger", "$itemInfo.avgCostBase"] },
        avgCostPrimary: { $ifNull: ["$avgCostPrimaryLedger", "$itemInfo.avgCostPrimary"] },
        sellingPriceBase: { $ifNull: ["$sellingPriceBaseLedger", "$itemInfo.sellingPriceBase"] },
        sellingPricePrimary: { $ifNull: ["$sellingPricePrimaryLedger", "$itemInfo.sellingPricePrimary"] },
        factorToBase: { $ifNull: ["$factorToBaseLedger", "$itemInfo.factorToBase"] },
        primaryUom: "$itemInfo.primaryUom",
        baseUom: "$itemInfo.baseUom",
      },
    },
    {
      $project: {
        _id: 0,
        itemId: "$_id.item",
        branchId: "$_id.branch",
        salesRepId: "$_id.salesRep",
        branchName: "$branchInfo.name",
        itemName: "$itemInfo.name",
        itemCode: "$itemInfo.itemCode",
        reorderLevel: "$itemInfo.reorderLevel",
        runningBalance: 1,
        avgCostBase: 1,
        avgCostPrimary: 1,
        sellingPriceBase: 1,
        sellingPricePrimary: 1,
        factorToBase: 1,
        primaryUom: 1,
        baseUom: 1,
        inBaseQty: "$inBaseQtyRaw",
        inPrimaryQty: "$inPrimaryQtyRaw",
        outBaseQty: 1,
        outPrimaryQty: 1,
        salesReturnBaseQty: { $subtract: ["$inBaseQtyRaw", "$inBaseQtyNorm"] },
        salesReturnPrimaryQty: { $subtract: ["$inPrimaryQtyRaw", "$inPrimaryQtyNorm"] },
        _inBaseQtyNorm: "$inBaseQtyNorm",
        _inPrimaryQtyNorm: "$inPrimaryQtyNorm",
      },
    },
  ];

  const rows = await StockLedger.aggregate(pipeline);

  // Normalize on-hand qty while preserving sales-return split exactly as entered.
  return rows.map((row) => {
    const factor = toNumber(row.factorToBase || 1);
    const totalMovementNormBase = (toNumber(row._inBaseQtyNorm) - toNumber(row.outBaseQty)) + (toNumber(row._inPrimaryQtyNorm) - toNumber(row.outPrimaryQty)) * factor;
    const { primaryQty: movementPrimaryNorm, baseQty: movementBaseNorm } = splitToPrimaryBase(totalMovementNormBase, factor);
    const baseQty = movementBaseNorm + toNumber(row.salesReturnBaseQty), primaryQty = movementPrimaryNorm + toNumber(row.salesReturnPrimaryQty);
    const qtyOnHand = { baseQty, primaryQty };
    const qtyDisplay = formatQtySplit({ primaryQty, baseQty, primaryLabel: row.primaryUom || "PRIMARY", baseLabel: row.baseUom || "BASE" });
    const itemTotalValue = baseQty * toNumber(row.avgCostBase) + primaryQty * toNumber(row.avgCostPrimary);
    const { _inBaseQtyNorm, _inPrimaryQtyNorm, ...cleanRow } = row;
    return { ...cleanRow, qtyOnHand, qtyDisplay, itemTotalValue };
  });
}

// Build full stock snapshot with movement summaries, on-hand, and trend totals.
async function getStockSnapshot({ branch = null, salesRep = null, from = null, to = null } = {}) {
  const match = {};
  if (branch) match.branch = toObjectId(branch);
  if (salesRep) match.salesRep = toObjectId(salesRep);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const INCOMING_TYPES = ["purchase", "adj-goods-receive", "sales-return", "adj-sales-return"];
  const OUTGOING_TYPES = ["sale", "adj-sale", "purchase-return", "adj-goods-return"];
  const PURCHASE_TYPES = ["purchase", "adj-goods-receive"];
  const SALE_TYPES = ["sale", "adj-sale"];
  const RETURN_TYPES = ["sales-return", "purchase-return", "adj-sales-return", "adj-goods-return"];

  // Sum grouped quantities only for matching transaction types.
  const sumQtyByTypes = (field, types) => ({ $sum: { $cond: [{ $in: ["$_id.transactionType", types] }, `$${field}`, 0] } });

  // Normalize split qty from total base-equivalent using factorToBase.
  const normalizeSplitExpr = (primaryField, baseField, factorField) => ({
    $let: {
      vars: { totalBase: { $add: [{ $multiply: [`$${primaryField}`, `$${factorField}`] }, `$${baseField}`] } },
      in: { primaryQty: { $floor: { $divide: ["$$totalBase", `$${factorField}`] } }, baseQty: { $mod: ["$$totalBase", `$${factorField}`] } },
    },
  });

  // Aggregate period totals by transaction type.
  const mainAgg = await StockLedger.aggregate([
    { $match: match },
    { $group: { _id: "$transactionType", baseQty: { $sum: { $ifNull: ["$baseQty", 0] } }, primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } }, docCount: { $sum: 1 } } },
  ]);

  let totalReceivedQty = { baseQty: 0, primaryQty: 0 }, totalIssuedQty = { baseQty: 0, primaryQty: 0 };

  // Split movement totals into incoming vs outgoing buckets.
  for (const row of mainAgg) {
    const type = row._id, base = toNumber(row.baseQty), primary = toNumber(row.primaryQty);
    if (INCOMING_TYPES.includes(type)) {
      totalReceivedQty.baseQty += base;
      totalReceivedQty.primaryQty += primary;
    } else if (OUTGOING_TYPES.includes(type)) {
      totalIssuedQty.baseQty += base;
      totalIssuedQty.primaryQty += primary;
    } else logger.warn("Unmapped transactionType detected in snapshot", { type });
  }

  // Collect distinct period item and branch ids.
  const [periodItemIds, periodBranchIds] = await Promise.all([StockLedger.distinct("item", match), StockLedger.distinct("branch", match)]);

  // Aggregate item+branch movement breakdown with purchases, sales, returns, and net qty.
  const itemsMovementAgg = await StockLedger.aggregate([
    { $match: match },
    { $group: { _id: { item: "$item", branch: "$branch", transactionType: "$transactionType" }, baseQty: { $sum: { $ifNull: ["$baseQty", 0] } }, primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } } } },
    { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
    { $unwind: "$itemInfo" },
    { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branchInfo" } },
    { $unwind: "$branchInfo" },
    {
      $group: {
        _id: { item: "$_id.item", branch: "$_id.branch" },
        itemName: { $first: "$itemInfo.name" },
        itemCode: { $first: "$itemInfo.itemCode" },
        branchName: { $first: "$branchInfo.name" },
        factorToBase: { $first: "$itemInfo.factorToBase" },
        primaryUom: { $first: "$itemInfo.primaryUom" },
        baseUom: { $first: "$itemInfo.baseUom" },
        purchasesBaseQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["purchase", "adj-goods-receive"]] }, "$baseQty", 0] } },
        purchasesPrimaryQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["purchase", "adj-goods-receive"]] }, "$primaryQty", 0] } },
        salesBaseQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["sale", "adj-sale"]] }, "$baseQty", 0] } },
        salesPrimaryQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["sale", "adj-sale"]] }, "$primaryQty", 0] } },
        returnsBaseQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["sales-return", "purchase-return", "adj-sales-return", "adj-goods-return"]] }, "$baseQty", 0] } },
        returnsPrimaryQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["sales-return", "purchase-return", "adj-sales-return", "adj-goods-return"]] }, "$primaryQty", 0] } },
        inBaseQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["purchase", "adj-goods-receive", "sales-return", "adj-sales-return"]] }, "$baseQty", 0] } },
        inPrimaryQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["purchase", "adj-goods-receive", "sales-return", "adj-sales-return"]] }, "$primaryQty", 0] } },
        outBaseQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["sale", "adj-sale", "purchase-return", "adj-goods-return"]] }, "$baseQty", 0] } },
        outPrimaryQty: { $sum: { $cond: [{ $in: ["$_id.transactionType", ["sale", "adj-sale", "purchase-return", "adj-goods-return"]] }, "$primaryQty", 0] } },
      },
    },
    {
      $addFields: {
        purchases: { baseQty: "$purchasesBaseQty", primaryQty: "$purchasesPrimaryQty" },
        sales: { baseQty: "$salesBaseQty", primaryQty: "$salesPrimaryQty" },
        returns: { baseQty: "$returnsBaseQty", primaryQty: "$returnsPrimaryQty" },
        _salesNormalized: {
          $let: {
            vars: { totalBase: { $add: [{ $multiply: ["$salesPrimaryQty", "$factorToBase"] }, "$salesBaseQty"] } },
            in: { primaryQty: { $floor: { $divide: ["$$totalBase", "$factorToBase"] } }, baseQty: { $mod: ["$$totalBase", "$factorToBase"] } },
          },
        },
      },
    },
    { $addFields: { netQty: { baseQty: { $subtract: ["$inBaseQty", "$_salesNormalized.baseQty"] }, primaryQty: { $subtract: ["$inPrimaryQty", "$_salesNormalized.primaryQty"] } } } },
    { $project: { _id: 0, itemId: "$_id.item", branchId: "$_id.branch", itemName: 1, itemCode: 1, branchName: 1, factorToBase: 1, primaryUom: 1, baseUom: 1, purchases: 1, sales: 1, returns: 1, netQty: 1 } },
    { $sort: { itemName: 1, branchName: 1 } },
  ]);

  // Aggregate branch-level movement totals across all items.
  const branchesMovementAgg = await StockLedger.aggregate([
    { $match: match },
    { $group: { _id: { branch: "$branch", item: "$item", transactionType: "$transactionType" }, baseQty: { $sum: { $ifNull: ["$baseQty", 0] } }, primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } }, docCount: { $sum: 1 } } },
    { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
    { $unwind: "$itemInfo" },
    {
      $group: {
        _id: { branch: "$_id.branch", item: "$_id.item" },
        factorToBase: { $first: "$itemInfo.factorToBase" },
        docCount: { $sum: "$docCount" },
        purchasesBaseQty: sumQtyByTypes("baseQty", PURCHASE_TYPES),
        purchasesPrimaryQty: sumQtyByTypes("primaryQty", PURCHASE_TYPES),
        salesBaseQty: sumQtyByTypes("baseQty", SALE_TYPES),
        salesPrimaryQty: sumQtyByTypes("primaryQty", SALE_TYPES),
        returnsBaseQty: sumQtyByTypes("baseQty", RETURN_TYPES),
        returnsPrimaryQty: sumQtyByTypes("primaryQty", RETURN_TYPES),
      },
    },
    { $addFields: { normalizedSales: normalizeSplitExpr("salesPrimaryQty", "salesBaseQty", "factorToBase"), inBaseQty: { $add: ["$purchasesBaseQty", "$returnsBaseQty"] }, inPrimaryQty: { $add: ["$purchasesPrimaryQty", "$returnsPrimaryQty"] } } },
    { $addFields: { outBaseQty: "$normalizedSales.baseQty", outPrimaryQty: "$normalizedSales.primaryQty" } },
    {
      $group: {
        _id: "$_id.branch",
        docCount: { $sum: "$docCount" },
        purchasesBaseQty: { $sum: "$purchasesBaseQty" },
        purchasesPrimaryQty: { $sum: "$purchasesPrimaryQty" },
        salesBaseQty: { $sum: "$salesBaseQty" },
        salesPrimaryQty: { $sum: "$salesPrimaryQty" },
        returnsBaseQty: { $sum: "$returnsBaseQty" },
        returnsPrimaryQty: { $sum: "$returnsPrimaryQty" },
        inBaseQty: { $sum: "$inBaseQty" },
        inPrimaryQty: { $sum: "$inPrimaryQty" },
        outBaseQty: { $sum: "$outBaseQty" },
        outPrimaryQty: { $sum: "$outPrimaryQty" },
      },
    },
    { $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "branchInfo" } },
    { $unwind: "$branchInfo" },
    {
      $project: {
        _id: 0,
        branchId: "$_id",
        branchName: "$branchInfo.name",
        docCount: 1,
        purchases: { baseQty: "$purchasesBaseQty", primaryQty: "$purchasesPrimaryQty" },
        sales: { baseQty: "$salesBaseQty", primaryQty: "$salesPrimaryQty" },
        returns: { baseQty: "$returnsBaseQty", primaryQty: "$returnsPrimaryQty" },
        netQty: { baseQty: { $subtract: ["$inBaseQty", "$outBaseQty"] }, primaryQty: { $subtract: ["$inPrimaryQty", "$outPrimaryQty"] } },
      },
    },
    { $sort: { branchName: 1 } },
  ]);

  // Compute on-hand canonical balances from latest current stock snapshot.
  const onHandRows = await getCurrentStock(branch ? toObjectId(branch) : null, salesRep ? toObjectId(salesRep) : null);

  const onHandItemBranchMap = new Map(), branchOnHandMap = new Map();
  let onHandQty = { baseQty: 0, primaryQty: 0 }, onHandStockValue = 0;
  const onHandItemIds = new Set(), onHandBranchIds = new Set();

  // Roll up on-hand qty/value and cache canonical item/branch balances.
  for (const row of onHandRows) {
    const itemIdStr = String(row.itemId), branchIdStr = String(row.branchId), baseQty = toNumber(row.qtyOnHand?.baseQty), primaryQty = toNumber(row.qtyOnHand?.primaryQty);
    onHandQty.baseQty += baseQty;
    onHandQty.primaryQty += primaryQty;
    onHandStockValue += toNumber(row.itemTotalValue);
    onHandItemIds.add(itemIdStr);
    onHandBranchIds.add(branchIdStr);
    onHandItemBranchMap.set(`${itemIdStr}::${branchIdStr}`, { baseQty, primaryQty });
    const branchAccum = branchOnHandMap.get(branchIdStr) || { baseQty: 0, primaryQty: 0 };
    branchAccum.baseQty += baseQty;
    branchAccum.primaryQty += primaryQty;
    branchOnHandMap.set(branchIdStr, branchAccum);
  }

  // Aggregate raw totals by transaction type for reporting.
  const transactionTypeTotalsAgg = await StockLedger.aggregate([
    { $match: match },
    { $group: { _id: "$transactionType", baseQty: { $sum: { $ifNull: ["$baseQty", 0] } }, primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } } } },
    { $project: { _id: 0, transactionType: "$_id", baseQty: 1, primaryQty: 1 } },
  ]);

  const transactionTypeTotals = Object.fromEntries(transactionTypeTotalsAgg.map((r) => [r.transactionType, { baseQty: toNumber(r.baseQty), primaryQty: toNumber(r.primaryQty) }]));

  // Replace net qty with canonical on-hand values and add display fields.
  const itemsMovement = itemsMovementAgg.map((row) => {
    const key = `${String(row.itemId)}::${String(row.branchId)}`, canonical = onHandItemBranchMap.get(key);
    const finalRow = canonical ? { ...row, netQty: { baseQty: canonical.baseQty, primaryQty: canonical.primaryQty } } : row;
    const primaryLabel = finalRow.primaryUom || "PRIMARY", baseLabel = finalRow.baseUom || "BASE";

    return {
      ...finalRow,
      purchasesDisplay: formatQtySplit({ primaryQty: toNumber(finalRow.purchases?.primaryQty), baseQty: toNumber(finalRow.purchases?.baseQty), primaryLabel, baseLabel }),
      salesDisplay: formatQtySplit({ primaryQty: toNumber(finalRow.sales?.primaryQty), baseQty: toNumber(finalRow.sales?.baseQty), primaryLabel, baseLabel }),
      returnsDisplay: formatQtySplit({ primaryQty: toNumber(finalRow.returns?.primaryQty), baseQty: toNumber(finalRow.returns?.baseQty), primaryLabel, baseLabel }),
      netQtyDisplay: formatQtySplit({ primaryQty: toNumber(finalRow.netQty?.primaryQty), baseQty: toNumber(finalRow.netQty?.baseQty), primaryLabel, baseLabel }),
    };
  });

  // Replace branch net qty with canonical on-hand branch balances.
  const branchesMovement = branchesMovementAgg.map((row) => {
    const canonical = branchOnHandMap.get(String(row.branchId));
    return canonical ? { ...row, netQty: { ...canonical } } : row;
  });

  // Return consolidated stock snapshot payload.
  return {
    generatedAt: new Date(),
    netMovementQty: {
      ...onHandQty,
      totalItemCount: onHandItemIds.size,
    },
    totalReceivedQty: {
      ...totalReceivedQty,
      totalItemCount: periodItemIds.length,
    },
    totalIssuedQty: {
      ...totalIssuedQty,
      totalItemCount: periodItemIds.length,
    },
    periodItemCount: periodItemIds.length,
    periodBranchCount: periodBranchIds.length,
    onHand: {
      qty: onHandQty, 
      stockValue: onHandStockValue, 
      itemCount: onHandItemIds.size,
      branchCount: onHandBranchIds.size,
    },
    itemsMovement,
    branchesMovement,
    transactionTypeTotals,
    orderingFields: ["itemName", "branchName"],
  };
}

// Compute stock status using on-hand base-equivalent qty and reorder level.
async function computeStockStatus(itemObj, branchId = null, salesRepId = null) {
  if (!itemObj?._id) throw new Error("computeStockStatus: item object with _id is required");
  const qtyOnHandBaseEq = await getItemBalance(itemObj._id, branchId, salesRepId), reorderLevel = toNumber(itemObj.reorderLevel);
  let stockStatus = "in_stock";
  if (qtyOnHandBaseEq <= 0) stockStatus = "out_of_stock";
  else if (qtyOnHandBaseEq <= reorderLevel) stockStatus = "low_stock";
  return { qtyOnHand: qtyOnHandBaseEq, stockStatus };
}

module.exports = { postLedger, postStockReturnLedger, getItemBalance, getItemHistory, getCurrentStock, getStockSnapshot, computeStockStatus };