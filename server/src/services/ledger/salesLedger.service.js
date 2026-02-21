// services/ledger/salesLedger.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");

const SalesLedger = require("../../models/ledger/SalesLedger.model");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");

// UOM helpers
const {
  formatQtySplit,
  splitFromBaseEquivalent,
} = require("../../utils/uomDisplay");

// -------------------- Utilities --------------------
function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// -------------------- postSalesLedger (multi-UOM, salesRep support) --------------------
async function postSalesLedger({
  item,
  branch,
  customer = null,
  salesRep = null,
  transactionType,
  refModel,
  refId,

  // Multi-UOM fields
  factorToBase,
  primaryQty,
  baseQty,

  // Prices
  sellingPriceBase = 0,
  sellingPricePrimary = 0,

  // Value fields (optional overrides)
  grossSellingValue = null,
  discountAmount = null,
  totalSellingValue = 0, // NET value

  remarks = "",
  createdBy = null,
  session = null,
}) {
  if (!item) throw new Error("item is required for sales ledger post");
  if (!branch) throw new Error("branch is required for sales ledger post");
  if (!transactionType) throw new Error("transactionType is required");
  if (!refModel || !refId) throw new Error("refModel and refId are required");
  if (factorToBase === undefined || factorToBase === null) {
    throw new Error("factorToBase is required for sales ledger post");
  }

  const branchObj = toObjectId(branch);
  const salesRepObj = salesRep ? toObjectId(salesRep) : null;

  const factorNum = toNumber(factorToBase) || 1;
  if (factorNum <= 0) {
    throw Object.assign(
      new Error("factorToBase must be > 0 for sales ledger post"),
      {
        status: 500,
        code: "INVALID_FACTOR_TO_BASE",
        meta: { item, branch, transactionType, factorToBase },
      }
    );
  }

  // Always store positive quantities; sign is handled via transactionType
  const primaryQtyNum = Math.abs(toNumber(primaryQty));
  const baseQtyNum = Math.abs(toNumber(baseQty));

  const priceBaseNum = toNumber(sellingPriceBase);
  const pricePrimaryNum = toNumber(sellingPricePrimary);

  // If gross/net not provided, calculate from qty + price
  let grossValue =
    grossSellingValue !== null && grossSellingValue !== undefined
      ? toNumber(grossSellingValue)
      : primaryQtyNum * pricePrimaryNum + baseQtyNum * priceBaseNum;

  let netValue = toNumber(totalSellingValue);
  if (!netValue) {
    // if caller didn't provide net value, assume no discount
    netValue = grossValue;
  }

  let discountVal =
    discountAmount !== null && discountAmount !== undefined
      ? toNumber(discountAmount)
      : grossValue - netValue;

  const [entry] = await SalesLedger.create(
    [
      {
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
      },
    ],
    { session }
  );

  return entry.toObject();
}

// -------------------- postSalesReturnLedger (multi-UOM, uses postSalesLedger) --------------------
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
  if (!refModel || !refId) {
    throw new Error("refModel and refId are required for sales return ledger");
  }

  if (!["sales-return", "adj-sales-return"].includes(transactionType)) {
    throw new Error(`Invalid sales return transactionType: ${transactionType}`);
  }

  // returns also stored as positive qty; sign handled in aggregations
  const primaryQtyAbs = Math.abs(toNumber(primaryQty));
  const baseQtyAbs = Math.abs(toNumber(baseQty));

  return postSalesLedger({
    item,
    branch,
    customer,
    salesRep,
    transactionType,
    refModel,
    refId,
    factorToBase,
    primaryQty: primaryQtyAbs,
    baseQty: baseQtyAbs,
    sellingPriceBase,
    sellingPricePrimary,
    grossSellingValue,
    discountAmount,
    totalSellingValue,
    remarks,
    createdBy,
    session,
  });
}

// -------------------- listSalesLedger (salesRep filter + qtyDisplay) --------------------
async function listSalesLedger({
  branch = null,
  customer = null,
  salesRep = null,
  from = null,
  to = null,
  limit = 200,
}) {
  const query = {};
  if (branch) query.branch = toObjectId(branch);
  if (customer) query.customer = toObjectId(customer);
  if (salesRep) query.salesRep = toObjectId(salesRep);

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const rows = await SalesLedger.find(query)
    .populate("item", "itemCode name primaryUom baseUom factorToBase")
    .populate("branch", "name branchCode")
    .populate("customer", "name")
    .populate("salesRep", "repCode name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Add human-readable qty string (e.g. "2 CARTONS + 3 PCS")
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

// ✅ getSalesSummaryByItem (salesRep filter, value-based primary/base sums)
async function getSalesSummaryByItem({
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

        // signed primary/base quantities (sale = +, returns = -)
        primaryAdj: {
          $multiply: [
            { $ifNull: ["$primaryQty", 0] },
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$transactionType", "sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 },
                  {
                    case: { $eq: ["$transactionType", "adj-sales-return"] },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },
        baseAdj: {
          $multiply: [
            { $ifNull: ["$baseQty", 0] },
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$transactionType", "sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 },
                  {
                    case: { $eq: ["$transactionType", "adj-sales-return"] },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },
        revenueAdj: {
          $multiply: [
            "$totalSellingValue",
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$transactionType", "sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 },
                  {
                    case: { $eq: ["$transactionType", "adj-sales-return"] },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: { item: "$item", branch: "$branch" },
        netPrimaryQty: { $sum: "$primaryAdj" },
        netBaseQty: { $sum: "$baseAdj" },
        totalRevenue: { $sum: "$revenueAdj" },
        factorToBase: { $first: "$factorToBase" },
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
        netPrimaryQty: 1,
        netBaseQty: 1,
        totalRevenue: 1,

        // UOM metadata
        factorToBase: {
          $ifNull: ["$factorToBase", "$itemInfo.factorToBase"],
        },
        primaryUom: "$itemInfo.primaryUom",
        baseUom: "$itemInfo.baseUom",
      },
    },
    { $sort: { branchName: 1, itemName: 1 } },
  ];

  const rows = await SalesLedger.aggregate(pipeline);

  // Build display quantities (keep the value-based representation)
  return rows.map((row) => {
    const factor = row.factorToBase || 1;

    // net signed quantities from ledger
    const netPrimary = toNumber(row.netPrimaryQty);
    const netBase = toNumber(row.netBaseQty);

    // base-equivalent for analytics if you need it
    const qtySoldBaseEq = netBase + netPrimary * factor;

    // for display we usually want non-negative; if you want to show negatives, remove Math.max
    const primaryQty = Math.max(0, netPrimary);
    const baseQty = Math.max(0, netBase);

    const primaryLabel = row.primaryUom || "CARTON";
    const baseLabel = row.baseUom || "PC";

    const qtyDisplay = formatQtySplit({
      primaryQty,
      baseQty,
      primaryLabel,
      baseLabel,
    });

    return {
      ...row,
      qtySoldBaseEq, // numeric base-equivalent
      qtyPrimary: primaryQty,
      qtyBase: baseQty,
      qtyDisplay, // e.g. "11 PIECES" in your example
    };
  });
}


// -------------------- getSalesSummaryByCustomer (salesRep filter, base-equivalent qty) --------------------
// ✅ getSalesSummaryByCustomer (salesRep filter, value-based primary/base qty)
async function getSalesSummaryByCustomer({
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

  const pipeline = [
    { $match: match },
    {
      $project: {
        customer: 1,
        branch: 1,
        transactionType: 1,
        primaryQty: { $ifNull: ["$primaryQty", 0] },
        baseQty: { $ifNull: ["$baseQty", 0] },
        totalSellingValue: 1,

        // signed primary/base quantities (sale = +, returns = -)
        primaryAdj: {
          $multiply: [
            { $ifNull: ["$primaryQty", 0] },
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$transactionType", "sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 },
                  {
                    case: { $eq: ["$transactionType", "adj-sales-return"] },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },
        baseAdj: {
          $multiply: [
            { $ifNull: ["$baseQty", 0] },
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$transactionType", "sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 },
                  {
                    case: { $eq: ["$transactionType", "adj-sales-return"] },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },
        revenueAdj: {
          $multiply: [
            "$totalSellingValue",
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$transactionType", "sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "adj-sale"] }, then: 1 },
                  { case: { $eq: ["$transactionType", "sales-return"] }, then: -1 },
                  {
                    case: { $eq: ["$transactionType", "adj-sales-return"] },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: { customer: "$customer", branch: "$branch" },
        netPrimaryQty: { $sum: "$primaryAdj" },
        netBaseQty: { $sum: "$baseAdj" },
        totalRevenue: { $sum: "$revenueAdj" },
      },
    },
    {
      $lookup: {
        from: "customers",
        localField: "_id.customer",
        foreignField: "_id",
        as: "customerInfo",
      },
    },
    {
      $unwind: {
        path: "$customerInfo",
        preserveNullAndEmptyArrays: true,
      },
    },
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
        customerId: "$_id.customer",
        branchId: "$_id.branch",
        customerName: { $ifNull: ["$customerInfo.name", "Unknown Customer"] },
        branchName: "$branchInfo.name",
        netPrimaryQty: 1,
        netBaseQty: 1,
        totalRevenue: 1,
      },
    },
    { $sort: { totalRevenue: -1 } },
  ];

  const rows = await SalesLedger.aggregate(pipeline);

  // Map to desired shape: qtySold: { primaryQty, baseQty }
  return rows.map((row) => {
    const primaryQty = toNumber(row.netPrimaryQty);
    const baseQty = toNumber(row.netBaseQty);

    return {
      customerId: row.customerId,
      branchId: row.branchId,
      customerName: row.customerName,
      branchName: row.branchName,
      totalRevenue: row.totalRevenue,
      qtySold: {
        primaryQty,
        baseQty,
      },
    };
  });
}


// -------------------- getSalesSnapshot (FULL, salesRep filter, multi-UOM net qty) --------------------
async function getSalesSnapshot({
  branch = null,
  customer = null,
  salesRep = null,
  from = null,
  to = null,
} = {}) {
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
        grossSellingValue: 1,
        totalSellingValue: 1,

        // base-equivalent qty: primary * factorToBase + base
        qtyBaseEquivalent: {
          $add: [
            { $ifNull: ["$baseQty", 0] },
            {
              $multiply: [
                { $ifNull: ["$primaryQty", 0] },
                { $ifNull: ["$factorToBase", 1] },
              ],
            },
          ],
        },

        // signed primary qty (Net = sales - returns)
        signedPrimaryQty: {
          $multiply: [
            { $ifNull: ["$primaryQty", 0] },
            {
              $switch: {
                branches: [
                  {
                    case: { $in: ["$transactionType", ["sale", "adj-sale"]] },
                    then: 1,
                  },
                  {
                    case: {
                      $in: [
                        "$transactionType",
                        ["sales-return", "adj-sales-return"],
                      ],
                    },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },

        // signed base qty (Net = sales - returns)
        signedBaseQty: {
          $multiply: [
            { $ifNull: ["$baseQty", 0] },
            {
              $switch: {
                branches: [
                  {
                    case: { $in: ["$transactionType", ["sale", "adj-sale"]] },
                    then: 1,
                  },
                  {
                    case: {
                      $in: [
                        "$transactionType",
                        ["sales-return", "adj-sales-return"],
                      ],
                    },
                    then: -1,
                  },
                ],
                default: 0,
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$transactionType",

        // revenue
        netRevenue: { $sum: "$totalSellingValue" },
        grossRevenue: { $sum: "$grossSellingValue" },

        // base-equivalent qty (for backwards compatibility)
        totalQty: { $sum: "$qtyBaseEquivalent" },

        // net primary/base qty for this transactionType
        netPrimaryQty: { $sum: "$signedPrimaryQty" },
        netBaseQty: { $sum: "$signedBaseQty" },

        docCount: { $sum: 1 },
      },
    },
  ]);

  let totalNetRevenue = 0;
  let totalGrossRevenue = 0;
  let totalNetQtyBaseEq = 0;      // base-equivalent (old behaviour)

  let totalNetPrimaryQty = 0;     // new: primary units
  let totalNetBaseQty = 0;        // new: base units

  let salesReturnRevenue = 0;
  let saleReversalRevenue = 0; // reserved if you later add reversal types
  let salesReturnReversalRevenue = 0; // reserved if you later add reversal types

  for (const row of mainAgg) {
    const type = row._id;
    const netRevenue = toNumber(row.netRevenue);
    const grossRevenue = toNumber(row.grossRevenue);
    const qtyBaseEq = toNumber(row.totalQty);

    const netPrimaryForType = toNumber(row.netPrimaryQty);
    const netBaseForType = toNumber(row.netBaseQty);

    // ✅ Sales & adjustments (positive)
    if (["sale", "adj-sale"].includes(type)) {
      totalGrossRevenue += grossRevenue;
      totalNetRevenue += netRevenue;
      totalNetQtyBaseEq += qtyBaseEq;

      totalNetPrimaryQty += netPrimaryForType;
      totalNetBaseQty += netBaseForType;
    }

    // ✅ Returns (negative impact)
    if (["sales-return", "adj-sales-return"].includes(type)) {
      salesReturnRevenue += netRevenue;

      totalGrossRevenue -= grossRevenue;
      totalNetRevenue -= netRevenue;
      totalNetQtyBaseEq -= qtyBaseEq;

      // netPrimaryQty/netBaseQty for these types are already signed (-),
      // so just add them to accumulate net = sales - returns
      totalNetPrimaryQty += netPrimaryForType;
      totalNetBaseQty += netBaseForType;
    }
  }

  const returnImpactRevenue =
    salesReturnRevenue + saleReversalRevenue + salesReturnReversalRevenue;
  const returnImpact = {
    salesReturnRevenue,
    saleReversalRevenue,
    salesReturnReversalRevenue,
    returnImpactRevenue,
  };

  const [invoiceIds, customerIds, branchIds] = await Promise.all([
    SalesLedger.distinct("refId", match),
    SalesLedger.distinct("customer", match),
    SalesLedger.distinct("branch", match),
  ]);

  const invoiceCount = invoiceIds.length;
  const customerCount = customerIds.filter(Boolean).length;
  const branchCount = branchIds.length;

  const [items, customersList] = await Promise.all([
    getSalesSummaryByItem({ branch, salesRep, from, to }),
    getSalesSummaryByCustomer({ branch, salesRep, from, to }),
  ]);

  // Invoice statuses (same filters as ledger)
  const invoiceMatch = { ...match };
  const allInvoices = await SalesInvoice.find(invoiceMatch, { status: 1 }).lean();

  const invoiceStatus = {
    approved: allInvoices.filter((i) => i.status === "approved").length,
    waiting_for_approval: allInvoices.filter(
      (i) => i.status === "waiting_for_approval"
    ).length,
    cancelled: allInvoices.filter((i) => i.status === "cancelled").length,
  };

  return {
    generatedAt: new Date(),
    totalGrossRevenue,
    totalNetRevenue,

    // ✅ NEW: expose net qty as separate primary/base counts
    totalNetQty: {
      primaryQty: totalNetPrimaryQty,
      baseQty: totalNetBaseQty,
    },

    // (optional) if you still want base-equivalent somewhere else,
    // you can also expose this:
    // totalNetQtyBaseEquivalent: totalNetQtyBaseEq,

    invoiceCount,
    customerCount,
    branchCount,
    returnImpact,
    itemCount: items.length,
    customerRowCount: customersList.length,
    items,
    customers: customersList,
    invoiceStatus,
  };
}

module.exports = {
  postSalesLedger,
  postSalesReturnLedger,
  listSalesLedger,
  getSalesSummaryByItem,
  getSalesSummaryByCustomer,
  getSalesSnapshot,
};
