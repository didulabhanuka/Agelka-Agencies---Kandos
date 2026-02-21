// // services/purchases/grn.service.js
// const mongoose = require("mongoose");
// const logger = require("../../utils/logger.js");

// const GRN = require("../../models/purchases/grn.model.js");
// const Item = require("../../models/inventory/item.model.js");
// const Supplier = require("../../models/user/supplier.model.js");
// const Branch = require("../../models/inventorySettings/branch.model.js");
// const SalesRep = require("../../models/user/salesRep.model.js");
// const SalesRepStock = require("../../models/inventory/salesRepStock.model.js");


// const { postLedger } = require("../ledger/stockLedger.service.js");
// const { postPurchaseLedger } = require("../ledger/purchaseLedger.service.js");

// // ---------- helpers ----------
// function isUserActor(actor) {
//   return actor?.actorType === "User"; // Admin/DataEntry
// }
// function isSalesRepActor(actor) {
//   return actor?.actorType === "SalesRep";
// }

// async function assertSalesRepExists(salesRepId, session) {
//   const q = SalesRep.findById(salesRepId).lean();
//   if (session) q.session(session);
//   const rep = await q;
//   if (!rep) throw new Error("Invalid SalesRep");
//   if (rep.status && rep.status !== "active") throw new Error("SalesRep is inactive");
//   return rep;
// }

// // -------------------- CREATE GRN --------------------
// async function createGRN(payload, actor) {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       grnNo,
//       supplier,
//       supplierInvoiceNo = null,
//       supplierInvoiceDate = null,
//       items: rawItems,
//       receivedDate,
//       branch: branchId,
//       salesRep: salesRepFromBody, // required for User actor
//     } = payload;

//     logger.info("createGRN() called", { grnNo, supplier, branchId, receivedDate, actor });

//     // Validate branch
//     const branchDoc = await Branch.findById(branchId).lean();
//     if (!branchDoc) throw new Error("Invalid branch selected");

//     // Determine SalesRep owner
//     let salesRepId = null;

//     if (isSalesRepActor(actor)) {
//       salesRepId = actor.actorId;
//     } else if (isUserActor(actor)) {
//       if (!salesRepFromBody) throw new Error("salesRep is required when Admin/DataEntry creates a GRN");
//       salesRepId = salesRepFromBody;
//     } else {
//       throw new Error("Unauthorized actor");
//     }

//     await assertSalesRepExists(salesRepId, session);

//     // -------------------- PREPARE ITEMS --------------------
//     const items = [];
//     for (const line of rawItems || []) {
//       const rawItemRef = line.item;
//       const itemId = new mongoose.Types.ObjectId(rawItemRef && rawItemRef._id ? rawItemRef._id : rawItemRef);

//       let avgCostBase = Number(line.avgCostBase) || 0;
//       if (avgCostBase <= 0) {
//         const itemDoc = await Item.findById(itemId).select("avgCostBase").lean();
//         if (!itemDoc) throw new Error(`Item not found: ${rawItemRef}`);
//         avgCostBase = itemDoc.avgCostBase || 0;
//       }

//       const qty = Number(line.qty);
//       if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Invalid quantity for item ${rawItemRef}`);

//       // Apply discountPerUnit to calculate the item total value
//       const discountPerUnit = Number(line.discountPerUnit || 0);
//       const itemTotalValue = qty * (avgCostBase - discountPerUnit); // Apply discount here

//       items.push({ item: itemId, qty, avgCostBase, discountPerUnit, itemTotalValue });
//     }

//     const totalValue = items.reduce((sum, i) => sum + i.itemTotalValue, 0);

//     // -------------------- CREATE GRN --------------------
//     const [grn] = await GRN.create(
//       [
//         {
//           grnNo,
//           supplier,
//           supplierInvoiceNo,
//           supplierInvoiceDate,
//           branch: branchDoc._id,

//           salesRep: salesRepId,
//           createdByModel: isUserActor(actor) ? "User" : "SalesRep",
//           createdBy: actor.actorId,

//           items,
//           totalValue,
//           receivedDate,
//           status: "waiting_for_approval",
//         },
//       ],
//       { session }
//     );

//     await Supplier.findByIdAndUpdate(supplier, { $addToSet: { grns: grn._id } }, { session });
//     await SalesRep.findByIdAndUpdate(salesRepId, { $addToSet: { grns: grn._id } }, { session });

//     await session.commitTransaction();
//     session.endSession();

//     return grn.toObject();
//   } catch (err) {
//     logger.error("createGRN() failed", err);
//     try {
//       if (session.inTransaction()) await session.abortTransaction();
//     } finally {
//       session.endSession();
//     }
//     throw err;
//   }
// }

// // -------------------- READ GRN --------------------
// async function getGRN(id) {
//   return GRN.findById(id)
//     .populate("supplier", "name supplierCode")
//     .populate("branch", "name branchCode")
//     .populate("salesRep", "repCode name")
//     .populate("items.item", "itemCode name brand productType baseUnit")
//     .lean();
// }

// // -------------------- LIST GRNs --------------------
// async function listGRN(query = {}, options = {}) {
//   console.log("🔥 MONGO QUERY:", JSON.stringify(query));
//   const limit = options.limit || 100;

//   return GRN.find(query)
//     .sort({ receivedDate: -1 })
//     .limit(limit)
//     .populate("branch", "name branchCode")
//     .populate("supplier", "name supplierCode contactNumber")
//     .populate("salesRep", "repCode name")
//     .lean();
// }

// // -------------------- SUMMARY --------------------
// async function getGRNSummary() {
//   const agg = await GRN.aggregate([
//     {
//       $lookup: {
//         from: "branches",
//         localField: "branch",
//         foreignField: "_id",
//         as: "branchInfo",
//       },
//     },
//     { $unwind: "$branchInfo" },
//     {
//       $lookup: {
//         from: "suppliers",
//         localField: "supplier",
//         foreignField: "_id",
//         as: "supplierInfo",
//       },
//     },
//     { $unwind: "$supplierInfo" },
//     {
//       $group: {
//         _id: {
//           branch: "$branchInfo.name",
//           supplier: "$supplierInfo.name",
//           year: { $year: "$receivedDate" },
//           month: { $month: "$receivedDate" },
//         },
//         totalGRNs: { $sum: 1 },
//         totalValue: { $sum: "$totalValue" },
//       },
//     },
//     { $sort: { "_id.year": 1, "_id.month": 1 } },
//   ]);

//   return agg;
// }

// // -------------------- APPROVE GRN (User only) --------------------
// async function approveGRN(id, userId) {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const grn = await GRN.findById(id).session(session);
//     if (!grn) throw new Error("GRN not found");
//     if (grn.status !== "waiting_for_approval")
//       throw new Error("Only waiting_for_approval can be approved");

//     grn.status = "approved";
//     grn.approvedBy = userId;
//     grn.approvedAt = new Date();

//     for (const line of grn.items || []) {
//       const qtyAbs = Math.abs(line.qty);

//       // Stock Ledger (now scoped by SalesRep)
//       await postLedger({
//         item: line.item,
//         branch: String(grn.branch),
//         salesRep: String(grn.salesRep),
//         transactionType: "purchase",
//         refModel: "GRN",
//         refId: grn._id,
//         qty: qtyAbs,
//         avgCostBase: line.avgCostBase,
//         itemTotalValue: line.itemTotalValue,
//         session,
//       });

//       // Purchase Ledger (now scoped by SalesRep)
//       await postPurchaseLedger({
//         item: line.item,
//         branch: String(grn.branch),
//         supplier: grn.supplier,
//         salesRep: String(grn.salesRep),
//         transactionType: "purchase",
//         refModel: "GRN",
//         refId: grn._id,
//         qty: qtyAbs,
//         avgCostBase: line.avgCostBase,
//         totalCostValue: line.itemTotalValue,
//         createdBy: userId,
//         session,
//       });

//       // Update SalesRepStock qty
//       await SalesRepStock.findOneAndUpdate(
//         { salesRep: grn.salesRep, item: line.item },
//         { $inc: { qtyOnHand: qtyAbs } },
//         { upsert: true, new: true, session }
//       );
//     }

//     await grn.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return grn.toObject();
//   } catch (err) {
//     logger.error("approveGRN() failed", { grnId: id, error: err });
//     try {
//       if (session.inTransaction()) await session.abortTransaction();
//     } finally {
//       session.endSession();
//     }
//     throw err;
//   }
// }


// // -------------------- UPDATE GRN (all can, SalesRep only own) --------------------
// async function updateGRN(id, payload, actor) {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const grn = await GRN.findById(id).session(session);
//     if (!grn) throw new Error("GRN not found");
//     if (grn.status !== "waiting_for_approval") throw new Error("Only waiting_for_approval can be updated");

//     // ✅ SalesRep can only update own
//     if (isSalesRepActor(actor) && String(grn.salesRep) !== String(actor.actorId)) {
//       throw new Error("Forbidden");
//     }

//     const {
//       supplier,
//       supplierInvoiceNo,
//       supplierInvoiceDate,
//       receivedDate,
//       branch,
//       items: rawItems,
//       salesRep: salesRepFromBody, // only User can change
//     } = payload;

//     // Validate branch
//     const branchDoc = await Branch.findById(branch).lean();
//     if (!branchDoc) throw new Error("Invalid branch selected");

//     // supplier relink if changed
//     const prevSupplier = String(grn.supplier);
//     const nextSupplier = supplier ? String(supplier) : prevSupplier;

//     // salesRep change only by User actor
//     const prevSalesRep = String(grn.salesRep);
//     let nextSalesRep = prevSalesRep;

//     if (isUserActor(actor) && salesRepFromBody) {
//       nextSalesRep = String(salesRepFromBody);
//       await assertSalesRepExists(nextSalesRep, session);
//     }
//     if (isSalesRepActor(actor)) {
//       // force keep ownership
//       nextSalesRep = String(actor.actorId);
//     }

//     // Prepare updated items
//     const items = [];
//     for (const line of rawItems || []) {
//       const itemId = new mongoose.Types.ObjectId(line.item?._id || line.item);
//       const qty = Number(line.qty);
//       const avgCostBase = Number(line.avgCostBase) || 0;

//       const discountPerUnit = Number(line.discountPerUnit || 0);
//       const itemTotalValue = qty * (avgCostBase - discountPerUnit); // Apply discount here

//       if (qty <= 0 || avgCostBase <= 0) throw new Error(`Invalid qty or cost for item ${itemId}`);
//       items.push({ item: itemId, qty, avgCostBase, discountPerUnit, itemTotalValue });
//     }

//     const totalValue = items.reduce((sum, i) => sum + i.itemTotalValue, 0);

//     // Update GRN fields
//     grn.supplier = nextSupplier;
//     grn.supplierInvoiceNo = supplierInvoiceNo || null;
//     grn.supplierInvoiceDate = supplierInvoiceDate || null;
//     grn.receivedDate = receivedDate;
//     grn.branch = branchDoc._id;
//     grn.items = items;
//     grn.totalValue = totalValue;
//     grn.salesRep = nextSalesRep;

//     await grn.save({ session });

//     // Maintain supplier.grns if supplier changed
//     if (prevSupplier !== nextSupplier) {
//       await Supplier.findByIdAndUpdate(prevSupplier, { $pull: { grns: grn._id } }, { session });
//       await Supplier.findByIdAndUpdate(nextSupplier, { $addToSet: { grns: grn._id } }, { session });
//     }

//     // Maintain salesRep.grns if salesRep changed
//     if (prevSalesRep !== nextSalesRep) {
//       await SalesRep.findByIdAndUpdate(prevSalesRep, { $pull: { grns: grn._id } }, { session });
//       await SalesRep.findByIdAndUpdate(nextSalesRep, { $addToSet: { grns: grn._id } }, { session });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     return grn.toObject();
//   } catch (err) {
//     logger.error("updateGRN() failed", { grnId: id, error: err });
//     try {
//       if (session.inTransaction()) await session.abortTransaction();
//     } finally {
//       session.endSession();
//     }
//     throw err;
//   }
// }

// // -------------------- DELETE GRN (all can, SalesRep only own) --------------------
// async function deleteGRN(id, actor) {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const grn = await GRN.findById(id).session(session);
//     if (!grn) throw new Error("GRN not found");
//     if (grn.status !== "waiting_for_approval") throw new Error("Only waiting_for_approval can be deleted");

//     // SalesRep can only delete own
//     if (isSalesRepActor(actor) && String(grn.salesRep) !== String(actor.actorId)) {
//       throw new Error("Forbidden");
//     }

//     // unlink from Supplier
//     if (grn.supplier) {
//       await Supplier.findByIdAndUpdate(grn.supplier, { $pull: { grns: grn._id } }, { session });
//     }

//     // unlink from SalesRep
//     if (grn.salesRep) {
//       await SalesRep.findByIdAndUpdate(grn.salesRep, { $pull: { grns: grn._id } }, { session });
//     }

//     await GRN.deleteOne({ _id: id }).session(session);

//     await session.commitTransaction();
//     session.endSession(); 
//     return { success: true, deletedId: id, grnNo: grn.grnNo };
//   } catch (err) {
//     logger.error("deleteGRN() failed", { grnId: id, error: err });
//     try {
//       if (session.inTransaction()) await session.abortTransaction();
//     } finally {
//       session.endSession();
//     }
//     throw err;
//   }
// }

// module.exports = {
//   createGRN,
//   getGRN,
//   listGRN,
//   getGRNSummary,
//   approveGRN,
//   updateGRN,
//   deleteGRN,
// };






const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");

const GRN = require("../../models/purchases/grn.model.js");
const Item = require("../../models/inventory/item.model.js");
const Supplier = require("../../models/user/supplier.model.js");
const Branch = require("../../models/inventorySettings/branch.model.js");
const SalesRep = require("../../models/user/salesRep.model.js");
const SalesRepStock = require("../../models/inventory/salesRepStock.model.js");

const { postLedger } = require("../ledger/stockLedger.service.js");
const { postPurchaseLedger } = require("../ledger/purchaseLedger.service.js");

// ---------- helpers ----------
function isUserActor(actor) {
  return actor?.actorType === "User"; // Admin/DataEntry
}

function isSalesRepActor(actor) {
  return actor?.actorType === "SalesRep";
}

async function assertSalesRepExists(salesRepId, session) {
  const q = SalesRep.findById(salesRepId).lean();
  if (session) q.session(session);
  const rep = await q;
  if (!rep) throw new Error("Invalid SalesRep");
  if (rep.status && rep.status !== "active") throw new Error("SalesRep is inactive");
  return rep;
}

// -------------------- CREATE GRN --------------------
async function createGRN(payload, actor) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      grnNo,
      supplier,
      supplierInvoiceNo = null,
      supplierInvoiceDate = null,
      items: rawItems,
      receivedDate,
      branch: branchId,
      salesRep: salesRepFromBody, // required for User actor
    } = payload;

    logger.info("createGRN() called", { grnNo, supplier, branchId, receivedDate, actor });

    // Validate branch
    const branchDoc = await Branch.findById(branchId).lean();
    if (!branchDoc) throw new Error("Invalid branch selected");

    // Determine SalesRep owner
    let salesRepId = null;

    if (isSalesRepActor(actor)) {
      salesRepId = actor.actorId;
    } else if (isUserActor(actor)) {
      if (!salesRepFromBody) throw new Error("salesRep is required when Admin/DataEntry creates a GRN");
      salesRepId = salesRepFromBody;
    } else {
      throw new Error("Unauthorized actor");
    }

    await assertSalesRepExists(salesRepId, session);

    // -------------------- PREPARE ITEMS --------------------
    const items = [];
    for (const line of rawItems || []) {
      const rawItemRef = line.item;
      const itemId = new mongoose.Types.ObjectId(
        rawItemRef && rawItemRef._id ? rawItemRef._id : rawItemRef
      );

      let avgCostBase = Number(line.avgCostBase) || null;
      let avgCostPrimary = Number(line.avgCostPrimary) || null;
      let factorToBase = Number(line.factorToBase) || 1;

      const itemDoc = await Item.findById(itemId)
        .select("avgCostBase avgCostPrimary sellingPriceBase sellingPricePrimary")
        .lean();
      if (!itemDoc) throw new Error(`Item not found: ${rawItemRef}`);

      // Fallback to database values if not provided by the user
      avgCostBase = avgCostBase !== null ? avgCostBase : itemDoc.avgCostBase || 0; // Use 0 if still null
      avgCostPrimary = avgCostPrimary !== null ? avgCostPrimary : itemDoc.avgCostPrimary || 0; // Use 0 if still null

      // Handle selling prices with fallback logic
      let sellingPriceBase = line.sellingPriceBase !== undefined ? line.sellingPriceBase : itemDoc.sellingPriceBase || 0;
      let sellingPricePrimary = line.sellingPricePrimary !== undefined ? line.sellingPricePrimary : itemDoc.sellingPricePrimary || 0;

      const primaryQty = Number(line.primaryQty);
      const baseQty = Number(line.baseQty);

      if (primaryQty < 0 || isNaN(primaryQty)) {
        throw new Error(`Invalid primary quantity for item ${line.item}`);
      }

      if (baseQty < 0 || isNaN(baseQty)) {
        throw new Error(`Invalid base quantity for item ${line.item}`);
      }

      // No conversion needed, just store as received
      const qtyReceivedPrimary = primaryQty;
      const qtyReceivedBase = baseQty;

      // Calculate itemTotalValue as per the new formula
      const itemTotalValue =
        qtyReceivedBase * avgCostBase + qtyReceivedPrimary * avgCostPrimary;

      // Calculate stock values (used later at approval time)
      const stockValuePrimary = qtyReceivedPrimary * avgCostPrimary;
      const stockValueBase = qtyReceivedBase * avgCostBase;

      items.push({
        item: itemId,
        avgCostBase,
        avgCostPrimary,
        factorToBase,
        primaryQty: qtyReceivedPrimary, // Store primaryQty received
        baseQty: qtyReceivedBase,       // Store baseQty received
        sellingPriceBase,               // Store sellingPriceBase in the GRN item
        sellingPricePrimary,            // Store sellingPricePrimary in the GRN item
        itemTotalValue,
        stockValuePrimary,              // value contribution in primary UOM
        stockValueBase,                 // value contribution in base UOM
        discountPerUnit: Number(line.discountPerUnit || 0),
      });
    }

    const totalValue = items.reduce((sum, i) => sum + i.itemTotalValue, 0);

    // -------------------- CREATE GRN --------------------
    const [grn] = await GRN.create(
      [
        {
          grnNo,
          supplier,
          supplierInvoiceNo,
          supplierInvoiceDate,
          branch: branchDoc._id,
          salesRep: salesRepId,
          createdByModel: isUserActor(actor) ? "User" : "SalesRep",
          createdBy: actor.actorId,
          items,
          totalValue,
          receivedDate,
          status: "waiting_for_approval",
        },
      ],
      { session }
    );

    await Supplier.findByIdAndUpdate(
      supplier,
      { $addToSet: { grns: grn._id } },
      { session }
    );
    await SalesRep.findByIdAndUpdate(
      salesRepId,
      { $addToSet: { grns: grn._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return grn.toObject();
  } catch (err) {
    logger.error("createGRN() failed", err);
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } finally {
      session.endSession();
    }
    throw err;
  }
}

// -------------------- APPROVE GRN (User only) --------------------
async function approveGRN(id, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const grn = await GRN.findById(id).session(session);
    if (!grn) throw new Error("GRN not found");
    if (grn.status !== "waiting_for_approval")
      throw new Error("Only waiting_for_approval can be approved");

    grn.status = "approved";
    grn.approvedBy = userId;
    grn.approvedAt = new Date();

    for (const line of grn.items || []) {
      // Fetch the item from the database to get selling prices and cost information
      const itemDoc = await Item.findById(line.item)
        .select("sellingPriceBase sellingPricePrimary avgCostBase avgCostPrimary")
        .lean();
      if (!itemDoc) throw new Error(`Item not found: ${line.item}`);

      // Fallback logic for sellingPriceBase and sellingPricePrimary
      const sellingPriceBase = line.sellingPriceBase !== undefined
        ? line.sellingPriceBase
        : itemDoc.sellingPriceBase || 0;  // Use database value if missing
      const sellingPricePrimary = line.sellingPricePrimary !== undefined
        ? line.sellingPricePrimary
        : itemDoc.sellingPricePrimary || 0;  // Use database value if missing

      // Log for debugging (optional)
      console.log('sellingPriceBase:', sellingPriceBase);
      console.log('sellingPricePrimary:', sellingPricePrimary);

      // Stock Ledger (now scoped by SalesRep)
      await postLedger({
        item: line.item,
        branch: String(grn.branch),
        salesRep: String(grn.salesRep),
        transactionType: "purchase",
        refModel: "GRN",
        refId: grn._id,
        avgCostBase: line.avgCostBase,
        avgCostPrimary: line.avgCostPrimary, // Storing avgCostPrimary in ledger
        factorToBase: line.factorToBase,     // Storing factorToBase
        primaryQty: line.primaryQty,           // Storing primaryQty
        baseQty: line.baseQty,               // Storing baseQty
        sellingPriceBase,                    // Storing sellingPriceBase in ledger
        sellingPricePrimary,                 // Storing sellingPricePrimary in ledger
        itemTotalValue: line.itemTotalValue,
        session,
      });

      // Purchase Ledger (now scoped by SalesRep)
      await postPurchaseLedger({
        item: line.item,
        branch: String(grn.branch),
        supplier: grn.supplier,
        salesRep: String(grn.salesRep),
        transactionType: "purchase",
        refModel: "GRN",
        refId: grn._id,
        avgCostBase: line.avgCostBase,
        avgCostPrimary: line.avgCostPrimary, // Storing avgCostPrimary in ledger
        factorToBase: line.factorToBase,     // Storing factorToBase
        primaryQty: line.primaryQty,         // Storing primaryQty
        baseQty: line.baseQty,               // Storing baseQty
        totalCostValue: line.itemTotalValue,
        createdBy: userId,
        session,
      });

      // ✅ Option A:
      // Update SalesRepStock ONLY at approval time
      // and make stock values cumulative using $inc.
const stockValuePrimary =
  (line.primaryQty || 0) * (line.avgCostPrimary || 0);

const stockValueBase =
  (line.baseQty || 0) * (line.avgCostBase || 0);

await SalesRepStock.findOneAndUpdate(
  { salesRep: grn.salesRep, item: line.item },
  {
    $inc: {
      qtyOnHandPrimary: line.primaryQty || 0,
      qtyOnHandBase: line.baseQty || 0,
      stockValuePrimary,
      stockValueBase,
    },
    $set: {
      factorToBase: line.factorToBase,
    },
  },
  { upsert: true, new: true, session }
);

    }

    await grn.save({ session });

    await session.commitTransaction();
    session.endSession();

    return grn.toObject();
  } catch (err) {
    logger.error("approveGRN() failed", { grnId: id, error: err });
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } finally {
      session.endSession();
    }
    throw err;
  }
}


// -------------------- UPDATE GRN (all can, SalesRep only own) --------------------
async function updateGRN(id, payload, actor) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const grn = await GRN.findById(id).session(session);
    if (!grn) throw new Error("GRN not found");
    if (grn.status !== "waiting_for_approval")
      throw new Error("Only waiting_for_approval can be updated");

    // ✅ SalesRep can only update own
    if (isSalesRepActor(actor) && String(grn.salesRep) !== String(actor.actorId)) {
      throw new Error("Forbidden");
    }

    const {
      supplier,
      supplierInvoiceNo,
      supplierInvoiceDate,
      receivedDate,
      branch,
      items: rawItems,
      salesRep: salesRepFromBody, // only User can change
    } = payload;

    // Validate branch
    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new Error("Invalid branch selected");

    // supplier relink if changed
    const prevSupplier = String(grn.supplier);
    const nextSupplier = supplier ? String(supplier) : prevSupplier;

    // salesRep change only by User actor
    const prevSalesRep = String(grn.salesRep);
    let nextSalesRep = prevSalesRep;

    if (isUserActor(actor) && salesRepFromBody) {
      nextSalesRep = String(salesRepFromBody);
      await assertSalesRepExists(nextSalesRep, session);
    }
    if (isSalesRepActor(actor)) {
      // force keep ownership
      nextSalesRep = String(actor.actorId);
    }

    // Prepare updated items
    const items = [];
    for (const line of rawItems || []) {
      const itemId = new mongoose.Types.ObjectId(line.item?._id || line.item);

      // Get item costs
      let avgCostBase = Number(line.avgCostBase) || 0;
      let avgCostPrimary = Number(line.avgCostPrimary) || 0;
      let factorToBase = Number(line.factorToBase) || 1;

      const itemDoc = await Item.findById(itemId)
        .select("avgCostBase avgCostPrimary")
        .lean();
      if (!itemDoc) throw new Error(`Item not found: ${line.item}`);

      // If avgCostBase is not provided, use the database's avgCostBase value
      if (!avgCostBase) avgCostBase = itemDoc.avgCostBase || 0;

      // If avgCostPrimary is not provided, use the database's avgCostPrimary value
      if (!avgCostPrimary) avgCostPrimary = itemDoc.avgCostPrimary || 0;

      const primaryQty = Number(line.primaryQty);
      const baseQty = Number(line.baseQty);

      if (primaryQty < 0 || isNaN(primaryQty)) {
        throw new Error(`Invalid primary quantity for item ${line.item}`);
      }

      if (baseQty < 0 || isNaN(baseQty)) {
        throw new Error(`Invalid base quantity for item ${line.item}`);
      }

      // No conversion needed, just store as received
      const qtyReceivedPrimary = primaryQty;
      const qtyReceivedBase = baseQty;

      // Calculate itemTotalValue as per the new formula
      const itemTotalValue =
        qtyReceivedBase * avgCostBase + qtyReceivedPrimary * avgCostPrimary;

      const stockValuePrimary = qtyReceivedPrimary * avgCostPrimary;
      const stockValueBase = qtyReceivedBase * avgCostBase;

      items.push({
        item: itemId,
        avgCostBase,
        avgCostPrimary,
        factorToBase,
        primaryQty: qtyReceivedPrimary,
        baseQty: qtyReceivedBase,
        itemTotalValue,
        stockValuePrimary,
        stockValueBase,
        discountPerUnit: Number(line.discountPerUnit || 0),
      });
    }

    const totalValue = items.reduce((sum, i) => sum + i.itemTotalValue, 0);

    // Update GRN fields
    grn.supplier = nextSupplier;
    grn.supplierInvoiceNo = supplierInvoiceNo || null;
    grn.supplierInvoiceDate = supplierInvoiceDate || null;
    grn.receivedDate = receivedDate;
    grn.branch = branchDoc._id;
    grn.items = items;
    grn.totalValue = totalValue;
    grn.salesRep = nextSalesRep;

    await grn.save({ session });

    // Maintain supplier.grns if supplier changed
    if (prevSupplier !== nextSupplier) {
      await Supplier.findByIdAndUpdate(
        prevSupplier,
        { $pull: { grns: grn._id } },
        { session }
      );
      await Supplier.findByIdAndUpdate(
        nextSupplier,
        { $addToSet: { grns: grn._id } },
        { session }
      );
    }

    // Maintain salesRep.grns if salesRep changed
    if (prevSalesRep !== nextSalesRep) {
      await SalesRep.findByIdAndUpdate(
        prevSalesRep,
        { $pull: { grns: grn._id } },
        { session }
      );
      await SalesRep.findByIdAndUpdate(
        nextSalesRep,
        { $addToSet: { grns: grn._id } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return grn.toObject();
  } catch (err) {
    logger.error("updateGRN() failed", { grnId: id, error: err });
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } finally {
      session.endSession();
    }
    throw err;
  }
}

// -------------------- READ GRN --------------------
async function getGRN(id) {
  return GRN.findById(id)
    .populate("supplier", "name supplierCode")
    .populate("branch", "name branchCode")
    .populate("salesRep", "repCode name")
    .populate("items.item", "itemCode name brand productType baseUnit")
    .lean();
}

// -------------------- LIST GRNs --------------------
async function listGRN(query = {}, options = {}) {
  console.log("🔥 MONGO QUERY:", JSON.stringify(query));
  const limit = options.limit || 100;

  return GRN.find(query)
    .sort({ receivedDate: -1 })
    .limit(limit)
    .populate("branch", "name branchCode")
    .populate("supplier", "name supplierCode contactNumber")
    .populate("salesRep", "repCode name")
    .lean();
}

// -------------------- DELETE GRN (all can, SalesRep only own) --------------------
async function deleteGRN(id, actor) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const grn = await GRN.findById(id).session(session);
    if (!grn) throw new Error("GRN not found");
    if (grn.status !== "waiting_for_approval")
      throw new Error("Only waiting_for_approval can be deleted");

    // SalesRep can only delete own
    if (isSalesRepActor(actor) && String(grn.salesRep) !== String(actor.actorId)) {
      throw new Error("Forbidden");
    }

    // unlink from Supplier
    if (grn.supplier) {
      await Supplier.findByIdAndUpdate(
        grn.supplier,
        { $pull: { grns: grn._id } },
        { session }
      );
    }

    // unlink from SalesRep
    if (grn.salesRep) {
      await SalesRep.findByIdAndUpdate(
        grn.salesRep,
        { $pull: { grns: grn._id } },
        { session }
      );
    }

    await GRN.deleteOne({ _id: id }).session(session);

    await session.commitTransaction();
    session.endSession();
    return { success: true, deletedId: id, grnNo: grn.grnNo };
  } catch (err) {
    logger.error("deleteGRN() failed", { grnId: id, error: err });
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } finally {
      session.endSession();
    }
    throw err;
  }
}

// -------------------- SUMMARY --------------------
async function getGRNSummary() {
  const agg = await GRN.aggregate([
    {
      $lookup: {
        from: "branches",
        localField: "branch",
        foreignField: "_id",
        as: "branchInfo",
      },
    },
    { $unwind: "$branchInfo" },
    {
      $lookup: {
        from: "suppliers",
        localField: "supplier",
        foreignField: "_id",
        as: "supplierInfo",
      },
    },
    { $unwind: "$supplierInfo" },
    {
      $group: {
        _id: {
          branch: "$branchInfo.name",
          supplier: "$supplierInfo.name",
          year: { $year: "$receivedDate" },
          month: { $month: "$receivedDate" },
        },
        totalGRNs: { $sum: 1 },
        totalValue: { $sum: "$totalValue" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  return agg;
}

module.exports = {
  createGRN,
  getGRN,
  listGRN,
  getGRNSummary,
  approveGRN,
  updateGRN,
  deleteGRN,
};
