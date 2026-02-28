// server/src/models/history/SalesReturnHistory.model.js
const { Schema, model, Types } = require("mongoose");

const SalesReturnHistorySchema = new Schema({
  // ── Original fields ──────────────────────────────────────────
  returnNo: { type: String },
  salesRep: { type: Types.ObjectId, ref: "SalesRep" },
  originalInvoice: { type: Types.ObjectId, ref: "SalesInvoice" },
  customer: { type: Types.ObjectId, ref: "Customer" },
  branch: { type: Types.ObjectId, ref: "Branch" },
  items: [{
    item: { type: Types.ObjectId, ref: "Item" },
    qtyReturnPrimary: { type: Number },
    qtyReturnBase: { type: Number },
    sellingPriceBase: { type: Number },
    sellingPricePrimary: { type: Number },
    factorToBase: { type: Number },
    discountPerUnit: { type: Number },
    totalSellingValue: { type: Number },
  }],
  totalReturnValue: { type: Number },
  status: { type: String },
  returnDate: { type: Date },
  remarks: { type: String },
  approvedBy: { type: Types.ObjectId },
  approvedAt: { type: Date },
  cancelledBy: { type: Types.ObjectId },
  cancelledAt: { type: Date },
  createdAt: { type: Date },
  updatedAt: { type: Date },

  // ── History tracking fields ───────────────────────────────────
  originalId: { type: Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, {
  timestamps: false,
  collection: "salesreturns_history",
});

SalesReturnHistorySchema.index({ period: 1, archivedAt: -1 });

module.exports = model("SalesReturnHistory", SalesReturnHistorySchema);
