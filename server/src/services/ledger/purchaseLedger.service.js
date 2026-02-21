// // services/inventory/purchaseLedger.service.js
// const mongoose = require("mongoose");
// const logger = require("../../utils/logger.js");

// const PurchaseLedger = require("../../models/ledger/PurchaseLedger.model");
// const GRN = require("../../models/purchases/grn.model.js");

// //-------------------- [ Convert value to Mongoose ObjectId ] ----------------------
// function toObjectId(id) {
//   if (!id) return null;
//   return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
// }

// //-------------------- [ Convert value to finite number, fallback to 0 ] ----------------------
// function toNumber(value) {
//   const n = Number(value);
//   return Number.isFinite(n) ? n : 0;
// }

// //-------------------- [ postPurchaseLedger(): Record a Purchase Ledger Entry ] ----------------------
// async function postPurchaseLedger({
//   item,
//   branch,
//   supplier = null,
//   salesRep = null, // ✅ NEW
//   transactionType,
//   refModel,
//   refId,
//   qty,
//   avgCostBase = 0,
//   totalCostValue = 0,
//   discountAmount = 0,
//   remarks = "",
//   createdBy = null,
//   session = null,
// }) {
//   if (!item) throw new Error("item is required for purchase ledger post");
//   if (!branch) throw new Error("branch is required for purchase ledger post");
//   if (!transactionType) throw new Error("transactionType is required");
//   if (!refModel || !refId) throw new Error("refModel and refId are required");

//   const branchObj = toObjectId(branch);
//   const salesRepObj = salesRep ? toObjectId(salesRep) : null;

//   const qtyNum = toNumber(qty);
//   const avgCostNum = toNumber(avgCostBase);

//   let safeTotalCost = toNumber(totalCostValue);
//   if (!safeTotalCost) safeTotalCost = avgCostNum * qtyNum;

//   // Calculate discountAmount
//   const grossCostValue = avgCostNum * qtyNum; // You can adjust this calculation if necessary
//   const netCostValue = grossCostValue - discountAmount;

//   const [entry] = await PurchaseLedger.create(
//     [
//       {
//         item,
//         branch: branchObj,
//         supplier,
//         salesRep: salesRepObj, // ✅ NEW
//         transactionType,
//         refModel,
//         refId,
//         qty: qtyNum,
//         avgCostBase: avgCostNum,
//         totalCostValue: netCostValue, // Use net cost value after discount
//         discountAmount, // Store discountAmount
//         remarks,
//         createdBy,
//       },
//     ],
//     { session }
//   );

//   return entry.toObject();
// }

// //-------------------- [ postPurchaseReturnLedger(): Record a Purchase Return Entry ] ----------------------
// async function postPurchaseReturnLedger(args) {
//   const qtyAbs = Math.abs(toNumber(args.qty));
//   const avgCostNum = toNumber(args.avgCostBase);

//   return postPurchaseLedger({
//     ...args,
//     qty: qtyAbs,
//     avgCostBase: avgCostNum,
//     totalCostValue: args.totalCostValue || avgCostNum * qtyAbs,
//   });
// }

// //-------------------- [ listPurchaseLedger(): Retrieve Purchase Ledger Entries ] ----------------------
// async function listPurchaseLedger({
//   branch = null,
//   supplier = null,
//   salesRep = null, // ✅ NEW
//   from = null,
//   to = null,
//   limit = 200,
// }) {
//   const query = {};
//   if (branch) query.branch = toObjectId(branch);
//   if (supplier) query.supplier = toObjectId(supplier);
//   if (salesRep) query.salesRep = toObjectId(salesRep);

//   if (from || to) {
//     query.createdAt = {};
//     if (from) query.createdAt.$gte = from;
//     if (to) query.createdAt.$lte = to;
//   }

//   const rows = await PurchaseLedger.find(query)
//     .populate("item", "itemCode name")
//     .populate("branch", "name branchCode")
//     .populate("supplier", "name")
//     .populate("salesRep", "repCode name") // ✅ NEW
//     .sort({ createdAt: -1 })
//     .limit(limit)
//     .lean();

//   return rows;
// }

// //-------------------- [ getPurchaseSummaryBySupplier(): Summary of Purchases by Supplier ] ----------------------
// async function getPurchaseSummaryBySupplier({ branch = null, salesRep = null, from = null, to = null }) {
//   const match = {};
//   if (branch) match.branch = toObjectId(branch);
//   if (salesRep) match.salesRep = toObjectId(salesRep);
//   if (from || to) {
//     match.createdAt = {};
//     if (from) match.createdAt.$gte = from;
//     if (to) match.createdAt.$lte = to;
//   }

//   match.transactionType = { $in: ["purchase", "purchase-return"] };

//   const pipeline = [
//     { $match: match },
//     {
//       $project: {
//         supplier: 1,
//         qtyAdj: {
//           $multiply: [
//             "$qty",
//             {
//               $switch: {
//                 branches: [
//                   { case: { $eq: ["$transactionType", "purchase"] }, then: 1 },
//                   { case: { $eq: ["$transactionType", "purchase-return"] }, then: -1 },
//                 ],
//                 default: 0,
//               },
//             },
//           ],
//         },
//         costAdj: {
//           $multiply: [
//             "$totalCostValue",
//             {
//               $switch: {
//                 branches: [
//                   { case: { $eq: ["$transactionType", "purchase"] }, then: 1 },
//                   { case: { $eq: ["$transactionType", "purchase-return"] }, then: -1 },
//                 ],
//                 default: 0,
//               },
//             },
//           ],
//         },
//       },
//     },
//     { $group: { _id: "$supplier", totalQty: { $sum: "$qtyAdj" }, totalCostValue: { $sum: "$costAdj" } } },
//     { $match: { _id: { $ne: null } } },
//     { $lookup: { from: "suppliers", localField: "_id", foreignField: "_id", as: "supplierInfo" } },
//     { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },
//     { $project: { _id: 0, supplierId: "$_id", supplierName: "$supplierInfo.name", totalQty: 1, totalCostValue: 1 } },
//     { $sort: { supplierName: 1 } },
//   ];

//   return PurchaseLedger.aggregate(pipeline);
// }

// //-------------------- [ getPurchaseSummaryByItem(): Summary of Purchases by Item ] ----------------------
// async function getPurchaseSummaryByItem({ branch = null, salesRep = null, from = null, to = null }) {
//   const match = {};
//   if (branch) match.branch = toObjectId(branch);
//   if (salesRep) match.salesRep = toObjectId(salesRep);
//   if (from || to) {
//     match.createdAt = {};
//     if (from) match.createdAt.$gte = from;
//     if (to) match.createdAt.$lte = to;
//   }

//   const pipeline = [
//     { $match: match },
//     {
//       $project: {
//         item: 1,
//         branch: 1,
//         transactionType: 1,
//         qtyAdj: {
//           $multiply: [
//             "$qty",
//             {
//               $switch: {
//                 branches: [
//                   { case: { $in: ["$transactionType", ["purchase", "adj-goods-receive"]] }, then: 1 },
//                   { case: { $in: ["$transactionType", ["purchase-return", "adj-goods-return"]] }, then: -1 },
//                 ],
//                 default: 0,
//               },
//             },
//           ],
//         },
//         costAdj: {
//           $multiply: [
//             "$totalCostValue",
//             {
//               $switch: {
//                 branches: [
//                   { case: { $in: ["$transactionType", ["purchase", "adj-goods-receive"]] }, then: 1 },
//                   { case: { $in: ["$transactionType", ["purchase-return", "adj-goods-return"]] }, then: -1 },
//                 ],
//                 default: 0,
//               },
//             },
//           ],
//         },
//       },
//     },
//     { $group: { _id: { item: "$item", branch: "$branch" }, qtyPurchased: { $sum: "$qtyAdj" }, totalCost: { $sum: "$costAdj" } } },
//     { $lookup: { from: "items", localField: "_id.item", foreignField: "_id", as: "itemInfo" } },
//     { $unwind: "$itemInfo" },
//     { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branchInfo" } },
//     { $unwind: "$branchInfo" },
//     {
//       $project: {
//         _id: 0,
//         itemId: "$_id.item",
//         branchId: "$_id.branch",
//         itemName: "$itemInfo.name",
//         itemCode: "$itemInfo.itemCode",
//         branchName: "$branchInfo.name",
//         qtyPurchased: 1,
//         totalCost: 1,
//       },
//     },
//     { $sort: { branchName: 1, itemName: 1 } },
//   ];

//   return PurchaseLedger.aggregate(pipeline);
// }

// //-------------------- [ getPurchaseSnapshot(): Summary of Purchases ] ----------------------
// async function getPurchaseSnapshot({ branch = null, supplier = null, salesRep = null, from = null, to = null } = {}) {
//   const match = {};
//   if (branch) match.branch = toObjectId(branch);
//   if (supplier) match.supplier = toObjectId(supplier);
//   if (salesRep) match.salesRep = toObjectId(salesRep);
//   if (from || to) {
//     match.createdAt = {};
//     if (from) match.createdAt.$gte = from;
//     if (to) match.createdAt.$lte = to;
//   }

//   const mainAgg = await PurchaseLedger.aggregate([
//     { $match: match },
//     {
//       $group: {
//         _id: "$transactionType",
//         totalCost: { $sum: "$totalCostValue" },
//         totalQty: { $sum: "$qty" },
//         docCount: { $sum: 1 },
//       },
//     },
//   ]);

//   let totalNetPurchase = 0;
//   let totalGrossPurchase = 0;
//   let totalNetQty = 0;

//   let purchaseReturnCost = 0;
//   let purchaseReversalCost = 0;
//   let purchaseReturnReversalCost = 0;

//   for (const row of mainAgg) {
//     const type = row._id;
//     const cost = toNumber(row.totalCost);
//     const qty = toNumber(row.totalQty);

//     if (["purchase", "adj-goods-receive", "adjustment-increase"].includes(type)) {
//       totalGrossPurchase += cost;
//       totalNetPurchase += cost;
//       totalNetQty += qty;
//     } else if (["purchase-return", "adj-goods-return"].includes(type)) {
//       purchaseReturnCost += cost;
//       totalNetPurchase -= cost;
//       totalNetQty -= qty;
//     }
//   }

//   const returnImpactCost = -purchaseReturnCost - purchaseReversalCost + purchaseReturnReversalCost;
//   const returnImpact = { purchaseReturnCost, purchaseReversalCost, purchaseReturnReversalCost, returnImpactCost };

//   const [grnIds, supplierIds, branchIds] = await Promise.all([
//     PurchaseLedger.distinct("refId", { ...match, refModel: "GRN" }),
//     PurchaseLedger.distinct("supplier", match),
//     PurchaseLedger.distinct("branch", match),
//   ]);

//   const grnCount = grnIds.length;
//   const supplierCount = supplierIds.filter(Boolean).length;
//   const branchCount = branchIds.length;

//   const [items, suppliersRows] = await Promise.all([
//     getPurchaseSummaryByItem({ branch, salesRep, from, to }),
//     getPurchaseSummaryBySupplier({ branch, salesRep, from, to }),
//   ]);

//   // GRN status counts (filtered)
//   const grnMatch = {};
//   if (branch) grnMatch.branch = toObjectId(branch);
//   if (supplier) grnMatch.supplier = toObjectId(supplier);
//   if (salesRep) grnMatch.salesRep = toObjectId(salesRep);
//   if (from || to) {
//     grnMatch.createdAt = {};
//     if (from) grnMatch.createdAt.$gte = from;
//     if (to) grnMatch.createdAt.$lte = to;
//   }

//   const allGrn = await GRN.find(grnMatch, { status: 1 }).lean();

//   const grnStatus = {
//     approved: allGrn.filter((g) => g.status === "approved").length,
//     waiting_for_approval: allGrn.filter((g) => g.status === "waiting_for_approval").length,
//     cancelled: allGrn.filter((g) => g.status === "cancelled").length,
//   };

//   return {
//     generatedAt: new Date(),
//     totalNetPurchase,
//     totalGrossPurchase,
//     totalNetQty,
//     grnCount,
//     supplierCount,
//     branchCount,
//     returnImpact,
//     itemCount: items.length,
//     supplierRowCount: suppliersRows.length,
//     items,
//     suppliers: suppliersRows,
//     grnStatus,
//   };
// }

// module.exports = {
//   postPurchaseLedger,
//   postPurchaseReturnLedger,
//   listPurchaseLedger,
//   getPurchaseSummaryBySupplier,
//   getPurchaseSummaryByItem,
//   getPurchaseSnapshot,
// };






// services/inventory/purchaseLedger.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");

const PurchaseLedger = require("../../models/ledger/PurchaseLedger.model");
const GRN = require("../../models/purchases/grn.model.js");

// UOM helpers
const { formatQtySplit } = require("../../utils/uomDisplay");

//-------------------- [ Convert value to Mongoose ObjectId ] ----------------------
function toObjectId(id) {
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
}

//-------------------- [ Convert value to finite number, fallback to 0 ] ----------------------
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

//-------------------- [ postPurchaseLedger(): Record a Purchase Ledger Entry ] ----------------------
async function postPurchaseLedger({
  item,
  branch,
  supplier = null,
  salesRep = null,
  transactionType,
  refModel,
  refId,
  avgCostBase = 0,
  avgCostPrimary = 0,
  factorToBase = 0,
  primaryQty = 0,
  baseQty = 0,
  totalCostValue = 0,
  discountAmount = 0,
  remarks = "",
  createdBy = null,
  session = null,
}) {
  if (!item) throw new Error("item is required for purchase ledger post");
  if (!branch) throw new Error("branch is required for purchase ledger post");
  if (!transactionType) throw new Error("transactionType is required");
  if (!refModel || !refId) throw new Error("refModel and refId are required");

  const branchObj = toObjectId(branch);
  const salesRepObj = salesRep ? toObjectId(salesRep) : null;

  const primaryQtyNum = toNumber(primaryQty);
  const baseQtyNum = toNumber(baseQty);
  const avgCostBaseNum = toNumber(avgCostBase);
  const avgCostPrimaryNum = toNumber(avgCostPrimary);
  const factorToBaseNum = toNumber(factorToBase);
  const discountAmountNum = toNumber(discountAmount);

  // If totalCostValue not provided or zero, compute it:
  // gross = (baseQty * avgCostBase) + (primaryQty * avgCostPrimary)
  // net   = gross - discountAmount
  let safeTotalCost = toNumber(totalCostValue);
  if (!safeTotalCost) {
    const grossCostValue =
      baseQtyNum * avgCostBaseNum + primaryQtyNum * avgCostPrimaryNum;
    safeTotalCost = grossCostValue - discountAmountNum;
  }

  const [entry] = await PurchaseLedger.create(
    [
      {
        item,
        branch: branchObj,
        supplier,
        salesRep: salesRepObj,
        transactionType,
        refModel,
        refId,
        primaryQty: primaryQtyNum,
        baseQty: baseQtyNum,
        factorToBase: factorToBaseNum,
        avgCostBase: avgCostBaseNum,
        avgCostPrimary: avgCostPrimaryNum,
        totalCostValue: safeTotalCost,
        discountAmount: discountAmountNum,
        remarks,
        createdBy,
      },
    ],
    { session }
  );

  return entry.toObject();
}

//-------------------- [ postPurchaseReturnLedger(): Record a Purchase Return Entry ] ----------------------
// NOTE: caller can pass +/-; we force ABS here and let reports handle sign via transactionType
async function postPurchaseReturnLedger(args) {
  const primaryQtyAbs = Math.abs(toNumber(args.primaryQty));
  const baseQtyAbs = Math.abs(toNumber(args.baseQty));
  const avgCostBaseNum = toNumber(args.avgCostBase);
  const avgCostPrimaryNum = toNumber(args.avgCostPrimary);
  const discountAmountNum = toNumber(args.discountAmount);

  let totalCost = toNumber(args.totalCostValue);
  if (!totalCost) {
    const grossCostValue =
      baseQtyAbs * avgCostBaseNum + primaryQtyAbs * avgCostPrimaryNum;
    totalCost = grossCostValue - discountAmountNum;
  }

  return postPurchaseLedger({
    ...args,
    primaryQty: primaryQtyAbs,
    baseQty: baseQtyAbs,
    avgCostBase: avgCostBaseNum,
    avgCostPrimary: avgCostPrimaryNum,
    totalCostValue: totalCost,
    discountAmount: discountAmountNum,
  });
}

//-------------------- [ listPurchaseLedger(): Retrieve Purchase Ledger Entries ] ----------------------
async function listPurchaseLedger({
  branch = null,
  supplier = null,
  salesRep = null,
  from = null,
  to = null,
  limit = 200,
}) {
  const query = {};
  if (branch) query.branch = toObjectId(branch);
  if (supplier) query.supplier = toObjectId(supplier);
  if (salesRep) query.salesRep = toObjectId(salesRep);

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const rows = await PurchaseLedger.find(query)
    .populate("item", "itemCode name primaryUom baseUom")
    .populate("branch", "name branchCode")
    .populate("supplier", "name")
    .populate("salesRep", "repCode name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Add human-readable qty string (e.g. "2 CARTONS + 5 PCS")
  return rows.map((row) => {
    const primaryLabel = row.item?.primaryUom || "CARTON";
    const baseLabel = row.item?.baseUom || "PC";

    const qtyDisplay = formatQtySplit({
      primaryQty: row.primaryQty,
      baseQty: row.baseQty,
      primaryLabel,
      baseLabel,
    });

    return {
      ...row,
      qtyDisplay,
    };
  });
}

//-------------------- [ getPurchaseSummaryBySupplier(): Summary of Purchases by Supplier ] ----------------------
async function getPurchaseSummaryBySupplier({
  branch = null,
  salesRep = null,
  from = null,
  to = null,
}) {
  const match = {};
  if (branch) match.branch = toObjectId(branch);
  if (salesRep) match.salesRep = toObjectId(salesRep);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  // Only purchases & purchase returns
  match.transactionType = { $in: ["purchase", "purchase-return"] };

  const pipeline = [
    { $match: match },
    {
      $project: {
        supplier: 1,
        transactionType: 1,
        totalCostValue: 1,
        baseQty: { $ifNull: ["$baseQty", 0] },
        primaryQty: { $ifNull: ["$primaryQty", 0] },
      },
    },
    {
      $group: {
        _id: "$supplier",
        totalBaseQty: {
          $sum: {
            $cond: [
              { $eq: ["$transactionType", "purchase"] },
              "$baseQty",
              { $multiply: ["$baseQty", -1] },
            ],
          },
        },
        totalPrimaryQty: {
          $sum: {
            $cond: [
              { $eq: ["$transactionType", "purchase"] },
              "$primaryQty",
              { $multiply: ["$primaryQty", -1] },
            ],
          },
        },
        totalCostValue: {
          $sum: {
            $cond: [
              { $eq: ["$transactionType", "purchase"] },
              "$totalCostValue",
              { $multiply: ["$totalCostValue", -1] },
            ],
          },
        },
      },
    },
    { $match: { _id: { $ne: null } } },
    {
      $lookup: {
        from: "suppliers",
        localField: "_id",
        foreignField: "_id",
        as: "supplierInfo",
      },
    },
    { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        supplierId: "$_id",
        supplierName: "$supplierInfo.name",
        totalQty: {
          baseQty: "$totalBaseQty",
          primaryQty: "$totalPrimaryQty",
        },
        totalCostValue: 1,
      },
    },
    { $sort: { supplierName: 1 } },
  ];

  return PurchaseLedger.aggregate(pipeline);
}

//-------------------- [ getPurchaseSummaryByItem(): Summary of Purchases by Item ] ----------------------
async function getPurchaseSummaryByItem({
  branch = null,
  salesRep = null,
  from = null,
  to = null,
}) {
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
        totalCostValue: 1,
        baseQty: { $ifNull: ["$baseQty", 0] },
        primaryQty: { $ifNull: ["$primaryQty", 0] },
      },
    },
    {
      $group: {
        _id: { item: "$item", branch: "$branch" },
        baseQtyPurchased: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: ["$transactionType", ["purchase", "adj-goods-receive"]],
                  },
                  then: "$baseQty",
                },
                {
                  case: {
                    $in: [
                      "$transactionType",
                      ["purchase-return", "adj-goods-return"],
                    ],
                  },
                  then: { $multiply: ["$baseQty", -1] },
                },
              ],
              default: 0,
            },
          },
        },
        primaryQtyPurchased: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: ["$transactionType", ["purchase", "adj-goods-receive"]],
                  },
                  then: "$primaryQty",
                },
                {
                  case: {
                    $in: [
                      "$transactionType",
                      ["purchase-return", "adj-goods-return"],
                    ],
                  },
                  then: { $multiply: ["$primaryQty", -1] },
                },
              ],
              default: 0,
            },
          },
        },
        totalCost: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: ["$transactionType", ["purchase", "adj-goods-receive"]],
                  },
                  then: "$totalCostValue",
                },
                {
                  case: {
                    $in: [
                      "$transactionType",
                      ["purchase-return", "adj-goods-return"],
                    ],
                  },
                  then: { $multiply: ["$totalCostValue", -1] },
                },
              ],
              default: 0,
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "items",
        localField: "_id.item",
        foreignField: "_id",
        as: "itemInfo",
      },
    },
    { $unwind: "$itemInfo" },
    {
      $lookup: {
        from: "branches",
        localField: "_id.branch",
        foreignField: "_id",
        as: "branchInfo",
      },
    },
    { $unwind: "$branchInfo" },
    {
      $project: {
        _id: 0,
        itemId: "$_id.item",
        branchId: "$_id.branch",
        itemName: "$itemInfo.name",
        itemCode: "$itemInfo.itemCode",
        branchName: "$branchInfo.name",
        qtyPurchased: {
          baseQty: "$baseQtyPurchased",
          primaryQty: "$primaryQtyPurchased",
        },
        totalCost: 1,

        // UOM metadata from Item
        primaryUom: "$itemInfo.primaryUom",
        baseUom: "$itemInfo.baseUom",
      },
    },
    { $sort: { branchName: 1, itemName: 1 } },
  ];

  const rows = await PurchaseLedger.aggregate(pipeline);

  // Add qtyDisplay using primary+base + item UOMs
  return rows.map((row) => {
    const primaryLabel = row.primaryUom || "CARTON";
    const baseLabel = row.baseUom || "PC";

    const qtyDisplay = formatQtySplit({
      primaryQty: row.qtyPurchased.primaryQty,
      baseQty: row.qtyPurchased.baseQty,
      primaryLabel,
      baseLabel,
    });

    return {
      ...row,
      qtyDisplay, // e.g. "3 CARTONS + 4 PCS"
    };
  });
}

//-------------------- [ getPurchaseSnapshot(): Summary of Purchases ] ----------------------
async function getPurchaseSnapshot({
  branch = null,
  supplier = null,
  salesRep = null,
  from = null,
  to = null,
} = {}) {
  const match = {};
  if (branch) match.branch = toObjectId(branch);
  if (supplier) match.supplier = toObjectId(supplier);
  if (salesRep) match.salesRep = toObjectId(salesRep);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const mainAgg = await PurchaseLedger.aggregate([
    { $match: match },
    {
      $project: {
        transactionType: 1,
        totalCostValue: 1,
        baseQty: { $ifNull: ["$baseQty", 0] },
        primaryQty: { $ifNull: ["$primaryQty", 0] },
      },
    },
    {
      $group: {
        _id: "$transactionType",
        totalCost: { $sum: "$totalCostValue" },
        totalBaseQty: { $sum: "$baseQty" },
        totalPrimaryQty: { $sum: "$primaryQty" },
        docCount: { $sum: 1 },
      },
    },
  ]);

  let totalNetPurchase = 0;
  let totalGrossPurchase = 0;
  let totalNetBaseQty = 0;
  let totalNetPrimaryQty = 0;

  let purchaseReturnCost = 0;
  let purchaseReversalCost = 0;
  let purchaseReturnReversalCost = 0;

  for (const row of mainAgg) {
    const type = row._id;
    const cost = toNumber(row.totalCost);
    const baseQty = toNumber(row.totalBaseQty);
    const primaryQty = toNumber(row.totalPrimaryQty);

    if (["purchase", "adj-goods-receive", "adjustment-increase"].includes(type)) {
      totalGrossPurchase += cost;
      totalNetPurchase += cost;
      totalNetBaseQty += baseQty;
      totalNetPrimaryQty += primaryQty;
    } else if (["purchase-return", "adj-goods-return"].includes(type)) {
      purchaseReturnCost += cost;
      totalNetPurchase -= cost;
      totalNetBaseQty -= baseQty;
      totalNetPrimaryQty -= primaryQty;
    }
  }

  const returnImpactCost =
    -purchaseReturnCost - purchaseReversalCost + purchaseReturnReversalCost;
  const returnImpact = {
    purchaseReturnCost,
    purchaseReversalCost,
    purchaseReturnReversalCost,
    returnImpactCost,
  };

  const [grnIds, supplierIds, branchIds] = await Promise.all([
    PurchaseLedger.distinct("refId", { ...match, refModel: "GRN" }),
    PurchaseLedger.distinct("supplier", match),
    PurchaseLedger.distinct("branch", match),
  ]);

  const grnCount = grnIds.length;
  const supplierCount = supplierIds.filter(Boolean).length;
  const branchCount = branchIds.length;

  const [items, suppliersRows] = await Promise.all([
    getPurchaseSummaryByItem({ branch, salesRep, from, to }),
    getPurchaseSummaryBySupplier({ branch, salesRep, from, to }),
  ]);

  // GRN status counts (filtered)
  const grnMatch = {};
  if (branch) grnMatch.branch = toObjectId(branch);
  if (supplier) grnMatch.supplier = toObjectId(supplier);
  if (salesRep) grnMatch.salesRep = toObjectId(salesRep);
  if (from || to) {
    grnMatch.createdAt = {};
    if (from) grnMatch.createdAt.$gte = from;
    if (to) grnMatch.createdAt.$lte = to;
  }

  const allGrn = await GRN.find(grnMatch, { status: 1 }).lean();

  const grnStatus = {
    approved: allGrn.filter((g) => g.status === "approved").length,
    waiting_for_approval: allGrn.filter(
      (g) => g.status === "waiting_for_approval"
    ).length,
    cancelled: allGrn.filter((g) => g.status === "cancelled").length,
  };

  return {
    generatedAt: new Date(),
    totalNetPurchase,
    totalGrossPurchase,
    totalNetQty: {
      baseQty: totalNetBaseQty,
      primaryQty: totalNetPrimaryQty,
    },
    grnCount,
    supplierCount,
    branchCount,
    returnImpact,
    itemCount: items.length,
    supplierRowCount: suppliersRows.length,
    items,
    suppliers: suppliersRows,
    grnStatus,
  };
}

module.exports = {
  postPurchaseLedger,
  postPurchaseReturnLedger,
  listPurchaseLedger,
  getPurchaseSummaryBySupplier,
  getPurchaseSummaryByItem,
  getPurchaseSnapshot,
};
