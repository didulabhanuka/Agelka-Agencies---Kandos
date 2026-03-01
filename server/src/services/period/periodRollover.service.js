/**
 * Period Rollover Service
 * server/src/services/period/periodRollover.service.js
 *
 * - Archives data BY DATE RANGE (fromDate → toDate) into agelka-history-db
 * - Idempotent — safe to re-run if it fails midway
 * - Works on MongoDB Atlas Flex tier (no transactions needed)
 */

// ── Current period models (agelka-db) ────────────────────────────
const SalesInvoice    = require('../../models/sale/SalesInvoice.model');
const SalesReturn     = require('../../models/sale/SalesReturn.model');
const StockAdjustment = require('../../models/inventory/StockAdjustment.model');
const SalesRepStock   = require('../../models/inventory/salesRepStock.model');
const GRN             = require('../../models/purchases/grn.model');
const SalesLedger     = require('../../models/ledger/SalesLedger.model');
const PurchaseLedger  = require('../../models/ledger/PurchaseLedger.model');
const StockLedger     = require('../../models/ledger/StockLedger.model');
const CustomerPayment = require('../../models/finance/customerPayment.model');

// ── History models (agelka-history-db) ───────────────────────────
const SalesInvoiceHistory    = require('../../models/history/SalesInvoiceHistory.model');
const SalesReturnHistory     = require('../../models/history/SalesReturnHistory.model');
const CustomerPaymentHistory = require('../../models/history/CustomerPaymentHistory.model');
const StockAdjustmentHistory = require('../../models/history/StockAdjustmentHistory.model');
const SalesRepStockHistory   = require('../../models/history/SalesRepStockHistory.model');
const GRNHistory             = require('../../models/history/GRNHistory.model');
const SalesLedgerHistory     = require('../../models/history/SalesLedgerHistory.model');
const PurchaseLedgerHistory  = require('../../models/history/PurchaseLedgerHistory.model');
const StockLedgerHistory     = require('../../models/history/StockLedgerHistory.model');

// ── Period tracker (agelka-db) ───────────────────────────────────
const Period = require('../../models/period/Period.model');

// ─────────────────────────────────────────────────────────────────
// Date range helpers
// ─────────────────────────────────────────────────────────────────

const buildDateFilter = (dateField, fromDate, toDate) => {
  if (!fromDate && !toDate) return {};
  const filter = {};
  if (fromDate) filter.$gte = new Date(fromDate);
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return { [dateField]: filter };
};

// ─────────────────────────────────────────────────────────────────
// Core archive helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Archive documents from source → history collection.
 * dateField = null means no date filter (e.g. SalesRepStock).
 * Idempotent — skips docs already archived for this period.
 */
const archiveCollection = async (SourceModel, HistoryModel, periodLabel, dateField, fromDate, toDate, collectionName) => {
  const query = dateField ? buildDateFilter(dateField, fromDate, toDate) : {};
  const docs = await SourceModel.find(query).lean();

  if (!docs.length) {
    console.log(`  ⏭️  ${collectionName}: nothing to archive`);
    return 0;
  }

  const existingIds = await HistoryModel.find({ period: periodLabel }).distinct('originalId');
  const existingSet = new Set(existingIds.map(id => id.toString()));
  const toArchive = docs.filter(doc => !existingSet.has(doc._id.toString()));

  if (!toArchive.length) {
    console.log(`  ✅ ${collectionName}: already archived (${docs.length} docs)`);
    return docs.length;
  }

  const historyDocs = toArchive.map(({ _id, ...doc }) => ({
    ...doc,
    originalId: _id,
    period: periodLabel,
    archivedAt: new Date(),
  }));

  await HistoryModel.insertMany(historyDocs, { ordered: false });
  console.log(`  ✅ ${collectionName}: archived ${toArchive.length} docs`);
  return docs.length;
};

/**
 * Safely clear docs from source ONLY after confirming all are archived.
 * dateField = null means no date filter (e.g. SalesRepStock).
 * Safety gate — data is never lost.
 */
const safelyClearCollection = async (SourceModel, HistoryModel, periodLabel, dateField, fromDate, toDate, collectionName) => {
  const query = dateField ? buildDateFilter(dateField, fromDate, toDate) : {};
  const currentCount  = await SourceModel.countDocuments(query);
  const archivedCount = await HistoryModel.countDocuments({ period: periodLabel });

  if (currentCount > archivedCount) {
    throw new Error(
      `Safety check failed for ${collectionName}: ` +
      `${currentCount} current docs but only ${archivedCount} archived. Re-run rollover to fix.`
    );
  }

  await SourceModel.deleteMany(query);
  console.log(`  🗑️  ${collectionName}: cleared ${currentCount} docs`);
};

// ─────────────────────────────────────────────────────────────────
// Main rollover function
// ─────────────────────────────────────────────────────────────────

const performRollover = async (periodLabel, fromDate, toDate, performedBy) => {
  if (!periodLabel?.trim()) throw new Error('periodLabel is required');
  if (!fromDate || !toDate)  throw new Error('fromDate and toDate are required');

  const label = periodLabel.trim().toUpperCase();

  const existing = await Period.findOne({ label, status: 'completed' });
  if (existing) {
    throw new Error(`Period "${label}" was already closed on ${existing.closedAt}`);
  }

  let job = await Period.findOne({ label, status: { $in: ['started', 'archiving', 'clearing'] } });

  if (job) {
    console.log(`🔄 Resuming rollover for "${label}" from checkpoint: ${job.checkpoint}`);
  } else {
    job = await Period.create({
      label,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      status: 'started',
      checkpoint: 'none',
      startedAt: new Date(),
      startedBy: performedBy,
      summary: {},
    });
    console.log(`🚀 Starting rollover for period "${label}" (${fromDate} → ${toDate})`);
  }

  const fd = job.fromDate ? job.fromDate.toISOString().split('T')[0] : fromDate;
  const td = job.toDate   ? job.toDate.toISOString().split('T')[0]   : toDate;

  try {
    // ── Phase 1: Archive ─────────────────────────────────────────
    job.status = 'archiving';
    await job.save();
    console.log('\n📦 Archiving collections...');

    const summary = {};

    summary.salesInvoices = await archiveCollection(
      SalesInvoice, SalesInvoiceHistory, label, 'invoiceDate', fd, td, 'Sales Invoices'
    );
    summary.salesReturns = await archiveCollection(
      SalesReturn, SalesReturnHistory, label, 'returnDate', fd, td, 'Sales Returns'
    );
    summary.customerPayments = await archiveCollection(
      CustomerPayment, CustomerPaymentHistory, label, 'paymentDate', fd, td, 'Customer Payments'
    );
    summary.grns = await archiveCollection(
      GRN, GRNHistory, label, 'receivedDate', fd, td, 'GRNs'
    );
    summary.stockAdjustments = await archiveCollection(
      StockAdjustment, StockAdjustmentHistory, label, 'adjustmentDate', fd, td, 'Stock Adjustments'
    );
    summary.salesLedger = await archiveCollection(
      SalesLedger, SalesLedgerHistory, label, 'createdAt', fd, td, 'Sales Ledger'
    );
    summary.purchaseLedger = await archiveCollection(
      PurchaseLedger, PurchaseLedgerHistory, label, 'createdAt', fd, td, 'Purchase Ledger'
    );
    summary.stockLedger = await archiveCollection(
      StockLedger, StockLedgerHistory, label, 'createdAt', fd, td, 'Stock Ledger'
    );
    // SalesRep Stock — no date filter, archives entire collection as snapshot
    summary.salesRepStocks = await archiveCollection(
      SalesRepStock, SalesRepStockHistory, label, null, null, null, 'SalesRep Stocks'
    );

    job.checkpoint = 'archived';
    job.summary = summary;
    await job.save();

    // ── Phase 2: Clear (safety-gated) ────────────────────────────
    job.status = 'clearing';
    await job.save();
    console.log('\n🗑️  Clearing current period data...');

    await safelyClearCollection(SalesInvoice,    SalesInvoiceHistory,    label, 'invoiceDate',    fd, td, 'Sales Invoices');
    await safelyClearCollection(SalesReturn,     SalesReturnHistory,     label, 'returnDate',     fd, td, 'Sales Returns');
    await safelyClearCollection(CustomerPayment, CustomerPaymentHistory, label, 'paymentDate',    fd, td, 'Customer Payments');
    await safelyClearCollection(GRN,             GRNHistory,             label, 'receivedDate',   fd, td, 'GRNs');
    await safelyClearCollection(StockAdjustment, StockAdjustmentHistory, label, 'adjustmentDate', fd, td, 'Stock Adjustments');
    await safelyClearCollection(SalesLedger,     SalesLedgerHistory,     label, 'createdAt',      fd, td, 'Sales Ledger');
    await safelyClearCollection(PurchaseLedger,  PurchaseLedgerHistory,  label, 'createdAt',      fd, td, 'Purchase Ledger');
    await safelyClearCollection(StockLedger,     StockLedgerHistory,     label, 'createdAt',      fd, td, 'Stock Ledger');
    // SalesRep Stock — deleted like every other collection, no zero-reset
    await safelyClearCollection(SalesRepStock, SalesRepStockHistory, label, null, null, null, 'SalesRep Stocks');

    // ── Phase 3: Complete ─────────────────────────────────────────
    job.status     = 'completed';
    job.checkpoint = 'done';
    job.closedAt   = new Date();
    job.closedBy   = performedBy;
    await job.save();

    console.log(`\n🎉 Period "${label}" closed successfully!`);

    return {
      success: true,
      period: label,
      summary,
      message: `Period "${label}" closed and archived successfully.`,
    };

  } catch (error) {
    job.status        = 'failed';
    job.failedAt      = new Date();
    job.failureReason = error.message;
    await job.save();

    console.error(`\n❌ Rollover failed: ${error.message}`);
    throw new Error(`Rollover failed: ${error.message}. Re-run to resume safely.`);
  }
};

// ─────────────────────────────────────────────────────────────────
// Counts — filtered by date range (for "What Gets Archived" UI)
// ─────────────────────────────────────────────────────────────────

const getCurrentCounts = async (fromDate, toDate) => {
  const invoiceFilter    = buildDateFilter('invoiceDate',    fromDate, toDate);
  const returnFilter     = buildDateFilter('returnDate',     fromDate, toDate);
  const paymentFilter    = buildDateFilter('paymentDate',    fromDate, toDate);
  const grnFilter        = buildDateFilter('receivedDate',   fromDate, toDate);
  const adjustmentFilter = buildDateFilter('adjustmentDate', fromDate, toDate);
  const ledgerFilter     = buildDateFilter('createdAt',      fromDate, toDate);

  const [
    salesInvoices, salesReturns, customerPayments,
    grns, stockAdjustments,
    salesLedger, purchaseLedger, stockLedger,
    salesRepStocks,
  ] = await Promise.all([
    SalesInvoice.countDocuments(invoiceFilter),
    SalesReturn.countDocuments(returnFilter),
    CustomerPayment.countDocuments(paymentFilter),
    GRN.countDocuments(grnFilter),
    StockAdjustment.countDocuments(adjustmentFilter),
    SalesLedger.countDocuments(ledgerFilter),
    PurchaseLedger.countDocuments(ledgerFilter),
    StockLedger.countDocuments(ledgerFilter),
    SalesRepStock.countDocuments(), // no date filter — always full snapshot
  ]);

  return {
    salesInvoices, salesReturns, customerPayments,
    grns, stockAdjustments,
    salesLedger, purchaseLedger, stockLedger,
    salesRepStocks,
    total: salesInvoices + salesReturns + customerPayments + grns +
           stockAdjustments + salesLedger + purchaseLedger + stockLedger + salesRepStocks,
  };
};

// ─────────────────────────────────────────────────────────────────
// Other queries
// ─────────────────────────────────────────────────────────────────

const getClosedPeriods = async () => {
  return await Period.find({ status: 'completed' })
    .sort({ closedAt: -1 })
    .select('label closedAt closedBy summary startedAt fromDate toDate');
};

const getRolloverStatus = async () => {
  return await Period.findOne({
    status: { $in: ['started', 'archiving', 'clearing', 'failed'] }
  }).sort({ startedAt: -1 }) || null;
};

const getHistoricalData = async (model, period) => {
  const modelMap = {
    invoices:       SalesInvoiceHistory,
    returns:        SalesReturnHistory,
    payments:       CustomerPaymentHistory,
    adjustments:    StockAdjustmentHistory,
    repStocks:      SalesRepStockHistory,
    grns:           GRNHistory,
    salesLedger:    SalesLedgerHistory,
    purchaseLedger: PurchaseLedgerHistory,
    stockLedger:    StockLedgerHistory,
  };

  const HistoryModel = modelMap[model];
  if (!HistoryModel) {
    throw new Error(`Unknown model: "${model}". Valid: ${Object.keys(modelMap).join(', ')}`);
  }

  return await HistoryModel.find({ period }).sort({ archivedAt: -1 });
};

module.exports = {
  performRollover,
  getCurrentCounts,
  getClosedPeriods,
  getRolloverStatus,
  getHistoricalData,
};