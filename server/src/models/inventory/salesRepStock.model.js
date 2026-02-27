// models/inventory/saleRepStock.model.js
const { Schema, model, Types } = require("mongoose");

// Stores on-hand stock and stock value for each (salesRep, item) pair.
const salesRepStockSchema = new Schema({
  salesRep: { type: Types.ObjectId, ref: "SalesRep", required: true, index: true },
  item: { type: Types.ObjectId, ref: "Item", required: true, index: true },

  // Quantities tracked in both primary and base UOMs.
  qtyOnHandPrimary: { type: Number, default: 0 },
  qtyOnHandBase: { type: Number, default: 0 },

  // Conversion factor from primary UOM to base UOM (aligned with Item.factorToBase).
  factorToBase: { type: Number, default: 1 },

  // Cached stock values in base and primary terms.
  stockValueBase: { type: Number, default: 0 },
  stockValuePrimary: { type: Number, default: 0 },
}, { timestamps: true });

// Enforce a single stock row per sales rep and item combination.
salesRepStockSchema.index({ salesRep: 1, item: 1 }, { unique: true });

module.exports = model("SalesRepStock", salesRepStockSchema);