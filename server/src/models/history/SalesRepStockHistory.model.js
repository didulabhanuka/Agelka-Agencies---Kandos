// server/src/models/history/SalesRepStockHistory.model.js
const { Schema, model, Types } = require("mongoose");

const SalesRepStockHistorySchema = new Schema({
  // ── Original fields ──────────────────────────────────────────
  salesRep: { type: Types.ObjectId, ref: "SalesRep" },
  item: { type: Types.ObjectId, ref: "Item" },
  qtyOnHandPrimary: { type: Number },
  qtyOnHandBase: { type: Number },
  factorToBase: { type: Number },
  stockValueBase: { type: Number },
  stockValuePrimary: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date },

  // ── History tracking fields ───────────────────────────────────
  originalId: { type: Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, {
  timestamps: false,
  collection: "salesrepstocks_history",
});

SalesRepStockHistorySchema.index({ period: 1, salesRep: 1 });

module.exports = model("SalesRepStockHistory", SalesRepStockHistorySchema);
