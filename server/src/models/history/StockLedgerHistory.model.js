// server/src/models/history/StockLedgerHistory.model.js
const { Schema, model, Types } = require("mongoose");

const StockLedgerHistorySchema = new Schema({
  item: { type: Types.ObjectId, ref: "Item" },
  branch: { type: Types.ObjectId, ref: "Branch" },
  salesRep: { type: Types.ObjectId, ref: "SalesRep" },
  transactionType: { type: String },
  refModel: { type: String },
  refId: { type: Types.ObjectId },
  factorToBase: { type: Number },
  primaryQty: { type: Number },
  baseQty: { type: Number },
  avgCostBase: { type: Number },
  avgCostPrimary: { type: Number },
  sellingPriceBase: { type: Number },
  sellingPricePrimary: { type: Number },
  itemTotalValue: { type: Number },
  runningBalance: { type: Number },
  remarks: { type: String },
  createdBy: { type: Types.ObjectId },
  createdAt: { type: Date },
  updatedAt: { type: Date },
  // ── History tracking ─────────────────────────────────────────
  originalId: { type: Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: "stockledgers_history" });

StockLedgerHistorySchema.index({ period: 1, item: 1 });
StockLedgerHistorySchema.index({ period: 1, branch: 1 });

module.exports = model("StockLedgerHistory", StockLedgerHistorySchema);
