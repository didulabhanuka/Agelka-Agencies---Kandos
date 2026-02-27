/**
 * Period Rollover Service
 * File: server/src/services/period/periodRollover.service.js
 *
 * Atomically archives all current-period data and starts a fresh period.
 * Uses MongoDB ACID transactions — requires Atlas M10 replica set.
 */

const mongoose = require('mongoose');

// Current period models
const SalesInvoice = require('../../models/sale/SalesInvoice.model');
const SalesReturn = require('../../models/sale/SalesReturn.model');
const GRN = require('../../models/purchases/grn.model');
const SalesLedger = require('../../models/ledger/SalesLedger.model');
const PurchaseLedger = require('../../models/ledger/PurchaseLedger.model');
const StockLedger = require('../../models/ledger/StockLedger.model');
const Item = require('../../models/inventory/item.model');
const StockAdjustment = require('../../models/inventory/StockAdjustment.model');
const CustomerPayment = require('../../models/finance/customerPayment.model');

// ── History Models (create these new files — see bottom of this file) ──
const SalesInvoiceHistory = require('../../models/history/SalesInvoiceHistory.model');
const SalesReturnHistory = require('../../models/history/SalesReturnHistory.model');
const GRNHistory = require('../../models/history/GRNHistory.model');
const SalesLedgerHistory = require('../../models/history/SalesLedgerHistory.model');
const PurchaseLedgerHistory = require('../../models/history/PurchaseLedgerHistory.model');
const StockLedgerHistory = require('../../models/history/StockLedgerHistory.model');
const StockAdjustmentHistory = require('../../models/history/StockAdjustmentHistory.model');
const CustomerPaymentHistory = require('../../models/history/CustomerPaymentHistory.model');
const ItemSnapshot = require('../../models/history/ItemSnapshot.model');
const Period = require('../../models/period/Period.model');

/**
 * Performs the monthly period rollover atomically.
 * If ANY step fails, ALL changes are rolled back — data stays safe.
 *
 * @param {string} periodLabel - e.g. "2025-01" (YYYY-MM)
 * @param {string} performedBy - user ID who triggered the rollover
 */
const performMonthlyRollover = async (periodLabel, performedBy) => {
  // Validate period label format
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodLabel)) {
    throw new Error('Invalid periodLabel format. Use YYYY-MM (e.g. 2025-01)');
  }

  // Check this period hasn't already been closed
  const existing = await Period.findOne({ label: periodLabel });
  if (existing) {
    throw new Error(`Period ${periodLabel} has already been closed`);
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {

      const archivedAt = new Date();

      // ── Step 1: Fetch all current data ──────────────────────────
      const [
        invoices, returns, grns,
        salesLedger, purchaseLedger, stockLedger,
        adjustments, payments, items
      ] = await Promise.all([
        SalesInvoice.find({}).session(session).lean(),
        SalesReturn.find({}).session(session).lean(),
        GRN.find({}).session(session).lean(),
        SalesLedger.find({}).session(session).lean(),
        PurchaseLedger.find({}).session(session).lean(),
        StockLedger.find({}).session(session).lean(),
        StockAdjustment.find({}).session(session).lean(),
        CustomerPayment.find({}).session(session).lean(),
        Item.find({}).session(session).lean(),
      ]);

      // Helper: strip _id and add period metadata
      const withPeriod = (docs) =>
        docs.map(({ _id, ...doc }) => ({
          ...doc,
          originalId: _id,
          period: periodLabel,
          archivedAt,
        }));

      // ── Step 2: Archive everything to history collections ────────
      const archiveTasks = [];

      if (invoices.length) archiveTasks.push(SalesInvoiceHistory.insertMany(withPeriod(invoices), { session }));
      if (returns.length) archiveTasks.push(SalesReturnHistory.insertMany(withPeriod(returns), { session }));
      if (grns.length) archiveTasks.push(GRNHistory.insertMany(withPeriod(grns), { session }));
      if (salesLedger.length) archiveTasks.push(SalesLedgerHistory.insertMany(withPeriod(salesLedger), { session }));
      if (purchaseLedger.length) archiveTasks.push(PurchaseLedgerHistory.insertMany(withPeriod(purchaseLedger), { session }));
      if (stockLedger.length) archiveTasks.push(StockLedgerHistory.insertMany(withPeriod(stockLedger), { session }));
      if (adjustments.length) archiveTasks.push(StockAdjustmentHistory.insertMany(withPeriod(adjustments), { session }));
      if (payments.length) archiveTasks.push(CustomerPaymentHistory.insertMany(withPeriod(payments), { session }));

      // Snapshot item stock levels at period close
      if (items.length) {
        archiveTasks.push(ItemSnapshot.insertMany(
          items.map(({ _id, ...item }) => ({
            ...item,
            originalId: _id,
            period: periodLabel,
            snapshotType: 'closing',
            archivedAt,
          })),
          { session }
        ));
      }

      await Promise.all(archiveTasks);

      // ── Step 3: Clear transactional data ────────────────────────
      await Promise.all([
        SalesInvoice.deleteMany({}).session(session),
        SalesReturn.deleteMany({}).session(session),
        GRN.deleteMany({}).session(session),
        SalesLedger.deleteMany({}).session(session),
        PurchaseLedger.deleteMany({}).session(session),
        StockLedger.deleteMany({}).session(session),
        StockAdjustment.deleteMany({}).session(session),
        CustomerPayment.deleteMany({}).session(session),
        // NOTE: Items are NOT deleted — stock carries forward
      ]);

      // ── Step 4: Log the closed period ───────────────────────────
      await Period.create([{
        label: periodLabel,
        closedAt: archivedAt,
        closedBy: performedBy,
        status: 'closed',
        summary: {
          invoices: invoices.length,
          salesReturns: returns.length,
          grns: grns.length,
          salesLedgerEntries: salesLedger.length,
          purchaseLedgerEntries: purchaseLedger.length,
          stockLedgerEntries: stockLedger.length,
          adjustments: adjustments.length,
          payments: payments.length,
          itemsCarriedForward: items.length,
        },
      }], { session });

    }); // ← if anything above throws, entire transaction is rolled back

    return {
      success: true,
      period: periodLabel,
      message: `Period ${periodLabel} closed and archived successfully`,
    };

  } catch (error) {
    throw new Error(`Rollover failed — no data was changed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

/**
 * Get list of all closed periods
 */
const getClosedPeriods = async () => {
  return await Period.find({ status: 'closed' })
    .sort({ label: -1 })
    .select('label closedAt closedBy summary');
};

/**
 * Query historical data for a specific period
 * @param {string} model - 'invoices' | 'grns' | 'salesLedger' | etc.
 * @param {string} period - 'current' | 'YYYY-MM'
 */
const getHistoricalData = async (model, period) => {
  const modelMap = {
    invoices: { current: SalesInvoice, history: SalesInvoiceHistory },
    returns: { current: SalesReturn, history: SalesReturnHistory },
    grns: { current: GRN, history: GRNHistory },
    salesLedger: { current: SalesLedger, history: SalesLedgerHistory },
    purchaseLedger: { current: PurchaseLedger, history: PurchaseLedgerHistory },
    stockLedger: { current: StockLedger, history: StockLedgerHistory },
    payments: { current: CustomerPayment, history: CustomerPaymentHistory },
  };

  const target = modelMap[model];
  if (!target) throw new Error(`Unknown model: ${model}`);

  if (period === 'current') {
    return await target.current.find({});
  }
  return await target.history.find({ period });
};

module.exports = {
  performMonthlyRollover,
  getClosedPeriods,
  getHistoricalData,
};


/* ═══════════════════════════════════════════════════════════════════
   HISTORY MODEL TEMPLATE
   Create one file per model in server/src/models/history/
   Example: server/src/models/history/SalesInvoiceHistory.model.js
   ═══════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const SalesInvoiceHistorySchema = new mongoose.Schema(
  {
    // Copy all fields from your SalesInvoice.model.js here
    // Then add these period tracking fields:
    originalId: { type: mongoose.Schema.Types.ObjectId },
    period: { type: String, required: true, index: true },  // e.g. "2025-01"
    archivedAt: { type: Date, required: true },
  },
  {
    timestamps: false,
    collection: 'sales_invoices_history',  // separate collection
  }
);

// Index for fast period queries
SalesInvoiceHistorySchema.index({ period: 1, archivedAt: -1 });

module.exports = mongoose.model('SalesInvoiceHistory', SalesInvoiceHistorySchema);

*/
