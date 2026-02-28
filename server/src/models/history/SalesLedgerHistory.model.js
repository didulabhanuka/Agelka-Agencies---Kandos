// server/src/models/history/SalesLedgerHistory.model.js
const { Schema, model, Types } = require("mongoose");

const SalesLedgerHistorySchema = new Schema({
  item: { type: Types.ObjectId, ref: "Item" },
  branch: { type: Types.ObjectId, ref: "Branch" },
  customer: { type: Types.ObjectId, ref: "Customer" },
  salesRep: { type: Types.ObjectId, ref: "SalesRep" },
  transactionType: { type: String },
  refModel: { type: String },
  refId: { type: Types.ObjectId },
  factorToBase: { type: Number },
  primaryQty: { type: Number },
  baseQty: { type: Number },
  sellingPriceBase: { type: Number },
  sellingPricePrimary: { type: Number },
  grossSellingValue: { type: Number },
  discountAmount: { type: Number },
  totalSellingValue: { type: Number },
  remarks: { type: String },
  createdBy: { type: Types.ObjectId },
  createdAt: { type: Date },
  updatedAt: { type: Date },
  // ── History tracking ─────────────────────────────────────────
  originalId: { type: Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: "salesledgers_history" });

SalesLedgerHistorySchema.index({ period: 1, item: 1 });
SalesLedgerHistorySchema.index({ period: 1, customer: 1 });

module.exports = model("SalesLedgerHistory", SalesLedgerHistorySchema);
