/**
 * Period Rollover Service
 * server/src/services/period/periodRollover.service.js
 *
 * On-demand period closing for Agelka Agencies warehouse ERP.
 * - Triggered manually by admin when business decides to close a period
 * - Idempotent — safe to re-run if it fails midway
 * - Data is NEVER deleted — only moved to history collections
 * - SalesRepStock is reset to zero after archiving (fresh stock for new period)
 * - Works on MongoDB Atlas Flex tier (no transactions needed)
 */

// ── Current period models ─────────────────────────────────────────
const SalesInvoice       = require('../../models/sale/SalesInvoice.model');
const SalesReturn        = require('../../models/sale/SalesReturn.model');
const StockAdjustment    = require('../../models/inventory/StockAdjustment.model');
const SalesRepStock      = require('../../models/inventory/salesRepStock.model');
const GRN                = require('../../models/purchases/grn.model');
const SalesLedger        = require('../../models/ledger/SalesLedger.model');
const PurchaseLedger     = require('../../models/ledger/PurchaseLedger.model');
const StockLedger        = require('../../models/ledger/StockLedger.model');
const CustomerPayment    = require('../../models/finance/customerPayment.model');

// ── History models ────────────────────────────────────────────────
const SalesInvoiceHistory       = require('../../models/history/SalesInvoiceHistory.model');
const SalesReturnHistory        = require('../../models/history/SalesReturnHistory.model');
const StockAdjustmentHistory    = require('../../models/history/StockAdjustmentHistory.model');
const SalesRepStockHistory      = require('../../models/history/SalesRepStockHistory.model');
const GRNHistory                = require('../../models/history/GRNHistory.model');
const SalesLedgerHistory        = require('../../models/history/SalesLedgerHistory.model');
const PurchaseLedgerHistory     = require('../../models/history/PurchaseLedgerHistory.model');
const StockLedgerHistory        = require('../../models/history/StockLedgerHistory.model');
const CustomerPaymentHistory    = require('../../models/history/CustomerPaymentHistory.model');

// ── Period tracker ────────────────────────────────────────────────
const Period = require('../../models/period/Period.model');

/**
 * Archive a single collection to its history collection.
 * Idempotent — skips docs already archived for this period.
 */
const archiveCollection = async (SourceModel, HistoryModel, periodLabel, collectionName) => {
  const docs = await SourceModel.find({}).lean();

  if (!docs.length) {
    console.log(`  ⏭️  ${collectionName}: nothing to archive`);
    return 0;
  }

  // Check which are already archived (re-run protection)
  const existingOriginalIds = await HistoryModel
    .find({ period: periodLabel })
    .distinct('originalId');

  const existingSet = new Set(existingOriginalIds.map(id => id.toString()));
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
 * Clear a collection ONLY after confirming all docs are archived.
 * Safety gate — data is never lost.
 */
const safelyClearCollection = async (SourceModel, HistoryModel, periodLabel, collectionName) => {
  const currentCount  = await SourceModel.countDocuments();
  const archivedCount = await HistoryModel.countDocuments({ period: periodLabel });

  if (currentCount > archivedCount) {
    throw new Error(
      `Safety check failed for ${collectionName}: ` +
      `${currentCount} current docs but only ${archivedCount} archived. ` +
      `Re-run rollover to fix.`
    );
  }

  await SourceModel.deleteMany({});
  console.log(`  🗑️  ${collectionName}: cleared ${currentCount} docs`);
};

/**
 * Main rollover function.
 * Called by admin when business decides to close a period.
 *
 * @param {string} periodLabel - e.g. "2025-Q1", "JAN-2025", "PERIOD-1"
 * @param {string} performedBy - user _id of admin triggering rollover
 */
const performRollover = async (periodLabel, performedBy) => {
  if (!periodLabel || !periodLabel.trim()) {
    throw new Error('periodLabel is required (e.g. "2025-Q1" or "JAN-2025")');
  }

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
      status: 'started',
      checkpoint: 'none',
      startedAt: new Date(),
      startedBy: performedBy,
      summary: {},
    });
    console.log(`🚀 Starting rollover for period "${label}"`);
  }

  try {
    // ── Phase 1: Archive all collections ─────────────────────────
    job.status = 'archiving';
    await job.save();
    console.log('\n📦 Archiving collections...');

    const summary = {};
    summary.salesInvoices     = await archiveCollection(SalesInvoice,    SalesInvoiceHistory,    label, 'Sales Invoices');
    summary.salesReturns      = await archiveCollection(SalesReturn,      SalesReturnHistory,     label, 'Sales Returns');
    summary.stockAdjustments  = await archiveCollection(StockAdjustment,  StockAdjustmentHistory, label, 'Stock Adjustments');
    summary.salesRepStocks    = await archiveCollection(SalesRepStock,    SalesRepStockHistory,   label, 'SalesRep Stocks');
    summary.grns              = await archiveCollection(GRN,              GRNHistory,             label, 'GRNs');
    summary.salesLedger       = await archiveCollection(SalesLedger,      SalesLedgerHistory,     label, 'Sales Ledger');
    summary.purchaseLedger    = await archiveCollection(PurchaseLedger,   PurchaseLedgerHistory,  label, 'Purchase Ledger');
    summary.stockLedger       = await archiveCollection(StockLedger,      StockLedgerHistory,     label, 'Stock Ledger');
    summary.customerPayments  = await archiveCollection(CustomerPayment,  CustomerPaymentHistory, label, 'Customer Payments');

    job.checkpoint = 'archived';
    job.summary = summary;
    await job.save();

    // ── Phase 2: Clear current collections (safety-gated) ────────
    job.status = 'clearing';
    await job.save();
    console.log('\n🗑️  Clearing current period data...');

    await safelyClearCollection(SalesInvoice,   SalesInvoiceHistory,    label, 'Sales Invoices');
    await safelyClearCollection(SalesReturn,     SalesReturnHistory,     label, 'Sales Returns');
    await safelyClearCollection(StockAdjustment, StockAdjustmentHistory, label, 'Stock Adjustments');
    await safelyClearCollection(GRN,             GRNHistory,             label, 'GRNs');
    await safelyClearCollection(SalesLedger,     SalesLedgerHistory,     label, 'Sales Ledger');
    await safelyClearCollection(PurchaseLedger,  PurchaseLedgerHistory,  label, 'Purchase Ledger');
    await safelyClearCollection(StockLedger,     StockLedgerHistory,     label, 'Stock Ledger');
    await safelyClearCollection(CustomerPayment, CustomerPaymentHistory, label, 'Customer Payments');

    // SalesRepStock — clear and reset to zero (fresh stock for new period)
    await SalesRepStock.updateMany({}, {
      $set: { qtyOnHandPrimary: 0, qtyOnHandBase: 0, stockValueBase: 0, stockValuePrimary: 0 }
    });
    console.log(`  🔄 SalesRep Stocks: reset to zero for new period`);

    // ── Phase 3: Mark period completed ───────────────────────────
    job.status    = 'completed';
    job.checkpoint = 'done';
    job.closedAt  = new Date();
    job.closedBy  = performedBy;
    await job.save();

    console.log(`\n🎉 Period "${label}" closed successfully!`);

    return {
      success: true,
      period: label,
      summary,
      message: `Period "${label}" closed and archived successfully. Fresh period started.`,
    };

  } catch (error) {
    job.status        = 'failed';
    job.failedAt      = new Date();
    job.failureReason = error.message;
    await job.save();

    console.error(`\n❌ Rollover failed: ${error.message}`);
    console.error('💡 Re-run the rollover to resume. No data was deleted.');

    throw new Error(`Rollover failed: ${error.message}. Re-run to resume safely.`);
  }
};

/** Get all successfully closed periods */
const getClosedPeriods = async () => {
  return await Period.find({ status: 'completed' })
    .sort({ closedAt: -1 })
    .select('label closedAt closedBy summary startedAt');
};

/** Get active or failed rollover job status */
const getRolloverStatus = async () => {
  return await Period.findOne({
    status: { $in: ['started', 'archiving', 'clearing', 'failed'] }
  }).sort({ startedAt: -1 }) || null;
};

/**
 * Query historical data for a closed period
 * @param {string} model - see modelMap keys below
 * @param {string} period - period label e.g. "2025-Q1"
 */
const getHistoricalData = async (model, period) => {
  const modelMap = {
    invoices:       SalesInvoiceHistory,
    returns:        SalesReturnHistory,
    adjustments:    StockAdjustmentHistory,
    repStocks:      SalesRepStockHistory,
    grns:           GRNHistory,
    salesLedger:    SalesLedgerHistory,
    purchaseLedger: PurchaseLedgerHistory,
    stockLedger:    StockLedgerHistory,
    payments:       CustomerPaymentHistory,
  };

  const HistoryModel = modelMap[model];
  if (!HistoryModel) {
    throw new Error(`Unknown model: "${model}". Valid: ${Object.keys(modelMap).join(', ')}`);
  }

  return await HistoryModel.find({ period }).sort({ archivedAt: -1 });
};

module.exports = {
  performRollover,
  getClosedPeriods,
  getRolloverStatus,
  getHistoricalData,
};