// server/src/models/history/PurchaseLedgerHistory.model.js
const { Schema, model, Types } = require("mongoose");

const PurchaseLedgerHistorySchema = new Schema({
  item: { type: Types.ObjectId, ref: "Item" },
  branch: { type: Types.ObjectId, ref: "Branch" },
  supplier: { type: Types.ObjectId, ref: "Supplier" },
  salesRep: { type: Types.ObjectId, ref: "SalesRep" },
  transactionType: { type: String },
  refModel: { type: String },
  refId: { type: Types.ObjectId },
  primaryQty: { type: Number },
  baseQty: { type: Number },
  factorToBase: { type: Number },
  avgCostPrimary: { type: Number },
  avgCostBase: { type: Number },
  discountAmount: { type: Number },
  totalCostValue: { type: Number },
  remarks: { type: String },
  createdBy: { type: Types.ObjectId },
  createdAt: { type: Date },
  updatedAt: { type: Date },
  // ── History tracking ─────────────────────────────────────────
  originalId: { type: Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: "purchaseledgers_history" });

PurchaseLedgerHistorySchema.index({ period: 1, item: 1 });
PurchaseLedgerHistorySchema.index({ period: 1, supplier: 1 });

module.exports = model("PurchaseLedgerHistory", PurchaseLedgerHistorySchema);
