// services/inventory/stockLedger.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");

const StockLedger = require("../../models/ledger/StockLedger.model");

// UOM helpers
const { formatQtySplit } = require("../../utils/uomDisplay");
const { calcBaseQty, splitToPrimaryBase } = require("../../utils/uomMath");

//-------------------- [ getLastBalance(): Get Latest Stock Balance for an Item & Branch & SalesRep ] ----------------------
async function getLastBalance(itemId, branchId, salesRepId, session) {
  const query = {
    item: itemId,
    branch: new mongoose.Types.ObjectId(branchId),
  };

  // ✅ per-salesRep stream
  if (salesRepId) query.salesRep = new mongoose.Types.ObjectId(salesRepId);

  const last = await StockLedger.findOne(query)
    .sort({ createdAt: -1, _id: -1 })
    .session(session)
    .lean();

  return last ? last.runningBalance : 0;
}

//-------------------- [ Utility: Convert value to MongoDB ObjectId ] ----------------------
function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

//-------------------- [ Utility: Convert value to number safely ] ----------------------
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

//-------------------- [ postLedger(): Create a Stock Ledger Entry with Validation ] ----------------------
async function postLedger({
  item,
  branch,
  salesRep = null,
  transactionType,
  refModel,
  refId,

  // multi-UOM
  factorToBase,
  primaryQty,
  baseQty,

  // costs/prices
  avgCostBase = 0,
  avgCostPrimary = 0,
  sellingPriceBase = 0,
  sellingPricePrimary = 0,

  // value
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
  if (factorToBase === undefined || factorToBase === null) {
    throw new Error("factorToBase is required for stock ledger post");
  }

  const directionMap = {
    purchase: 1,
    "adj-goods-receive": 1,
    "sales-return": 1,
    "adj-sales-return": 1,
    sale: -1,
    "adj-sale": -1,
    "purchase-return": -1,
    "adj-goods-return": -1,
  };

  const direction = directionMap[transactionType];
  if (direction === undefined)
    throw new Error(
      `Unknown transactionType '${transactionType}' in postLedger`
    );

  const branchObj = new mongoose.Types.ObjectId(branch);
  const salesRepObj = salesRep ? new mongoose.Types.ObjectId(salesRep) : null;

  const factorNum = toNumber(factorToBase) || 1;
  const primaryQtyNum = Math.abs(toNumber(primaryQty));
  const baseQtyNum = Math.abs(toNumber(baseQty));

  // ✅ base-equivalent movement (NOT stored, only used for runningBalance)
  const qtyBaseEq = calcBaseQty(primaryQtyNum, baseQtyNum, factorNum);

  // previous balance (per item+branch+salesRep)
  const prevBal = await getLastBalance(item, branchObj, salesRepObj, session);

  const signedMovement = qtyBaseEq * direction;
  const newBal = prevBal + signedMovement;

  if (!allowNegative && newBal < 0) {
    throw new Error(
      `Insufficient stock at branch ${branch}. Current: ${prevBal}, trying to move: ${signedMovement}`
    );
  }

  const safeAvgCostBase = toNumber(avgCostBase);
  const safeAvgCostPrimary = toNumber(avgCostPrimary);
  const safeSellingPriceBase = toNumber(sellingPriceBase);
  const safeSellingPricePrimary = toNumber(sellingPricePrimary);

  let movementValue = toNumber(itemTotalValue);
  if (!movementValue) {
    movementValue =
      baseQtyNum * safeAvgCostBase + primaryQtyNum * safeAvgCostPrimary;
  }

  const [entry] = await StockLedger.create(
    [
      {
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

        // ✅ runningBalance is ALWAYS base-equivalent
        runningBalance: newBal,
        remarks,
        createdBy,
      },
    ],
    { session }
  );

  return entry.toObject();
}

//-------------------- [ postStockReturnLedger(): Post a Stock Return Entry ] ----------------------
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
  if (!refModel || !refId)
    throw new Error(
      "refModel and refId are required for stock return ledger"
    );

  const primaryQtyAbs = Math.abs(toNumber(primaryQty));
  const baseQtyAbs = Math.abs(toNumber(baseQty));
  const costBaseNum = toNumber(avgCostBase);
  const costPrimaryNum = toNumber(avgCostPrimary);

  let movementValue = toNumber(itemTotalValue);
  if (!movementValue) {
    movementValue =
      baseQtyAbs * costBaseNum + primaryQtyAbs * costPrimaryNum;
  }

  return postLedger({
    item,
    branch,
    salesRep,
    transactionType,
    refModel,
    refId,
    factorToBase,
    primaryQty: primaryQtyAbs,
    baseQty: baseQtyAbs,
    avgCostBase: costBaseNum,
    avgCostPrimary: costPrimaryNum,
    sellingPriceBase,
    sellingPricePrimary,
    itemTotalValue: movementValue,
    remarks,
    createdBy,
    allowNegative,
    session,
  });
}

//-------------------- [ getItemBalance(): Latest Balance (base-equivalent) ] ----------------------
async function getItemBalance(itemId, branchId = null, salesRepId = null) {
  const query = { item: toObjectId(itemId) };
  if (branchId) query.branch = toObjectId(branchId);
  if (salesRepId) query.salesRep = toObjectId(salesRepId);

  const last = await StockLedger.findOne(query)
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  // ✅ return base-equivalent runningBalance (number)
  return last ? toNumber(last.runningBalance) : 0;
}

//-------------------- [ getItemHistory(): Stock Ledger History (SalesRep optional) ] ----------------------
async function getItemHistory(
  itemId,
  { branch = null, salesRep = null, limit = 100 } = {}
) {
  const query = { item: itemId };
  if (branch) query.branch = new mongoose.Types.ObjectId(branch);
  if (salesRep) query.salesRep = new mongoose.Types.ObjectId(salesRep);

  const rows = await StockLedger.find(query)
    .populate("branch", "name branchCode")
    .populate("salesRep", "repCode name")
    .populate("item", "itemCode name primaryUom baseUom factorToBase")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Add qtyDisplay per movement using primaryQty/baseQty
  return rows.map((row) => {
    const primaryLabel = row.item?.primaryUom || "PRIMARY";
    const baseLabel = row.item?.baseUom || "BASE";

    const p = toNumber(row.primaryQty);
    const b = toNumber(row.baseQty);

    const qtyDisplay = formatQtySplit({
      primaryQty: p,
      baseQty: b,
      primaryLabel,
      baseLabel,
    });

    return {
      ...row,
      qtyDisplay,
    };
  });
}

//-------------------- [ getCurrentStock(): Latest Stock per (item, branch, salesRep) ] ----------------------
async function getCurrentStock(branchId = null, salesRepId = null) {
  const match = {};
  if (branchId) match.branch = new mongoose.Types.ObjectId(branchId);
  if (salesRepId) match.salesRep = new mongoose.Types.ObjectId(salesRepId);

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

        // RAW movement (exact, sales-return included)
        inBaseQtyRaw: {
          $sum: {
            $cond: [
              { $in: ["$transactionType", ["purchase", "adj-goods-receive", "sales-return", "adj-sales-return"]] },
              "$baseQty",
              0,
            ],
          },
        },
        inPrimaryQtyRaw: {
          $sum: {
            $cond: [
              { $in: ["$transactionType", ["purchase", "adj-goods-receive", "sales-return", "adj-sales-return"]] },
              "$primaryQty",
              0,
            ],
          },
        },

        // Normalized movement (exclude sales-return)
        inBaseQtyNorm: {
          $sum: {
            $cond: [
              { $in: ["$transactionType", ["purchase", "adj-goods-receive", "adj-sales-return"]] },
              "$baseQty",
              0,
            ],
          },
        },
        inPrimaryQtyNorm: {
          $sum: {
            $cond: [
              { $in: ["$transactionType", ["purchase", "adj-goods-receive", "adj-sales-return"]] },
              "$primaryQty",
              0,
            ],
          },
        },

        outBaseQty: {
          $sum: {
            $cond: [
              { $in: ["$transactionType", ["sale", "adj-sale", "purchase-return", "adj-goods-return"]] },
              "$baseQty",
              0,
            ],
          },
        },
        outPrimaryQty: {
          $sum: {
            $cond: [
              { $in: ["$transactionType", ["sale", "adj-sale", "purchase-return", "adj-goods-return"]] },
              "$primaryQty",
              0,
            ],
          },
        },
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
        inBaseQtyRaw: 1,
        inPrimaryQtyRaw: 1,
        inBaseQtyNorm: 1,
        inPrimaryQtyNorm: 1,
        outBaseQty: 1,
        outPrimaryQty: 1,
      },
    },
  ];

  const rows = await StockLedger.aggregate(pipeline);

  return rows.map((row) => {
  const factor = toNumber(row.factorToBase || 1);

  // ---- RAW + normalized movement combined ----
  const inBaseNorm = toNumber(row.inBaseQtyNorm || 0);
  const inPrimaryNorm = toNumber(row.inPrimaryQtyNorm || 0);
  const outBase = toNumber(row.outBaseQty || 0);
  const outPrimary = toNumber(row.outPrimaryQty || 0);

  const totalMovementNormBase = inBaseNorm - outBase + (inPrimaryNorm - outPrimary) * factor;
  const { primaryQty: movementPrimaryNorm, baseQty: movementBaseNorm } =
    splitToPrimaryBase(totalMovementNormBase, factor);

  const salesReturnBase = toNumber(row.inBaseQtyRaw || 0) - inBaseNorm;
  const salesReturnPrimary = toNumber(row.inPrimaryQtyRaw || 0) - inPrimaryNorm;

  // exact totals
  const baseQty = movementBaseNorm + salesReturnBase;
  const primaryQty = movementPrimaryNorm + salesReturnPrimary;

  const qtyOnHand = { baseQty, primaryQty };
  const qtyOnHandRaw = { ...qtyOnHand }; // same as qtyOnHand

  const qtyDisplay = formatQtySplit({
    primaryQty,
    baseQty,
    primaryLabel: row.primaryUom || "PRIMARY",
    baseLabel: row.baseUom || "BASE",
  });

  const qtyDisplayRaw = qtyDisplay; // same as qtyDisplay

  const itemTotalValue =
    baseQty * toNumber(row.avgCostBase) + primaryQty * toNumber(row.avgCostPrimary);

  return {
    ...row,
    qtyOnHand,
    qtyOnHandRaw,
    qtyDisplay,
    qtyDisplayRaw,
    itemTotalValue,
  };
});
}


//-------------------- [ getStockSnapshot(): FULL Snapshot (SalesRep optional) ] ----------------------
async function getStockSnapshot({
  branch = null,
  salesRep = null,
  from = null,
  to = null,
} = {}) {
  const match = {};
  if (branch) match.branch = toObjectId(branch);
  if (salesRep) match.salesRep = toObjectId(salesRep);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  // ---------- 1) Movement totals by transactionType ----------
  const mainAgg = await StockLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$transactionType",
        baseQty: { $sum: { $ifNull: ["$baseQty", 0] } },
        primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } },
        docCount: { $sum: 1 },
      },
    },
  ]);

  let totalReceivedQty = { baseQty: 0, primaryQty: 0 };
  let totalIssuedQty = { baseQty: 0, primaryQty: 0 };

  const incomingTypes = [
    "purchase",
    "adj-goods-receive",
    "sales-return",
    "adj-sales-return",
  ];
  const outgoingTypes = [
    "sale",
    "adj-sale",
    "purchase-return",
    "adj-goods-return",
  ];

  for (const row of mainAgg) {
    const type = row._id;
    const base = toNumber(row.baseQty || 0);
    const primary = toNumber(row.primaryQty || 0);

    if (incomingTypes.includes(type)) {
      totalReceivedQty.baseQty += base;
      totalReceivedQty.primaryQty += primary;
    } else if (outgoingTypes.includes(type)) {
      totalIssuedQty.baseQty += base;
      totalIssuedQty.primaryQty += primary;
    } else {
      console.warn("⚠️ Unmapped transactionType detected in snapshot:", type);
    }
  }

  // ---------- 2) Period distinct items & branches ----------
  const [periodItemIds, periodBranchIds] = await Promise.all([
    StockLedger.distinct("item", match),
    StockLedger.distinct("branch", match),
  ]);

  const periodItemCount = periodItemIds.length;
  const periodBranchCount = periodBranchIds.length;

  const itemsMovementAgg = await StockLedger.aggregate([
    { $match: match },

    {
      $group: {
        _id: { item: "$item", branch: "$branch", transactionType: "$transactionType" },
        baseQty: { $sum: { $ifNull: ["$baseQty", 0] } },
        primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } },
      },
    },

    { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
    { $unwind: "$itemInfo" },
    { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branchInfo" } },
    { $unwind: "$branchInfo" },

    {
      $group: {
        _id: "$_id.item",
        branchId: { $first: "$_id.branch" },
        itemName: { $first: "$itemInfo.name" },
        itemCode: { $first: "$itemInfo.itemCode" },
        branchName: { $first: "$branchInfo.name" },
        factorToBase: { $first: "$itemInfo.factorToBase" },
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
        purchases: { baseQty: "$purchasesBaseQty", primaryQty: "$purchasesPrimaryQty"},
        sales: { baseQty: "$salesBaseQty", primaryQty: "$salesPrimaryQty"},
        returns: { baseQty: "$returnsBaseQty", primaryQty: "$returnsPrimaryQty"},

        // TEMP normalized sales for netQty calculation
        _salesNormalized: {
          $let: {
            vars: { totalBase: { $add: [ { $multiply: ["$salesPrimaryQty", "$factorToBase"] }, "$salesBaseQty" ]}},
            in: { primaryQty: { $floor: { $divide: ["$$totalBase", "$factorToBase"] } }, baseQty: { $mod: ["$$totalBase", "$factorToBase"] } }
          }
        }
      }
    },
    {
      $addFields: {
        netQty: {
          baseQty: { $subtract: ["$inBaseQty", "$_salesNormalized.baseQty"] },
          primaryQty: { $subtract: ["$inPrimaryQty", "$_salesNormalized.primaryQty"] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        itemId: "$_id",
        branchId: 1,
        itemName: 1,
        itemCode: 1,
        branchName: 1,
        factorToBase: 1,
        purchases: 1,
        sales: 1,
        returns: 1,
        netQty: 1
      }
    },
    { $sort: { itemName: 1, branchName: 1 } }
  ]);


  const branchesMovementAgg = await StockLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          branch: "$branch",
          item: "$item",
          transactionType: "$transactionType"
        },
        baseQty: { $sum: { $ifNull: ["$baseQty", 0] } },
        primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } },
        docCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "items",
        localField: "_id.item",
        foreignField: "_id",
        as: "itemInfo"
      }
    },
    { $unwind: "$itemInfo" },
    {
      $group: {
        _id: {
          branch: "$_id.branch",
          item: "$_id.item"
        },
        factorToBase: { $first: "$itemInfo.factorToBase" },
        docCount: { $sum: "$docCount" },
        purchasesBaseQty: { $sum: { $cond: [ { $in: ["$_id.transactionType", ["purchase", "adj-goods-receive"]] }, "$baseQty", 0 ]}},
        purchasesPrimaryQty: { $sum: { $cond: [ { $in: ["$_id.transactionType", ["purchase", "adj-goods-receive"]] }, "$primaryQty", 0 ]}},
        salesBaseQty: { $sum: { $cond: [ { $in: ["$_id.transactionType", ["sale", "adj-sale"]] }, "$baseQty", 0 ]}},
        salesPrimaryQty: { $sum: { $cond: [ { $in: ["$_id.transactionType", ["sale", "adj-sale"]] }, "$primaryQty", 0 ]}},
        returnsBaseQty: {  $sum: { $cond: [ { $in: [ "$_id.transactionType", ["sales-return", "purchase-return", "adj-sales-return", "adj-goods-return"]]}, "$baseQty", 0 ]}},
        returnsPrimaryQty: { $sum: { $cond: [ { $in: [ "$_id.transactionType", ["sales-return", "purchase-return", "adj-sales-return", "adj-goods-return"]]}, "$primaryQty", 0 ]}}
      }
    },
    {
      $addFields: {
        normalizedSales: {
          $let: {
            vars: { totalBase: { $add: [ { $multiply: ["$salesPrimaryQty", "$factorToBase"] }, "$salesBaseQty" ]}},
            in: { primaryQty: { $floor: { $divide: ["$$totalBase", "$factorToBase"] }}, baseQty: { $mod: ["$$totalBase", "$factorToBase"] }}
          }
        }
      }
    },
    {
      $addFields: { 
        inBaseQty: { $add: ["$purchasesBaseQty", "$returnsBaseQty"] },
        inPrimaryQty: { $add: ["$purchasesPrimaryQty", "$returnsPrimaryQty"] },
        outBaseQty: "$normalizedSales.baseQty",
        outPrimaryQty: "$normalizedSales.primaryQty"
      }
    },
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
        outPrimaryQty: { $sum: "$outPrimaryQty" }
      }
    },
    {
      $lookup: {
        from: "branches",
        localField: "_id",
        foreignField: "_id",
        as: "branchInfo"
      }
    },
    { $unwind: "$branchInfo" },
    {
      $addFields: {
        netBaseQty: { $subtract: ["$inBaseQty", "$outBaseQty"] },
        netPrimaryQty: { $subtract: ["$inPrimaryQty", "$outPrimaryQty"] }
      }
    },
    {
      $project: {
        _id: 0,
        branchId: "$_id",
        branchName: "$branchInfo.name",
        docCount: 1,
        purchases: { baseQty: "$purchasesBaseQty", primaryQty: "$purchasesPrimaryQty" },
        sales: { baseQty: "$salesBaseQty", primaryQty: "$salesPrimaryQty" },
        returns: { baseQty: "$returnsBaseQty", primaryQty: "$returnsPrimaryQty" },
        netQty: { baseQty: "$netBaseQty", primaryQty: "$netPrimaryQty" }
      }
    },

    { $sort: { branchName: 1 } }
  ]);


  // ---------- 5) On-hand (current) from getCurrentStock (using RAW mix where possible) ----------
  const onHandRows = await getCurrentStock(
    branch ? toObjectId(branch) : null,
    salesRep ? toObjectId(salesRep) : null
  );

  // Build maps for quick lookup
  const onHandItemBranchMap = new Map(); // key: itemId::branchId -> { baseQty, primaryQty }  (RAW mix preferred)
  const branchOnHandMap = new Map(); // key: branchId -> { baseQty, primaryQty }

  let onHandQty = { baseQty: 0, primaryQty: 0 };
  let onHandStockValue = 0;
  const onHandItemIds = new Set();
  const onHandBranchIds = new Set();

  for (const row of onHandRows) {
    const itemIdStr = String(row.itemId);
    const branchIdStr = String(row.branchId);

    // Prefer RAW "as-moved" mix (qtyOnHandRaw) so open boxes never magically reseal.
    const baseQty = toNumber(
      row.qtyOnHandRaw?.baseQty ??
        row.qtyOnHand?.baseQty ??
        0
    );
    const primaryQty = toNumber(
      row.qtyOnHandRaw?.primaryQty ??
        row.qtyOnHand?.primaryQty ??
        0
    );

    onHandQty.baseQty += baseQty;
    onHandQty.primaryQty += primaryQty;

    onHandStockValue += toNumber(row.itemTotalValue);
    onHandItemIds.add(itemIdStr);
    onHandBranchIds.add(branchIdStr);

    const key = `${itemIdStr}::${branchIdStr}`;
    onHandItemBranchMap.set(key, { baseQty, primaryQty });

    const existing =
      branchOnHandMap.get(branchIdStr) || { baseQty: 0, primaryQty: 0 };
    existing.baseQty += baseQty;
    existing.primaryQty += primaryQty;
    branchOnHandMap.set(branchIdStr, existing);
  }

  const onHandItemCount = onHandItemIds.size;
  const onHandBranchCount = onHandBranchIds.size;

  // Canonical net movement = sum of on-hand (in raw mix units)
  const netMovementQty = {
    baseQty: onHandQty.baseQty,
    primaryQty: onHandQty.primaryQty,
  };

  // ---------- 6) transactionTypeTotals ----------
  const transactionTypeTotalsAgg = await StockLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$transactionType",
        baseQty: { $sum: { $ifNull: ["$baseQty", 0] } },
        primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        transactionType: "$_id",
        baseQty: 1,
        primaryQty: 1,
      },
    },
  ]);

  const transactionTypeTotals = {};
  for (const row of transactionTypeTotalsAgg) {
    transactionTypeTotals[row.transactionType] = {
      baseQty: toNumber(row.baseQty),
      primaryQty: toNumber(row.primaryQty),
    };
  }

 // ---------- 7) itemMovementPivot (movement pivot by item+branch) ----------
const itemMovementPivotAgg = await StockLedger.aggregate([
  { $match: match },

  // Step 1: Group by item+branch+transactionType to sum base and primary quantities
  {
    $group: {
      _id: { item: "$item", branch: "$branch", transactionType: "$transactionType" },
      baseQty: { $sum: { $ifNull: ["$baseQty", 0] } },
      primaryQty: { $sum: { $ifNull: ["$primaryQty", 0] } },
    },
  },

  // Step 2: Join item and branch info
  { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
  { $unwind: "$itemInfo" },
  { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branchInfo" } },
  { $unwind: "$branchInfo" },

  // Step 3: Aggregate per item+branch using simplified sums
  {
    $group: {
      _id: { item: "$_id.item", branch: "$_id.branch" },
      itemName: { $first: "$itemInfo.name" },
      itemCode: { $first: "$itemInfo.itemCode" },
      branchName: { $first: "$branchInfo.name" },
      factorToBase: { $first: "$itemInfo.factorToBase" },

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

  // Step 4: Prepare nested structures and normalize sales for netQty
  {
    $addFields: {
      purchases: { baseQty: "$purchasesBaseQty", primaryQty: "$purchasesPrimaryQty" },
      sales: { baseQty: "$salesBaseQty", primaryQty: "$salesPrimaryQty" },
      returns: { baseQty: "$returnsBaseQty", primaryQty: "$returnsPrimaryQty" },

      _salesNormalized: {
        $let: {
          vars: { totalBase: { $add: [ { $multiply: ["$salesPrimaryQty", "$factorToBase"] }, "$salesBaseQty" ] } },
          in: { 
            primaryQty: { $floor: { $divide: ["$$totalBase", "$factorToBase"] } }, 
            baseQty: { $mod: ["$$totalBase", "$factorToBase"] } 
          }
        }
      }
    }
  },

  // Step 5: Calculate netQty
  {
    $addFields: {
      netQty: {
        baseQty: { $subtract: ["$inBaseQty", "$_salesNormalized.baseQty"] },
        primaryQty: { $subtract: ["$inPrimaryQty", "$_salesNormalized.primaryQty"] }
      }
    }
  },

  // Step 6: Final projection
  {
    $project: {
      _id: 0,
      itemId: "$_id.item",
      branchId: "$_id.branch",
      itemName: 1,
      itemCode: 1,
      branchName: 1,
      factorToBase: 1,
      purchases: 1,
      sales: 1,
      returns: 1,
      netQty: 1,
    }
  },

  // Step 7: Sort by item and branch
  { $sort: { itemName: 1, branchName: 1 } },
]);

  // ---------- 8) Override all netQty with on-hand RAW mix ----------
  const itemsMovement = itemsMovementAgg.map((row) => {
    const key = `${String(row.itemId)}::${String(row.branchId)}`;
    const canonical = onHandItemBranchMap.get(key);
    if (canonical) {
      return {
        ...row,
        // netQty: {
        //   baseQty: canonical.baseQty,
        //   primaryQty: canonical.primaryQty,
        // },
      };
    }
    return row;
  });

  const branchesMovement = branchesMovementAgg.map((row) => {
    const branchIdStr = String(row.branchId);
    const canonical = branchOnHandMap.get(branchIdStr);
    if (canonical) {
      return {
        ...row,
        // netQty: {
        //   baseQty: canonical.baseQty,
        //   primaryQty: canonical.primaryQty,
        // },
      };
    }
    return row;
  });

  const itemMovementPivot = itemMovementPivotAgg.map((row) => {
    const key = `${String(row.itemId)}::${String(row.branchId)}`;
    const canonical = onHandItemBranchMap.get(key);
    if (canonical) {
      return {
        ...row,
        // netQty: {
        //   baseQty: canonical.baseQty,
        //   primaryQty: canonical.primaryQty,
        // },
      };
    }
    return row;
  });

  return {
    generatedAt: new Date(),
    netMovementQty, // ✅ sum of RAW on-hand across all items
    totalReceivedQty, // movement summary
    totalIssuedQty, // movement summary
    periodItemCount,
    periodBranchCount,
    onHandQty, // ✅ RAW mix sum
    onHandStockValue,
    onHandItemCount,
    onHandBranchCount,
    itemsMovement,
    branchesMovement,
    transactionTypeTotals,
    itemMovementPivot,
    orderingFields: ["itemName", "branchName"],
  };
}

//-------------------- [ computeStockStatus(): Determine Stock Level & Status ] ----------------------
async function computeStockStatus(itemObj, branchId = null, salesRepId = null) {
  if (!itemObj?._id)
    throw new Error("computeStockStatus: item object with _id is required");

  const qtyOnHandBaseEq = await getItemBalance(
    itemObj._id,
    branchId,
    salesRepId
  ); // number
  const reorderLevel = toNumber(itemObj.reorderLevel);

  let stockStatus = "in_stock";
  if (qtyOnHandBaseEq <= 0) stockStatus = "out_of_stock";
  else if (qtyOnHandBaseEq <= reorderLevel) stockStatus = "low_stock";

  return { qtyOnHand: qtyOnHandBaseEq, stockStatus };
}

module.exports = {
  postLedger,
  postStockReturnLedger,
  getItemBalance,
  getItemHistory,
  getCurrentStock,
  getStockSnapshot,
  computeStockStatus,
};








