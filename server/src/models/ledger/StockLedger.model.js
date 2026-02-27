// models/inventory/StockLedger.model.js
const { Schema, model, Types } = require("mongoose");

// Stores stock movement ledger entries with UOM movement, price snapshots, and running balance.
const stockLedgerSchema = new Schema({
  // Core references for item, branch, and optional sales rep stock stream.
  item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
  branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
  salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

  // Source transaction metadata for traceability.
  transactionType: { type: String, required: true, index: true },
  refModel: { type: String, required: true },
  refId: { type: Types.ObjectId, required: true, index: true },

  // UOM-aware movement quantities captured for the transaction.
  factorToBase: { type: Number, default: 1 },
  primaryQty: { type: Number, default: 0 },
  baseQty: { type: Number, default: 0 },

  // Cost and selling price snapshots captured at movement time.
  avgCostBase: { type: Number, default: 0 },
  avgCostPrimary: { type: Number, default: 0 },
  sellingPriceBase: { type: Number, default: 0, index: true },
  sellingPricePrimary: { type: Number, default: 0 },

  // Monetary value for the movement (typically cost-based).
  itemTotalValue: { type: Number, default: 0 },

  // Running stock balance for the ledger stream (stored as base-equivalent quantity).
  runningBalance: { type: Number, required: true },

  remarks: { type: String },
  createdBy: { type: Types.ObjectId, ref: "User" },
}, { timestamps: true });

// Index to fetch latest movements by item and branch.
stockLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });

// Composite index to support dedupe/lookups per stock stream and source transaction.
stockLedgerSchema.index({ item: 1, branch: 1, salesRep: 1, refModel: 1, refId: 1, transactionType: 1 });

module.exports = model("StockLedger", stockLedgerSchema);