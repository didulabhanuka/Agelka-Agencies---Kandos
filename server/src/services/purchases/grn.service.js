// services/purchases/grn.service.js
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

// Check whether the actor is an internal user (Admin/DataEntry).
function isUserActor(actor) {
  return actor?.actorType === "User";
}

// Check whether the actor is a sales rep.
function isSalesRepActor(actor) {
  return actor?.actorType === "SalesRep";
}

// Validate that a sales rep exists and is active before assigning ownership.
async function assertSalesRepExists(salesRepId, session) {
  const q = SalesRep.findById(salesRepId).lean();
  if (session) q.session(session);
  const rep = await q;
  if (!rep) throw new Error("Invalid SalesRep");
  if (rep.status && rep.status !== "active") throw new Error("SalesRep is inactive");
  return rep;
}

// Create a pending GRN, resolve item pricing fallbacks, and link it to supplier/sales rep.
async function createGRN(payload, actor) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { grnNo, supplier, supplierInvoiceNo = null, supplierInvoiceDate = null, items: rawItems, receivedDate, branch: branchId, salesRep: salesRepFromBody } = payload;
    logger.info("createGRN() called", { grnNo, supplier, branchId, receivedDate, actor });

    const branchDoc = await Branch.findById(branchId).lean();
    if (!branchDoc) throw new Error("Invalid branch selected");

    let salesRepId = null;
    if (isSalesRepActor(actor)) salesRepId = actor.actorId;
    else if (isUserActor(actor)) {
      if (!salesRepFromBody) throw new Error("salesRep is required when Admin/DataEntry creates a GRN");
      salesRepId = salesRepFromBody;
    } else throw new Error("Unauthorized actor");

    await assertSalesRepExists(salesRepId, session);

    const items = [];
    for (const line of rawItems || []) {
      const rawItemRef = line.item;
      const itemId = new mongoose.Types.ObjectId(rawItemRef && rawItemRef._id ? rawItemRef._id : rawItemRef);

      let avgCostBase = Number(line.avgCostBase) || null;
      let avgCostPrimary = Number(line.avgCostPrimary) || null;
      let factorToBase = Number(line.factorToBase) || 1;

      const itemDoc = await Item.findById(itemId).select("avgCostBase avgCostPrimary sellingPriceBase sellingPricePrimary").lean();
      if (!itemDoc) throw new Error(`Item not found: ${rawItemRef}`);

      avgCostBase = avgCostBase !== null ? avgCostBase : itemDoc.avgCostBase || 0;
      avgCostPrimary = avgCostPrimary !== null ? avgCostPrimary : itemDoc.avgCostPrimary || 0;

      const sellingPriceBase = line.sellingPriceBase !== undefined ? line.sellingPriceBase : itemDoc.sellingPriceBase || 0;
      const sellingPricePrimary = line.sellingPricePrimary !== undefined ? line.sellingPricePrimary : itemDoc.sellingPricePrimary || 0;

      const primaryQty = Number(line.primaryQty);
      const baseQty = Number(line.baseQty);

      if (primaryQty < 0 || Number.isNaN(primaryQty)) throw new Error(`Invalid primary quantity for item ${line.item}`);
      if (baseQty < 0 || Number.isNaN(baseQty)) throw new Error(`Invalid base quantity for item ${line.item}`);

      const qtyReceivedPrimary = primaryQty;
      const qtyReceivedBase = baseQty;
      const itemTotalValue = qtyReceivedBase * avgCostBase + qtyReceivedPrimary * avgCostPrimary;
      const stockValuePrimary = qtyReceivedPrimary * avgCostPrimary;
      const stockValueBase = qtyReceivedBase * avgCostBase;

      items.push({
        item: itemId,
        avgCostBase,
        avgCostPrimary,
        factorToBase,
        primaryQty: qtyReceivedPrimary,
        baseQty: qtyReceivedBase,
        sellingPriceBase,
        sellingPricePrimary,
        itemTotalValue,
        stockValuePrimary,
        stockValueBase,
        discountPerUnit: Number(line.discountPerUnit || 0),
      });
    }

    const totalValue = items.reduce((sum, i) => sum + i.itemTotalValue, 0);

    const [grn] = await GRN.create([{
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
    }], { session });

    await Supplier.findByIdAndUpdate(supplier, { $addToSet: { grns: grn._id } }, { session });
    await SalesRep.findByIdAndUpdate(salesRepId, { $addToSet: { grns: grn._id } }, { session });

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

// Approve a pending GRN, post stock/purchase ledgers, and increment sales-rep stock balances.
async function approveGRN(id, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const grn = await GRN.findById(id).session(session);
    if (!grn) throw new Error("GRN not found");
    if (grn.status !== "waiting_for_approval") throw new Error("Only waiting_for_approval can be approved");

    grn.status = "approved";
    grn.approvedBy = userId;
    grn.approvedAt = new Date();

    for (const line of grn.items || []) {
      const itemDoc = await Item.findById(line.item).select("sellingPriceBase sellingPricePrimary avgCostBase avgCostPrimary").lean();
      if (!itemDoc) throw new Error(`Item not found: ${line.item}`);

      const sellingPriceBase = line.sellingPriceBase !== undefined ? line.sellingPriceBase : itemDoc.sellingPriceBase || 0;
      const sellingPricePrimary = line.sellingPricePrimary !== undefined ? line.sellingPricePrimary : itemDoc.sellingPricePrimary || 0;

      await postLedger({
        item: line.item,
        branch: String(grn.branch),
        salesRep: String(grn.salesRep),
        transactionType: "purchase",
        refModel: "GRN",
        refId: grn._id,
        avgCostBase: line.avgCostBase,
        avgCostPrimary: line.avgCostPrimary,
        factorToBase: line.factorToBase,
        primaryQty: line.primaryQty,
        baseQty: line.baseQty,
        sellingPriceBase,
        sellingPricePrimary,
        itemTotalValue: line.itemTotalValue,
        session,
      });

      await postPurchaseLedger({
        item: line.item,
        branch: String(grn.branch),
        supplier: grn.supplier,
        salesRep: String(grn.salesRep),
        transactionType: "purchase",
        refModel: "GRN",
        refId: grn._id,
        avgCostBase: line.avgCostBase,
        avgCostPrimary: line.avgCostPrimary,
        factorToBase: line.factorToBase,
        primaryQty: line.primaryQty,
        baseQty: line.baseQty,
        totalCostValue: line.itemTotalValue,
        createdBy: userId,
        session,
      });

      const stockValuePrimary = (line.primaryQty || 0) * (line.avgCostPrimary || 0);
      const stockValueBase = (line.baseQty || 0) * (line.avgCostBase || 0);

      await SalesRepStock.findOneAndUpdate(
        { salesRep: grn.salesRep, item: line.item },
        {
          $inc: {
            qtyOnHandPrimary: line.primaryQty || 0,
            qtyOnHandBase: line.baseQty || 0,
            stockValuePrimary,
            stockValueBase,
          },
          $set: { factorToBase: line.factorToBase },
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

// Update a pending GRN, re-prepare item values, and maintain supplier/sales-rep relationships.
async function updateGRN(id, payload, actor) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const grn = await GRN.findById(id).session(session);
    if (!grn) throw new Error("GRN not found");
    if (grn.status !== "waiting_for_approval") throw new Error("Only waiting_for_approval can be updated");
    if (isSalesRepActor(actor) && String(grn.salesRep) !== String(actor.actorId)) throw new Error("Forbidden");

    const { supplier, supplierInvoiceNo, supplierInvoiceDate, receivedDate, branch, items: rawItems, salesRep: salesRepFromBody } = payload;

    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw new Error("Invalid branch selected");

    const prevSupplier = String(grn.supplier);
    const nextSupplier = supplier ? String(supplier) : prevSupplier;

    const prevSalesRep = String(grn.salesRep);
    let nextSalesRep = prevSalesRep;

    if (isUserActor(actor) && salesRepFromBody) {
      nextSalesRep = String(salesRepFromBody);
      await assertSalesRepExists(nextSalesRep, session);
    }
    if (isSalesRepActor(actor)) nextSalesRep = String(actor.actorId);

    const items = [];
    for (const line of rawItems || []) {
      const itemId = new mongoose.Types.ObjectId(line.item?._id || line.item);

      let avgCostBase = Number(line.avgCostBase) || 0;
      let avgCostPrimary = Number(line.avgCostPrimary) || 0;
      const factorToBase = Number(line.factorToBase) || 1;

      const itemDoc = await Item.findById(itemId).select("avgCostBase avgCostPrimary").lean();
      if (!itemDoc) throw new Error(`Item not found: ${line.item}`);

      if (!avgCostBase) avgCostBase = itemDoc.avgCostBase || 0;
      if (!avgCostPrimary) avgCostPrimary = itemDoc.avgCostPrimary || 0;

      const primaryQty = Number(line.primaryQty);
      const baseQty = Number(line.baseQty);

      if (primaryQty < 0 || Number.isNaN(primaryQty)) throw new Error(`Invalid primary quantity for item ${line.item}`);
      if (baseQty < 0 || Number.isNaN(baseQty)) throw new Error(`Invalid base quantity for item ${line.item}`);

      const qtyReceivedPrimary = primaryQty;
      const qtyReceivedBase = baseQty;
      const itemTotalValue = qtyReceivedBase * avgCostBase + qtyReceivedPrimary * avgCostPrimary;
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

    grn.supplier = nextSupplier;
    grn.supplierInvoiceNo = supplierInvoiceNo || null;
    grn.supplierInvoiceDate = supplierInvoiceDate || null;
    grn.receivedDate = receivedDate;
    grn.branch = branchDoc._id;
    grn.items = items;
    grn.totalValue = totalValue;
    grn.salesRep = nextSalesRep;

    await grn.save({ session });

    if (prevSupplier !== nextSupplier) {
      await Supplier.findByIdAndUpdate(prevSupplier, { $pull: { grns: grn._id } }, { session });
      await Supplier.findByIdAndUpdate(nextSupplier, { $addToSet: { grns: grn._id } }, { session });
    }

    if (prevSalesRep !== nextSalesRep) {
      await SalesRep.findByIdAndUpdate(prevSalesRep, { $pull: { grns: grn._id } }, { session });
      await SalesRep.findByIdAndUpdate(nextSalesRep, { $addToSet: { grns: grn._id } }, { session });
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

// Get a GRN by ID with supplier, branch, sales rep, and item details populated.
async function getGRN(id) {
  return GRN.findById(id)
    .populate("supplier", "name supplierCode")
    .populate("branch", "name branchCode")
    .populate("salesRep", "repCode name")
    .populate("items.item", "itemCode name brand productType primaryUom primaryUnit baseUom baseUnit factorToBase")
    .lean();
}

// List GRNs with optional query filters and basic related entities populated.
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

// Delete a pending GRN, enforcing sales-rep ownership and unlinking related references.
async function deleteGRN(id, actor) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const grn = await GRN.findById(id).session(session);
    if (!grn) throw new Error("GRN not found");
    if (grn.status !== "waiting_for_approval") throw new Error("Only waiting_for_approval can be deleted");
    if (isSalesRepActor(actor) && String(grn.salesRep) !== String(actor.actorId)) throw new Error("Forbidden");

    if (grn.supplier) await Supplier.findByIdAndUpdate(grn.supplier, { $pull: { grns: grn._id } }, { session });
    if (grn.salesRep) await SalesRep.findByIdAndUpdate(grn.salesRep, { $pull: { grns: grn._id } }, { session });

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

// Aggregate GRN totals by branch, supplier, and received month for summary reporting.
async function getGRNSummary() {
  const agg = await GRN.aggregate([
    { $lookup: { from: "branches", localField: "branch", foreignField: "_id", as: "branchInfo" } },
    { $unwind: "$branchInfo" },
    { $lookup: { from: "suppliers", localField: "supplier", foreignField: "_id", as: "supplierInfo" } },
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

module.exports = { createGRN, getGRN, listGRN, getGRNSummary, approveGRN, updateGRN, deleteGRN };