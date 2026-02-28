// server/src/models/history/StockAdjustmentHistory.model.js
const { Schema, model, Types } = require("mongoose");

const StockAdjustmentHistorySchema = new Schema({
  // ── Original fields ──────────────────────────────────────────
  adjustmentNo: { type: String },
  branch: { type: Types.ObjectId, ref: "Branch" },
  salesRep: { type: Types.ObjectId, ref: "SalesRep" },
  adjustmentDate: { type: Date },
  type: { type: String },
  relatedSupplier: { type: Types.ObjectId, ref: "Supplier" },
  relatedCustomer: { type: Types.ObjectId, ref: "Customer" },
  items: [{
    item: { type: Types.ObjectId, ref: "Item" },
    avgCostPrimary: { type: Number },
    avgCostBase: { type: Number },
    sellingPricePrimary: { type: Number },
    sellingPriceBase: { type: Number },
    primaryQty: { type: Number },
    baseQty: { type: Number },
    factorToBase: { type: Number },
    itemTotalValue: { type: Number },
    reason: { type: String },
  }],
  totalValue: { type: Number },
  status: { type: String },
  approvedBy: { type: Types.ObjectId },
  approvedAt: { type: Date },
  cancelledBy: { type: Types.ObjectId },
  cancelledAt: { type: Date },
  remarks: { type: String },
  createdBy: { type: Types.ObjectId },
  createdBySalesRep: { type: Types.ObjectId },
  createdAt: { type: Date },
  updatedAt: { type: Date },

  // ── History tracking fields ───────────────────────────────────
  originalId: { type: Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, {
  timestamps: false,
  collection: "stockadjustments_history",
});

StockAdjustmentHistorySchema.index({ period: 1, archivedAt: -1 });

module.exports = model("StockAdjustmentHistory", StockAdjustmentHistorySchema);
