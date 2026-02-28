// services/sale/salesInvoice.service.js
const mongoose = require("mongoose");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const Branch = require("../../models/inventorySettings/branch.model");
const Item = require("../../models/inventory/item.model");
const Customer = require("../../models/user/customer.model");
const CustomerPayment = require("../../models/finance/customerPayment.model");
const SalesRepStock = require("../../models/inventory/salesRepStock.model");
const { getCurrentStock, postLedger } = require("../ledger/stockLedger.service");
const { postSalesLedger } = require("../ledger/salesLedger.service");
const { getCustomerOutstanding, updateCustomerCreditStatus } = require("../finance/customerPayment.service");
const { computeIssueMovement } = require("../../utils/uomMath");

// Convert a value to ObjectId.
function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

// Convert a value to finite number with 0 fallback.
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Normalize document/object id values to string.
function normalizeId(v) {
  if (!v) return null;
  return String(v._id || v);
}

// ─── Stock validation helper ───────────────────────────────────────────────────
//
// Primary-only item (no baseUom / factorToBase = 1):
//   primaryQty ≤ qtyOnHandPrimary
//
// Dual-UOM item (baseUom present, factorToBase > 1):
//   primaryQty ≤ qtyOnHandPrimary          ← can't break open more packs than exist
//   baseQty is NOT capped by qtyOnHandBase  ← loose pieces can come from breaking packs
//   (primaryQty × factorToBase) + baseQty ≤ runningBalance   ← hard combined cap
//
// runningBalance = qtyOnHandPrimary * factorToBase + qtyOnHandBase
//
function validateStockForIssue({ qtyPrimary, qtyBase, stockPrimary, stockBase, factorToBase, hasBaseUom, itemId }) {
  const runningBalance = stockPrimary * factorToBase + stockBase;

  if (!hasBaseUom) {
    // Primary-only: simple cap
    if (qtyPrimary > stockPrimary) {
      throw Object.assign(
        new Error(
          `Insufficient stock for item ${itemId}. ` +
          `Available: ${stockPrimary} (primary). Required: ${qtyPrimary}.`
        ),
        { status: 400, code: "INSUFFICIENT_STOCK" }
      );
    }
    return; // valid
  }

  // Dual-UOM: primary is capped by whole-pack stock
  if (qtyPrimary > stockPrimary) {
    throw Object.assign(
      new Error(
        `Insufficient pack stock for item ${itemId}. ` +
        `Available packs: ${stockPrimary}. Required packs: ${qtyPrimary}.`
      ),
      { status: 400, code: "INSUFFICIENT_STOCK" }
    );
  }

  // Combined running-balance check (base can come from breaking packs)
  const consumed = qtyPrimary * factorToBase + qtyBase;
  if (consumed > runningBalance) {
    throw Object.assign(
      new Error(
        `Insufficient total stock for item ${itemId}. ` +
        `Running balance: ${runningBalance} base units ` +
        `(${stockPrimary} packs × ${factorToBase} + ${stockBase} loose). ` +
        `Required: ${consumed} base units ` +
        `(${qtyPrimary} packs × ${factorToBase} + ${qtyBase} loose).`
      ),
      { status: 400, code: "INSUFFICIENT_STOCK" }
    );
  }
}

// Create a sales invoice in pending state with validated item lines and pricing fallbacks.
async function createSalesInvoice(payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceNo, customer, branch, salesRep = null, items: rawItems, invoiceDate, remarks = "" } = payload;

    const branchDoc = await Branch.findById(branch).lean();
    if (!branchDoc) throw Object.assign(new Error("Invalid branch selected"), { status: 400 });

    const itemsArray = rawItems || [];
    if (!itemsArray.length) throw Object.assign(new Error("Invoice must contain at least one item"), { status: 400 });

    const itemIds = itemsArray.map((line) => toObjectId(line.item?._id || line.item));
    const itemDocs = await Item.find({ _id: { $in: itemIds } }).select("sellingPriceBase sellingPricePrimary factorToBase baseUom primaryUom").lean();
    const itemMap = new Map(itemDocs.map((doc) => [String(doc._id), doc]));

    const items = itemsArray.map((line) => {
      const itemId = toObjectId(line.item?._id || line.item);
      const itemDoc = itemMap.get(String(itemId));
      if (!itemDoc) throw Object.assign(new Error(`Item not found for id ${itemId}`), { status: 400 });

      const qtyPrimary = toNumber(line.primaryQty);
      const qtyBase = toNumber(line.baseQty);
      const factorToBase = toNumber(line.factorToBase || itemDoc.factorToBase || 1);

      if (qtyPrimary < 0 || qtyBase < 0) throw Object.assign(new Error(`Invalid quantity (negative) for item ${itemId}`), { status: 400 });
      if (qtyPrimary === 0 && qtyBase === 0) throw Object.assign(new Error(`At least one quantity must be > 0 for item ${itemId}`), { status: 400 });

      let sellingPriceBase = 0;
      let sellingPricePrimary = 0;

      {
        const rawBase = line.sellingPriceBase;
        const fallbackBase = itemDoc.sellingPriceBase;
        sellingPriceBase = toNumber(rawBase !== null && rawBase !== undefined ? rawBase : fallbackBase);
        if (qtyBase > 0 && sellingPriceBase <= 0) throw Object.assign(new Error(`Invalid base selling price for item ${itemId}`), { status: 400 });
      }

      {
        const rawPrimary = line.sellingPricePrimary;
        const fallbackPrimary = itemDoc.sellingPricePrimary;
        sellingPricePrimary = toNumber(rawPrimary !== null && rawPrimary !== undefined ? rawPrimary : fallbackPrimary);
        if (qtyPrimary > 0 && sellingPricePrimary <= 0) throw Object.assign(new Error(`Invalid primary selling price for item ${itemId}`), { status: 400 });
      }

      const discountPerUnit = toNumber(line.discountPerUnit || 0);
      if (discountPerUnit < 0) throw Object.assign(new Error(`Invalid discount for item ${itemId}`), { status: 400 });

      let effectivePrice = 0;
      if (qtyBase > 0 && sellingPriceBase > 0) effectivePrice = sellingPriceBase;
      else if (qtyPrimary > 0 && sellingPricePrimary > 0) effectivePrice = sellingPricePrimary;

      if (effectivePrice > 0 && discountPerUnit > effectivePrice) throw Object.assign(new Error(`Discount cannot exceed selling price for item ${itemId}`), { status: 400 });

      const totalSellingValue = qtyPrimary * sellingPricePrimary + qtyBase * sellingPriceBase;

      return {
        item: itemId,
        sellingPriceBase,
        sellingPricePrimary,
        factorToBase,
        primaryQty: qtyPrimary,
        baseQty: qtyBase,
        totalSellingValue,
        discountPerUnit,
        baseUom: itemDoc.baseUom,
        primaryUom: itemDoc.primaryUom,
      };
    });

    const totalValue = items.reduce((sum, i) => sum + i.totalSellingValue, 0);

    const [invoice] = await SalesInvoice.create([{
      invoiceNo,
      customer,
      branch,
      salesRep: salesRep ? toObjectId(salesRep) : null,
      items,
      totalValue,
      totalReturnedValue: 0,
      totalBalanceValue: totalValue,
      hasReturns: false,
      returns: [],
      paidAmount: 0,
      paymentStatus: "unpaid",
      paymentAllocations: [],
      invoiceDate,
      remarks,
      status: "waiting_for_approval",
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return invoice.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Approve a pending invoice, enforce credit rules, post ledgers, and update sales-rep stock.
async function approveInvoice(id, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await SalesInvoice.findById(id).session(session);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (invoice.status !== "waiting_for_approval") throw Object.assign(new Error("Only invoices waiting_for_approval can be approved"), { status: 400 });

    const customerDoc = await Customer.findById(invoice.customer).lean();
    if (!customerDoc) throw Object.assign(new Error("Customer not found for this invoice"), { status: 400 });
    if (customerDoc.status === "suspended") throw Object.assign(new Error("Customer is suspended and cannot be invoiced"), { status: 400, code: "CUSTOMER_SUSPENDED" });
    if (customerDoc.creditStatus === "blocked") throw Object.assign(new Error("Customer credit is blocked"), { status: 400, code: "CREDIT_BLOCKED" });

    const creditLimit = Number(customerDoc.creditLimit || 0);
    if (creditLimit > 0) {
      const currentOutstanding = await getCustomerOutstanding(invoice.customer);
      const projected = currentOutstanding + Number(invoice.totalBalanceValue || 0);
      if (projected > creditLimit) {
        throw Object.assign(new Error("Customer credit limit exceeded"), {
          status: 400,
          code: "CREDIT_LIMIT_EXCEEDED",
          meta: { creditLimit, currentOutstanding, projectedOutstanding: projected },
        });
      }
    }

    // ── Stock validation (dual-UOM aware) ──────────────────────────────────
    for (const line of invoice.items || []) {
      const qtyPrimary  = Math.abs(toNumber(line.primaryQty));
      const qtyBase     = Math.abs(toNumber(line.baseQty));
      const factorToBase = toNumber(line.factorToBase || 1);
      const hasBaseUom  = !!line.baseUom && factorToBase > 1;

      const salesRepStock = await SalesRepStock.findOne({
        salesRep: invoice.salesRep,
        item: line.item,
      }).session(session).lean();

      if (!salesRepStock) {
        throw Object.assign(
          new Error(`SalesRep stock not found for item ${line.item}`),
          { status: 400, code: "STOCK_NOT_FOUND" }
        );
      }

      const stockPrimary = toNumber(salesRepStock.qtyOnHandPrimary || 0);
      const stockBase    = toNumber(salesRepStock.qtyOnHandBase    || 0);

      // Use the unified validator that understands running-balance logic
      validateStockForIssue({
        qtyPrimary,
        qtyBase,
        stockPrimary,
        stockBase,
        factorToBase,
        hasBaseUom,
        itemId: String(line.item),
      });
    }

    // ── Approve & post ledgers ─────────────────────────────────────────────
    invoice.status     = "approved";
    invoice.approvedBy = userId;
    invoice.approvedAt = new Date();

    const salesRepId = invoice.salesRep ? String(invoice.salesRep) : null;

    for (const line of invoice.items || []) {
      const qtyPrimary   = Math.abs(toNumber(line.primaryQty));
      const qtyBase      = Math.abs(toNumber(line.baseQty));

      const itemDoc = await Item.findById(line.item)
        .select("avgCostBase avgCostPrimary factorToBase baseUom primaryUom")
        .session(session)
        .lean();

      const avgCostBase    = toNumber(itemDoc?.avgCostBase);
      const avgCostPrimary = toNumber(itemDoc?.avgCostPrimary);
      const factorToBase   = toNumber(line.factorToBase || itemDoc?.factorToBase || 1);

      line.baseUom    = itemDoc.baseUom;
      line.primaryUom = itemDoc.primaryUom;

      let movementPrimaryForLedger = qtyPrimary;
      let movementBaseForLedger    = qtyBase;

      if (invoice.salesRep) {
        const salesRepStock = await SalesRepStock.findOne({
          salesRep: invoice.salesRep,
          item: line.item,
        }).session(session).lean();

        if (!salesRepStock) {
          throw Object.assign(
            new Error(`SalesRep stock not found for item ${line.item}`),
            { status: 400, code: "STOCK_NOT_FOUND" }
          );
        }

        const currentPrimary = toNumber(salesRepStock.qtyOnHandPrimary || 0);
        const currentBase    = toNumber(salesRepStock.qtyOnHandBase    || 0);

        const { movementPrimary, movementBase, newPrimary, newBase } = computeIssueMovement({
          currentPrimary,
          currentBase,
          issuePrimary: qtyPrimary,
          issueBase:    qtyBase,
          factorToBase,
          errorMeta: {
            item:      String(line.item),
            salesRep:  String(invoice.salesRep),
            invoiceId: String(invoice._id),
          },
        });

        movementPrimaryForLedger = movementPrimary;
        movementBaseForLedger    = movementBase;

        const newStockValuePrimary = newPrimary * (avgCostPrimary || 0);
        const newStockValueBase    = newBase    * (avgCostBase    || 0);

        await SalesRepStock.findOneAndUpdate(
          { salesRep: invoice.salesRep, item: line.item },
          {
            $set: {
              qtyOnHandBase:      newBase,
              qtyOnHandPrimary:   newPrimary,
              stockValueBase:     newStockValueBase,
              stockValuePrimary:  newStockValuePrimary,
              factorToBase,
            },
          },
          { new: true, session }
        );
      }

      const itemTotalValue =
        movementBaseForLedger    * avgCostBase +
        movementPrimaryForLedger * avgCostPrimary;

      await postLedger({
        item: line.item,
        branch: String(invoice.branch),
        salesRep: salesRepId,
        transactionType: "sale",
        refModel: "SalesInvoice",
        refId: invoice._id,
        sellingPriceBase:    line.sellingPriceBase,
        sellingPricePrimary: line.sellingPricePrimary,
        avgCostBase,
        avgCostPrimary,
        factorToBase,
        primaryQty: line.primaryQty,
        baseQty:    line.baseQty,
        itemTotalValue,
        session,
      });

      await postSalesLedger({
        item: line.item,
        branch: String(invoice.branch),
        salesRep: salesRepId,
        customer: invoice.customer,
        transactionType: "sale",
        refModel: "SalesInvoice",
        refId: invoice._id,
        sellingPriceBase:    line.sellingPriceBase,
        sellingPricePrimary: line.sellingPricePrimary,
        factorToBase,
        primaryQty: line.primaryQty,
        baseQty:    line.baseQty,
        totalSellingValue: line.totalSellingValue,
        createdBy: userId,
        session,
      });
    }

    await invoice.save({ session });
    await session.commitTransaction();
    session.endSession();

    await updateCustomerCreditStatus(invoice.customer);
    await Customer.findByIdAndUpdate(invoice.customer, { $addToSet: { saleInvoices: invoice._id } });

    return invoice.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Get a single invoice with populations and computed remaining returnable quantities.
async function getInvoice(id, scope = {}) {
  const q = { _id: id, ...(scope.salesRep ? { salesRep: toObjectId(scope.salesRep) } : {}) };

  const invoice = await SalesInvoice.findOne(q)
    .populate("customer", "name customerCode creditStatus")
    .populate("branch", "name branchCode")
    .populate("salesRep", "repCode name")
    .populate("items.item", "itemCode name brand productType baseUnit baseUom primaryUom")
    .populate("returns.returnId", "returnNo returnDate")
    .populate("returns.items.item", "itemCode name")
    .populate("paymentAllocations.paymentId", "paymentNo paymentDate amount method referenceNo")
    .populate("paymentAllocations.collectedBy", "repCode name")
    .lean();

  if (!invoice) return null;

  const remainingItems = (invoice.items || []).map((line) => {
    const itemIdStr    = String(line.item._id || line.item);
    const factorToBase = toNumber(line.factorToBase || 1);
    const qtyPrimary   = toNumber(line.primaryQty || 0);
    const qtyBase      = toNumber(line.baseQty     || 0);
    const totalInvoiceBase = qtyPrimary * factorToBase + qtyBase;

    let alreadyReturnedTotalBase = 0;
    for (const ret of invoice.returns || []) {
      for (const retLine of ret.items || []) {
        if (String(retLine.item._id || retLine.item) !== itemIdStr) continue;
        const rPrimary = toNumber(retLine.qtyReturnedPrimary || 0);
        const rBase    = toNumber(retLine.qtyReturnedBase    || 0);
        alreadyReturnedTotalBase += rPrimary * factorToBase + rBase;
      }
    }

    const remainingTotalBase  = Math.max(totalInvoiceBase - alreadyReturnedTotalBase, 0);
    const remainingPrimaryQty = Math.floor(remainingTotalBase / factorToBase);
    const remainingBaseQty    = remainingTotalBase % factorToBase;

    return { item: line.item._id || line.item, remainingPrimaryQty, remainingBaseQty, remainingTotalBase, factorToBase };
  });

  invoice.remainingItems = remainingItems;
  return invoice;
}

// List invoices with optional filters and sales-rep scope enforcement.
async function listInvoices(filter = {}, options = {}, scope = {}) {
  const query = {};
  if (filter.customer) query.customer = filter.customer;
  if (filter.status)   query.status   = filter.status;
  if (filter.branch)   query.branch   = filter.branch;
  if (scope.salesRep)       query.salesRep = toObjectId(scope.salesRep);
  else if (filter.salesRep) query.salesRep = toObjectId(filter.salesRep);

  const limit = Number(options.limit) || 100;

  return SalesInvoice.find(query)
    .sort({ invoiceDate: -1 })
    .limit(limit)
    .populate("branch",   "name branchCode")
    .populate("customer", "name customerCode creditStatus")
    .populate("salesRep", "repCode name")
    .lean();
}

// Delete a draft/pending invoice after validating scope and payment links.
async function deleteInvoice(id, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const q = { _id: id, ...(scope.salesRep ? { salesRep: toObjectId(scope.salesRep) } : {}) };

    const invoice = await SalesInvoice.findOne(q).session(session);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

    if (invoice.status !== "waiting_for_approval" && invoice.status !== "draft") {
      throw Object.assign(new Error("Only invoices in draft / waiting_for_approval can be deleted"), { status: 400 });
    }

    const hasPayments = await CustomerPayment.exists({ "allocations.invoice": id });
    if (hasPayments) throw Object.assign(new Error("Cannot delete invoice linked to customer payments"), { status: 400 });

    await SalesInvoice.deleteOne({ _id: id }, { session });
    await Customer.findByIdAndUpdate(invoice.customer, { $pull: { saleInvoices: invoice._id } });

    await session.commitTransaction();
    session.endSession();
    return invoice.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Update a draft/pending invoice with recalculated lines and totals.
async function updateInvoice(id, payload, scope = {}) {
  const q = { _id: id, ...(scope.salesRep ? { salesRep: toObjectId(scope.salesRep) } : {}) };
  const invoice = await SalesInvoice.findOne(q);
  if (!invoice) return null;

  if (invoice.status !== "waiting_for_approval" && invoice.status !== "draft") {
    throw Object.assign(new Error("Only invoices in draft / waiting_for_approval can be updated"), { status: 400 });
  }

  if (Array.isArray(payload.items)) {
    const itemsArray = payload.items;
    const itemIds    = itemsArray.map((line) => toObjectId(line.item?._id || line.item));
    const itemDocs   = await Item.find({ _id: { $in: itemIds } }).select("sellingPriceBase sellingPricePrimary factorToBase baseUom primaryUom").lean();
    const itemMap    = new Map(itemDocs.map((doc) => [String(doc._id), doc]));

    const items = itemsArray.map((line) => {
      const itemId  = toObjectId(line.item?._id || line.item);
      const itemDoc = itemMap.get(String(itemId));
      if (!itemDoc) throw Object.assign(new Error(`Item not found for id ${itemId}`), { status: 400 });

      const qtyPrimary   = toNumber(line.primaryQty);
      const qtyBase      = toNumber(line.baseQty);
      const factorToBase = toNumber(line.factorToBase || itemDoc.factorToBase || 1);

      if (qtyPrimary < 0 || qtyBase < 0) throw Object.assign(new Error(`Invalid quantity (negative) for item ${itemId}`), { status: 400 });
      if (qtyPrimary === 0 && qtyBase === 0) throw Object.assign(new Error(`At least one quantity must be > 0 for item ${itemId}`), { status: 400 });

      let sellingPriceBase    = 0;
      let sellingPricePrimary = 0;

      if (qtyBase > 0) {
        const rawBase      = line.sellingPriceBase;
        const fallbackBase = itemDoc.sellingPriceBase;
        sellingPriceBase   = toNumber(rawBase !== null && rawBase !== undefined ? rawBase : fallbackBase);
        if (sellingPriceBase <= 0) throw Object.assign(new Error(`Invalid base selling price for item ${itemId}`), { status: 400 });
      }

      if (qtyPrimary > 0) {
        const rawPrimary      = line.sellingPricePrimary;
        const fallbackPrimary = itemDoc.sellingPricePrimary;
        sellingPricePrimary   = toNumber(rawPrimary !== null && rawPrimary !== undefined ? rawPrimary : fallbackPrimary);
        if (sellingPricePrimary <= 0) throw Object.assign(new Error(`Invalid primary selling price for item ${itemId}`), { status: 400 });
      }

      const discountPerUnit = toNumber(line.discountPerUnit || 0);
      if (discountPerUnit < 0) throw Object.assign(new Error(`Invalid discount for item ${itemId}`), { status: 400 });

      let effectivePrice = 0;
      if (qtyBase > 0 && sellingPriceBase > 0) effectivePrice = sellingPriceBase;
      else if (qtyPrimary > 0 && sellingPricePrimary > 0) effectivePrice = sellingPricePrimary;

      if (effectivePrice > 0 && discountPerUnit > effectivePrice) throw Object.assign(new Error(`Invalid discount for item ${itemId}`), { status: 400 });

      const totalSellingValue = qtyPrimary * sellingPricePrimary + qtyBase * sellingPriceBase;

      return {
        item: itemId,
        sellingPriceBase,
        sellingPricePrimary,
        factorToBase,
        primaryQty: qtyPrimary,
        baseQty:    qtyBase,
        totalSellingValue,
        discountPerUnit,
        baseUom:    itemDoc.baseUom,
        primaryUom: itemDoc.primaryUom,
      };
    });

    invoice.items              = items;
    invoice.totalValue         = items.reduce((sum, i) => sum + i.totalSellingValue, 0);
    invoice.totalReturnedValue = 0;
    invoice.totalBalanceValue  = invoice.totalValue;
    invoice.hasReturns         = false;
    invoice.returns            = [];
  }

  if (payload.invoiceDate)            invoice.invoiceDate = payload.invoiceDate;
  if (payload.remarks !== undefined)  invoice.remarks     = payload.remarks;
  if (payload.salesRep !== undefined) invoice.salesRep    = payload.salesRep ? toObjectId(payload.salesRep) : null;

  await invoice.save();
  return invoice.toObject();
}

// List available sale items from current stock snapshot for a branch and optional sales rep.
async function listAvailableSaleItems(branchId, salesRepId) {
  if (!branchId || !mongoose.Types.ObjectId.isValid(branchId))
    throw Object.assign(new Error("Invalid branch ID"), { status: 400 });

  if (!salesRepId || !mongoose.Types.ObjectId.isValid(salesRepId))
    throw Object.assign(new Error("Sales Rep ID is required to load available items"), { status: 400 });

  const stockRows = await getCurrentStock(branchId, salesRepId);
  if (!stockRows || !stockRows.length) return [];

  const nonZeroStock = stockRows.filter((row) => {
    const baseQty    = Number((row.qtyOnHandRaw && row.qtyOnHandRaw.baseQty)    ?? (row.qtyOnHand && row.qtyOnHand.baseQty)    ?? 0);
    const primaryQty = Number((row.qtyOnHandRaw && row.qtyOnHandRaw.primaryQty) ?? (row.qtyOnHand && row.qtyOnHand.primaryQty) ?? 0);
    return baseQty !== 0 || primaryQty !== 0;
  });

  return nonZeroStock;
}

module.exports = { createSalesInvoice, approveInvoice, getInvoice, listInvoices, deleteInvoice, updateInvoice, listAvailableSaleItems };