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


// Date range helpers
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

// Core archive helpers
const archiveCollection = async (SourceModel, HistoryModel, periodLabel, dateField, fromDate, toDate, collectionName) => {
  const query = buildDateFilter(dateField, fromDate, toDate);
  const docs = await SourceModel.find(query).lean();

  if (!docs.length) {
    console.log(`  ⏭️  ${collectionName}: nothing to archive`);
    return 0;
  }

  // Check which are already archived (idempotency on re-run)
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
 * Safely clear docs from a source collection ONLY after confirming all are archived.
 * Safety gate — data is never lost.
 */
const safelyClearCollection = async (SourceModel, HistoryModel, periodLabel, dateField, fromDate, toDate, collectionName) => {
  const query = buildDateFilter(dateField, fromDate, toDate);
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

// Main rollover function
/**
 * Perform period rollover — archives all collections by date range.
 *
 * @param {string} periodLabel  - Human readable label e.g. "FEB-2026", "JAN-2026_MAR-2026"
 * @param {string} fromDate     - ISO date string "YYYY-MM-DD" (start of range, inclusive)
 * @param {string} toDate       - ISO date string "YYYY-MM-DD" (end of range, inclusive)
 * @param {string} performedBy  - userId of admin triggering rollover
 */
const performRollover = async (periodLabel, fromDate, toDate, performedBy) => {
  if (!periodLabel?.trim()) throw new Error('periodLabel is required');
  if (!fromDate || !toDate)  throw new Error('fromDate and toDate are required');

  const label = periodLabel.trim().toUpperCase();

  // Block re-closing a completed period
  const existing = await Period.findOne({ label, status: 'completed' });
  if (existing) {
    throw new Error(`Period "${label}" was already closed on ${existing.closedAt}`);
  }

  // Resume or create rollover job
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

  // Use stored dates for idempotent resume
  const fd = job.fromDate ? job.fromDate.toISOString().split('T')[0] : fromDate;
  const td = job.toDate   ? job.toDate.toISOString().split('T')[0]   : toDate;

  try {
    // ── Phase 1: Archive ─────────────────────────────────────────
    job.status = 'archiving';
    await job.save();
    console.log('\n📦 Archiving collections...');

    const summary = {};

    // Sales Invoices — date field: invoiceDate
    summary.salesInvoices = await archiveCollection(
      SalesInvoice, SalesInvoiceHistory, label, 'invoiceDate', fd, td, 'Sales Invoices'
    );

    // Sales Returns — date field: returnDate
    summary.salesReturns = await archiveCollection(
      SalesReturn, SalesReturnHistory, label, 'returnDate', fd, td, 'Sales Returns'
    );

    // Customer Payments — date field: paymentDate
    summary.customerPayments = await archiveCollection(
      CustomerPayment, CustomerPaymentHistory, label, 'paymentDate', fd, td, 'Customer Payments'
    );

    // GRNs — date field: receivedDate
    summary.grns = await archiveCollection(
      GRN, GRNHistory, label, 'receivedDate', fd, td, 'GRNs'
    );

    // Stock Adjustments — date field: adjustmentDate
    summary.stockAdjustments = await archiveCollection(
      StockAdjustment, StockAdjustmentHistory, label, 'adjustmentDate', fd, td, 'Stock Adjustments'
    );

    // Sales Ledger — date field: createdAt
    summary.salesLedger = await archiveCollection(
      SalesLedger, SalesLedgerHistory, label, 'createdAt', fd, td, 'Sales Ledger'
    );

    // Purchase Ledger — date field: createdAt
    summary.purchaseLedger = await archiveCollection(
      PurchaseLedger, PurchaseLedgerHistory, label, 'createdAt', fd, td, 'Purchase Ledger'
    );

    // Stock Ledger — date field: createdAt
    summary.stockLedger = await archiveCollection(
      StockLedger, StockLedgerHistory, label, 'createdAt', fd, td, 'Stock Ledger'
    );

    // SalesRep Stock — no date field, archive ALL (snapshot of stock at period close)
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

    // SalesRep Stock — reset to zero (fresh stock for new period)
    await SalesRepStock.updateMany({}, {
      $set: { qtyOnHandPrimary: 0, qtyOnHandBase: 0, stockValueBase: 0, stockValuePrimary: 0 }
    });
    console.log(`  🔄 SalesRep Stocks: reset to zero for new period`);

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

// Counts — filtered by date range (for "What Gets Archived" UI)
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
    SalesRepStock.countDocuments(),
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

// Other queries
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