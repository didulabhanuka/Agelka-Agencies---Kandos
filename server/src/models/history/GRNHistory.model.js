// server/src/models/history/GRNHistory.model.js
const { Schema, model, Types } = require("mongoose");

const GRNHistorySchema = new Schema({
  // ── Original fields ──────────────────────────────────────────
  grnNo: { type: String },
  supplier: { type: Types.ObjectId, ref: "Supplier" },
  salesRep: { type: Types.ObjectId, ref: "SalesRep" },
  createdByModel: { type: String },
  createdBy: { type: Types.ObjectId },
  items: [{
    item: { type: Types.ObjectId, ref: "Item" },
    avgCostPrimary: { type: Number },
    avgCostBase: { type: Number },
    factorToBase: { type: Number },
    primaryQty: { type: Number },
    baseQty: { type: Number },
    itemTotalValue: { type: Number },
    discountPerUnit: { type: Number },
  }],
  totalValue: { type: Number },
  receivedDate: { type: Date },
  status: { type: String },
  approvedBy: { type: Types.ObjectId },
  approvedAt: { type: Date },
  supplierInvoiceNo: { type: String },
  supplierInvoiceDate: { type: Date },
  branch: { type: Types.ObjectId, ref: "Branch" },
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
  collection: "grns_history",
});

GRNHistorySchema.index({ period: 1, archivedAt: -1 });
GRNHistorySchema.index({ period: 1, supplier: 1 });

module.exports = model("GRNHistory", GRNHistorySchema);
