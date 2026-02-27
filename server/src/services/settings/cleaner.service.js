// services/settings/cleaner.service.js
const mongoose = require("mongoose");
const logger = require("../../utils/logger.js");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const SalesReturn = require("../../models/sale/SalesReturn.model");
const StockAdjustment = require("../../models/inventory/StockAdjustment.model");
const SalesRepStock = require("../../models/inventory/salesRepStock.model");
const GRN = require("../../models/purchases/grn.model");
const SalesLedger = require("../../models/ledger/SalesLedger.model");
const PurchaseLedger = require("../../models/ledger/PurchaseLedger.model");
const StockLedger = require("../../models/ledger/StockLedger.model");
const CustomerPayment = require("../../models/finance/customerPayment.model");

const Customer = require("../../models/user/customer.model");
const Supplier = require("../../models/user/supplier.model");
const SalesRep = require("../../models/user/salesRep.model");

// Helper — builds a date filter for a given field, or {} when no dates supplied (delete-all)
function dateFilter(field, startDate, endDate) {
  if (!startDate && !endDate) return {};
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Invalid date range");
  if (end < start) throw new Error("End date must be after the start date");
  return { [field]: { $gte: start, $lte: end } };
}

// Delete Sales Invoices and cascade-delete their linked Returns and Customer Payments.
// Scope supports: branch, salesRep (any extra top-level invoice field).
async function deleteSalesInvoicesAndReturnsInRange(startDate, endDate, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoiceFilter = { ...dateFilter("invoiceDate", startDate, endDate), ...scope };

    // ── 1. Load invoices ──────────────────────────────────────────────────────
    const invoices = await SalesInvoice.find(invoiceFilter).session(session);
    if (invoices.length === 0) throw new Error("No Sales Invoices found");

    const invoiceIds = invoices.map((inv) => inv._id);

    // ── 2. Collect linked return IDs and payment IDs from invoice sub-docs ───
    const linkedReturnIds = invoices.flatMap((inv) =>
      (inv.returns || []).map((r) => r.returnId)
    );
    const linkedPaymentIds = invoices.flatMap((inv) =>
      (inv.paymentAllocations || []).map((p) => p.paymentId)
    );

    // ── 3. Delete invoices ────────────────────────────────────────────────────
    await SalesInvoice.deleteMany({ _id: { $in: invoiceIds } }).session(session);

    await Customer.updateMany(
      { saleInvoices: { $in: invoiceIds } },
      { $pull: { saleInvoices: { $in: invoiceIds } } },
      { session }
    );
    await SalesRep.updateMany(
      { saleInvoices: { $in: invoiceIds } },
      { $pull: { saleInvoices: { $in: invoiceIds } } },
      { session }
    );

    // ── 4. Delete linked Sales Returns ────────────────────────────────────────
    let deletedReturns = 0;
    if (linkedReturnIds.length > 0) {
      const returnResult = await SalesReturn.deleteMany({
        _id: { $in: linkedReturnIds },
      }).session(session);
      deletedReturns = returnResult.deletedCount;

      await Customer.updateMany(
        { returns: { $in: linkedReturnIds } },
        { $pull: { returns: { $in: linkedReturnIds } } },
        { session }
      );
    }

    // ── 5. Delete linked Customer Payments ────────────────────────────────────
    let deletedPayments = 0;
    if (linkedPaymentIds.length > 0) {
      const paymentResult = await CustomerPayment.deleteMany({
        _id: { $in: linkedPaymentIds },
      }).session(session);
      deletedPayments = paymentResult.deletedCount;

      await Customer.updateMany(
        { payments: { $in: linkedPaymentIds } },
        { $pull: { payments: { $in: linkedPaymentIds } } },
        { session }
      );
      await SalesRep.updateMany(
        { customerPayments: { $in: linkedPaymentIds } },
        { $pull: { customerPayments: { $in: linkedPaymentIds } } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      deletedInvoices: invoices.length,
      deletedReturns,
      deletedPayments,
    };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error("deleteSalesInvoicesAndReturnsInRange() failed", err);
    throw err;
  }
}

// Delete Stock Adjustments — optionally within a date range and/or salesRep scope
async function deleteStockAdjustmentsInRange(startDate, endDate, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const filter = { ...dateFilter("adjustmentDate", startDate, endDate), ...scope };

    const result = await StockAdjustment.find(filter).session(session);
    if (result.length === 0) throw new Error("No Stock Adjustments found");

    const deletedAdjustmentIds = result.map((adj) => adj._id);
    await StockAdjustment.deleteMany({ _id: { $in: deletedAdjustmentIds } }).session(session);

    await SalesRep.updateMany(
      { stockAdjustments: { $in: deletedAdjustmentIds } },
      { $pull: { stockAdjustments: { $in: deletedAdjustmentIds } } },
      { session }
    );
    await Customer.updateMany(
      { stockAdjustments: { $in: deletedAdjustmentIds } },
      { $pull: { stockAdjustments: { $in: deletedAdjustmentIds } } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { success: true, deletedAdjustments: result.length };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error("deleteStockAdjustmentsInRange() failed", err);
    throw err;
  }
}

// Delete SalesRep Stock records — optionally within a date range and/or salesRep scope
async function deleteSalesRepStockInRange(startDate, endDate, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const filter = { ...dateFilter("createdAt", startDate, endDate), ...scope };

    const result = await SalesRepStock.find(filter).session(session);
    if (result.length === 0) throw new Error("No SalesRep Stock records found");

    const deletedIds = result.map((s) => s._id);
    await SalesRepStock.deleteMany({ _id: { $in: deletedIds } }).session(session);

    // Pull references from SalesRep documents if they embed stock record IDs.
    await SalesRep.updateMany(
      { stocks: { $in: deletedIds } },
      { $pull: { stocks: { $in: deletedIds } } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { success: true, deletedSalesRepStocks: result.length };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error("deleteSalesRepStockInRange() failed", err);
    throw err;
  }
}

// Delete GRNs — optionally within a date range and/or salesRep scope
async function deleteGRNsInRange(startDate, endDate, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const filter = { ...dateFilter("receivedDate", startDate, endDate), ...scope };

    const result = await GRN.find(filter).session(session);
    if (result.length === 0) throw new Error("No GRNs found");

    const deletedGRNIds = result.map((grn) => grn._id);
    await GRN.deleteMany({ _id: { $in: deletedGRNIds } }).session(session);

    await Supplier.updateMany(
      { grns: { $in: deletedGRNIds } },
      { $pull: { grns: { $in: deletedGRNIds } } },
      { session }
    );
    await SalesRep.updateMany(
      { grns: { $in: deletedGRNIds } },
      { $pull: { grns: { $in: deletedGRNIds } } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { success: true, deletedGRNs: result.length };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error("deleteGRNsInRange() failed", err);
    throw err;
  }
}

// Delete Ledgers — optionally within a date range
// Note: ledgers are global records; salesRep scope is not applicable here.
async function deleteLedgersInRange(fromDate, toDate) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const df = dateFilter("createdAt", fromDate, toDate);
    const hasRange = Object.keys(df).length > 0;

    const dateQuery  = hasRange ? { createdAt: df.createdAt } : {};
    const pullFilter = hasRange ? { "ledgers.createdAt": df.createdAt } : {};
    const pullUpdate = hasRange
      ? { $pull: { ledgers: { createdAt: df.createdAt } } }
      : { $set:  { ledgers: [] } };

    const salesLedgerDeleteResult    = await SalesLedger.deleteMany(dateQuery).session(session);
    const purchaseLedgerDeleteResult = await PurchaseLedger.deleteMany(dateQuery).session(session);
    const stockLedgerDeleteResult    = await StockLedger.deleteMany(dateQuery).session(session);

    await SalesInvoice.updateMany(pullFilter, pullUpdate, { session });
    await SalesReturn.updateMany(pullFilter, pullUpdate, { session });
    await GRN.updateMany(pullFilter, pullUpdate, { session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      deletedSalesLedgers: salesLedgerDeleteResult.deletedCount,
      deletedPurchaseLedgers: purchaseLedgerDeleteResult.deletedCount,
      deletedStockLedgers: stockLedgerDeleteResult.deletedCount,
    };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error("deleteLedgersInRange() failed", err);
    throw new Error("Failed to delete ledgers: " + err.message);
  }
}

module.exports = {
  deleteSalesInvoicesAndReturnsInRange,
  deleteStockAdjustmentsInRange,
  deleteSalesRepStockInRange,
  deleteGRNsInRange,
  deleteLedgersInRange,
};