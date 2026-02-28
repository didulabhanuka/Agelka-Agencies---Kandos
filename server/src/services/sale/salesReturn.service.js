// services/sale/salesReturn.service.js
const mongoose = require("mongoose");
const SalesReturn = require("../../models/sale/SalesReturn.model");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const Branch = require("../../models/inventorySettings/branch.model");
const Item = require("../../models/inventory/item.model");
const Customer = require("../../models/user/customer.model");
const SalesRepStock = require("../../models/inventory/salesRepStock.model");
const { getInvoice } = require("./salesInvoice.service");
const { postStockReturnLedger } = require("../ledger/stockLedger.service");
const { postSalesReturnLedger } = require("../ledger/salesLedger.service");
const { calcBaseQty, splitToPrimaryBase, computeIssueMovement } = require("../../utils/uomMath");

// Convert a value to ObjectId.
function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

// Convert a value to finite number with 0 fallback.
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Create a sales return in pending state with invoice-aware quantity and pricing validation.
async function createSalesReturn(payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { returnNo, originalInvoice = null, customer, branch, salesRep = null, items: rawItems, returnDate, remarks = "" } = payload;

    const branchDoc = await Branch.findById(branch).session(session).lean();
    if (!branchDoc) throw new Error("Invalid branch selected");

    const customerDoc = await Customer.findById(customer).session(session).lean();
    if (!customerDoc) throw new Error("Customer not found");

    let invoice = null;
    let invoiceSalesRep = null;
    let invoiceItemFactorMap = new Map();

    if (originalInvoice) {
      invoice = await SalesInvoice.findById(originalInvoice).select("salesRep invoiceNo totalValue totalReturnedValue totalBalanceValue items hasReturns returns invoiceDate customer branch status").session(session).lean();
      if (!invoice) throw new Error("Original invoice not found");

      invoiceSalesRep = invoice.salesRep ? String(invoice.salesRep) : null;
      for (const line of invoice.items || []) {
        const itemIdStr = String(line.item?._id || line.item);
        const factor = Number(line.factorToBase || 0);
        if (factor > 0) invoiceItemFactorMap.set(itemIdStr, factor);
      }
    }

    const finalSalesRep = originalInvoice ? invoiceSalesRep : salesRep ? String(salesRep) : null;

    const items = (rawItems || []).map((line) => {
      const itemId = toObjectId(line.item?._id || line.item);
      const itemIdStr = String(itemId);

      const qtyReturnPrimary = toNumber(line.qtyReturnPrimary || 0);
      const qtyReturnBase = toNumber(line.qtyReturnBase || 0);

      const rawSellingPriceBase = line.sellingPriceBase;
      const rawSellingPricePrimary = line.sellingPricePrimary;

      let sellingPriceBase = rawSellingPriceBase == null ? null : toNumber(rawSellingPriceBase);
      let sellingPricePrimary = rawSellingPricePrimary == null ? null : toNumber(rawSellingPricePrimary);

      // Fix for primary-only items: set sellingPriceBase to 0 for primary-only items
      if (qtyReturnBase === 0 && sellingPriceBase === null) {
        sellingPriceBase = 0;  // Default to 0 for primary-only items
      }

      let factorToBase = invoiceItemFactorMap.get(itemIdStr) ?? line.factorToBase ?? 1;
      factorToBase = toNumber(factorToBase) || 1;

      if (qtyReturnPrimary < 0 || qtyReturnBase < 0) throw new Error(`Invalid return quantity (negative) for item ${line.item}`);
      if (qtyReturnPrimary === 0 && qtyReturnBase === 0) throw new Error(`At least one return quantity must be > 0 for item ${line.item}`);
      if (qtyReturnBase > 0 && (!sellingPriceBase || sellingPriceBase <= 0)) throw new Error(`Invalid base selling price for item ${line.item} (qtyReturnBase > 0)`);
      if (qtyReturnPrimary > 0 && (!sellingPricePrimary || sellingPricePrimary <= 0)) throw new Error(`Invalid primary selling price for item ${line.item} (qtyReturnPrimary > 0)`);

      const discountPerUnit = line.discountPerUnit == null ? 0 : toNumber(line.discountPerUnit);
      if (discountPerUnit < 0) throw new Error(`Invalid discount for item ${line.item}`);
      if ((qtyReturnBase > 0 && sellingPriceBase != null && discountPerUnit > sellingPriceBase) || (qtyReturnPrimary > 0 && sellingPricePrimary != null && discountPerUnit > sellingPricePrimary)) throw new Error(`Discount cannot exceed selling price for item ${line.item}`);

      const totalSellingValue = qtyReturnPrimary * (sellingPricePrimary ?? 0) + qtyReturnBase * (sellingPriceBase ?? 0);

      return { item: itemId, qtyReturnPrimary: Math.abs(qtyReturnPrimary), qtyReturnBase: Math.abs(qtyReturnBase), sellingPriceBase, sellingPricePrimary, factorToBase, discountPerUnit, totalSellingValue };
    });

    if (originalInvoice) {
      const invoiceWithRemaining = await getInvoice(originalInvoice, { salesRep: finalSalesRep });
      if (!invoiceWithRemaining) throw new Error("Original invoice not found");

      for (const line of items) {
        const remainingLine = (invoiceWithRemaining.remainingItems || []).find((i) => String(i.item) === String(line.item));
        if (!remainingLine) throw new Error(`Item ${line.item} not found in original invoice`);

        const factorToBase = toNumber(line.factorToBase) || 1;
        const returnedTotalBase = toNumber(line.qtyReturnPrimary) * factorToBase + toNumber(line.qtyReturnBase);
        const remainingTotalBase = toNumber(remainingLine.remainingPrimaryQty) * factorToBase + toNumber(remainingLine.remainingBaseQty);

        if (returnedTotalBase <= 0) throw new Error(`Returned quantity must be greater than zero for item ${line.item}`);
        if (returnedTotalBase > remainingTotalBase) throw new Error(`Return quantity exceeds remaining quantity for item ${line.item}`);
      }
    }

    const totalReturnValue = items.reduce((sum, i) => sum + toNumber(i.totalSellingValue), 0);

    const [doc] = await SalesReturn.create([{
      returnNo,
      salesRep: finalSalesRep ? toObjectId(finalSalesRep) : null,
      originalInvoice: originalInvoice || null,
      customer,
      branch: branchDoc._id,
      items,
      totalReturnValue,
      returnDate,
      remarks,
      status: "waiting_for_approval",
    }], { session });

    await Customer.findByIdAndUpdate(customer, { $addToSet: { returns: doc._id } }, { session });

    await session.commitTransaction();
    session.endSession();
    return doc.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Approve a pending sales return, post ledgers, update stock, and link return details to the original invoice.
async function approveSalesReturn(id, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const doc = await SalesReturn.findById(id).session(session);
    if (!doc) throw new Error("SalesReturn not found");
    if (doc.status !== "waiting_for_approval") throw new Error("SalesReturn not in waiting_for_approval status");

    doc.status = "approved";
    doc.approvedBy = userId;
    doc.approvedAt = new Date();

    const branchId = String(doc.branch);
    const salesRepId = doc.salesRep ? String(doc.salesRep) : null;

    for (const line of doc.items || []) {
      const primaryQty = Math.abs(toNumber(line.qtyReturnPrimary));
      const baseQty = Math.abs(toNumber(line.qtyReturnBase));
      if (!primaryQty && !baseQty) continue;

      const itemDoc = await Item.findById(line.item)
        .select("avgCostBase avgCostPrimary factorToBase")
        .session(session)
        .lean();
      if (!itemDoc) throw Object.assign(new Error(`Item not found: ${line.item}`), { status: 400 });

      const avgCostBase = toNumber(itemDoc.avgCostBase);
      const avgCostPrimary = toNumber(itemDoc.avgCostPrimary);
      const factorToBase = toNumber(line.factorToBase || itemDoc.factorToBase || 1);

      // ── Sales rep stock: ADD returned quantities back ────────────────────────
      // A sales return means the customer is returning goods TO the sales rep,
      // so the rep's on-hand stock must INCREASE by the returned amounts.
      // We must NOT use computeIssueMovement here — that subtracts stock.
      if (salesRepId) {
        const salesRepStock = await SalesRepStock.findOne({
          salesRep: salesRepId,
          item: line.item,
        })
          .session(session)
          .lean();

        if (!salesRepStock) {
          throw Object.assign(
            new Error(`SalesRep stock not found for item ${line.item}`),
            { status: 400, code: "STOCK_NOT_FOUND" }
          );
        }

        const currentPrimary = toNumber(salesRepStock.qtyOnHandPrimary || 0);
        const currentBase    = toNumber(salesRepStock.qtyOnHandBase    || 0);

        // ADD the returned qty back — customer is returning stock to the rep.
        const newPrimary = currentPrimary + primaryQty;
        const newBase    = currentBase    + baseQty;

        await SalesRepStock.findOneAndUpdate(
          { salesRep: salesRepId, item: line.item },
          {
            $set: {
              qtyOnHandPrimary:  newPrimary,
              qtyOnHandBase:     newBase,
              stockValuePrimary: newPrimary * avgCostPrimary,
              stockValueBase:    newBase    * avgCostBase,
              factorToBase,
            },
          },
          { new: true, session }
        );
      }
      // ────────────────────────────────────────────────────────────────────────

      const itemTotalValue = baseQty * avgCostBase + primaryQty * avgCostPrimary;

      await postStockReturnLedger({
        item: line.item,
        branch: branchId,
        salesRep: salesRepId,
        transactionType: "sales-return",
        refModel: "SalesReturn",
        refId: doc._id,
        sellingPriceBase: line.sellingPriceBase,
        sellingPricePrimary: line.sellingPricePrimary,
        avgCostBase,
        avgCostPrimary,
        factorToBase,
        primaryQty,
        baseQty,
        itemTotalValue,
        session,
      });

      await postSalesReturnLedger({
        item: line.item,
        branch: branchId,
        salesRep: salesRepId,
        customer: doc.customer,
        transactionType: "sales-return",
        refModel: "SalesReturn",
        refId: doc._id,
        sellingPriceBase: line.sellingPriceBase,
        sellingPricePrimary: line.sellingPricePrimary,
        factorToBase,
        primaryQty,
        baseQty,
        totalSellingValue: line.totalSellingValue,
        createdBy: userId,
        session,
      });
    }

    if (doc.originalInvoice) {
      const invoiceDoc = await SalesInvoice.findById(doc.originalInvoice).session(session);
      if (!invoiceDoc) throw new Error("Original invoice not found");

      for (const returnLine of doc.items || []) {
        const invoiceLine = (invoiceDoc.items || []).find(
          (invLine) => String(invLine.item) === String(returnLine.item)
        );
        if (!invoiceLine) throw new Error(`Returned item not found in original invoice: ${returnLine.item}`);

        const factorToBase = toNumber(invoiceLine.factorToBase || 1);
        const invoiceTotalBase =
          toNumber(invoiceLine.primaryQty || 0) * factorToBase + toNumber(invoiceLine.baseQty || 0);

        let alreadyReturnedBase = 0;
        for (const prevReturn of invoiceDoc.returns || []) {
          if (String(prevReturn.returnId) === String(doc._id)) continue;
          for (const prevItem of prevReturn.items || []) {
            if (String(prevItem.item) !== String(returnLine.item)) continue;
            alreadyReturnedBase +=
              toNumber(prevItem.qtyReturnedPrimary || 0) * factorToBase +
              toNumber(prevItem.qtyReturnedBase    || 0);
          }
        }

        const currentBaseReturn =
          toNumber(returnLine.qtyReturnPrimary || 0) * factorToBase +
          toNumber(returnLine.qtyReturnBase    || 0);

        if (currentBaseReturn <= 0) throw new Error(`Invalid return quantity for item ${returnLine.item}`);
        if (alreadyReturnedBase + currentBaseReturn > invoiceTotalBase)
          throw new Error(`Return exceeds invoice quantity for item ${returnLine.item}`);
      }

      invoiceDoc.hasReturns = true;
      invoiceDoc.returns = invoiceDoc.returns || [];

      const invoiceReturnItems = (doc.items || []).map((l) => {
        const primaryQty         = toNumber(l.qtyReturnPrimary  || 0);
        const baseQty            = toNumber(l.qtyReturnBase     || 0);
        const sellingPricePrimary = toNumber(l.sellingPricePrimary || 0);
        const sellingPriceBase    = toNumber(l.sellingPriceBase    || 0);

        return {
          item: l.item,
          qtyReturnedPrimary:   primaryQty,
          qtyReturnedBase:      baseQty,
          valueReturnedPrimary: primaryQty * sellingPricePrimary,
          valueReturnedBase:    baseQty    * sellingPriceBase,
          totalValueReturned:   primaryQty * sellingPricePrimary + baseQty * sellingPriceBase,
        };
      });

      invoiceDoc.returns.push({
        returnId: doc._id,
        returnNo: doc.returnNo,
        returnDate: doc.returnDate,
        totalReturnValue: doc.totalReturnValue,
        items: invoiceReturnItems,
      });

      invoiceDoc.totalReturnedValue = invoiceDoc.returns.reduce(
        (sum, r) => sum + toNumber(r.totalReturnValue),
        0
      );
      invoiceDoc.totalBalanceValue = Math.max(
        toNumber(invoiceDoc.totalValue) - toNumber(invoiceDoc.totalReturnedValue),
        0
      );

      await invoiceDoc.save({ session });
    }

    await doc.save({ session });
    await session.commitTransaction();
    session.endSession();
    return doc.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Get a single sales return with optional sales-rep scope.
async function getSalesReturn(id, scope = {}) {
  const q = { _id: id, ...(scope.salesRep ? { salesRep: toObjectId(scope.salesRep) } : {}) };

  return SalesReturn.findOne(q)
    .populate("customer", "name customerCode")
    .populate("branch", "name branchCode")
    .populate("salesRep", "repCode name")
    .populate("items.item", "itemCode name brand productType baseUnit")
    .populate("originalInvoice", "invoiceNo")
    .lean();
}

// List sales returns with filters and optional sales-rep scope.
async function listSalesReturns(filter = {}, options = {}, scope = {}) {
  const query = {};
  if (filter.customer) query.customer = filter.customer;
  if (filter.status) query.status = filter.status;
  if (filter.branch) query.branch = filter.branch;
  if (filter.originalInvoice) query.originalInvoice = filter.originalInvoice;
  if (scope.salesRep) query.salesRep = toObjectId(scope.salesRep);
  else if (filter.salesRep) query.salesRep = toObjectId(filter.salesRep);

  return SalesReturn.find(query)
    .sort({ returnDate: -1 })
    .limit(options.limit || 100)
    .populate("branch", "name branchCode")
    .populate("customer", "name customerCode")
    .populate("salesRep", "repCode name")
    .populate("originalInvoice", "invoiceNo")
    .lean();
}

// Delete a sales return if the status is not approved
async function deleteSalesReturn(id) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const doc = await SalesReturn.findById(id).session(session);
    if (!doc) throw new Error("SalesReturn not found");

    if (doc.status === "approved") {
      throw new Error("Cannot delete an approved sales return");
    }

    // Remove the sales return
    await doc.deleteOne({ session });

    // Update customer
    await Customer.findByIdAndUpdate(doc.customer, { $pull: { returns: doc._id } }, { session });

    await session.commitTransaction();
    session.endSession();
    return { message: "Sales return deleted successfully" };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Update a sales return if the status is not approved
async function updateSalesReturn(id, updatePayload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const doc = await SalesReturn.findById(id).session(session);
    if (!doc) throw new Error("SalesReturn not found");

    if (doc.status === "approved") {
      throw new Error("Cannot update an approved sales return");
    }

    // Update the sales return document
    for (const key in updatePayload) {
      if (updatePayload.hasOwnProperty(key)) {
        doc[key] = updatePayload[key];
      }
    }

    // Save the updated document
    await doc.save({ session });

    // Handle related customer updates
    if (updatePayload.items) {
      await Customer.findByIdAndUpdate(doc.customer, { $set: { returns: doc._id } }, { session });
    }

    await session.commitTransaction();
    session.endSession();
    return doc.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = { createSalesReturn, approveSalesReturn, getSalesReturn, listSalesReturns, deleteSalesReturn, updateSalesReturn };