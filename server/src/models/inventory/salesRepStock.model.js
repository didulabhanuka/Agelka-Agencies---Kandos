// // models/inventory/salesRepStock.model.js
// const { Schema, model, Types } = require("mongoose");

// const salesRepStockSchema = new Schema(
//   {
//     salesRep: { type: Types.ObjectId, ref: "SalesRep", required: true, index: true },
//     item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
//     qtyOnHand: { type: Number, default: 0 },
//   },
//   { timestamps: true }
// );

// // one row per (salesRep, item)
// salesRepStockSchema.index({ salesRep: 1, item: 1 }, { unique: true });

// module.exports = model("SalesRepStock", salesRepStockSchema);



const { Schema, model, Types } = require("mongoose");

const salesRepStockSchema = new Schema(
  {
    salesRep: { type: Types.ObjectId, ref: "SalesRep", required: true, index: true },
    item: { type: Types.ObjectId, ref: "Item", required: true, index: true },

    // Quantities in Primary and Base UOM
    qtyOnHandPrimary: { type: Number, default: 0 }, // Stock in Primary UOM
    qtyOnHandBase: { type: Number, default: 0 },    // Stock in Base UOM

    // The factor to convert Primary UOM to Base UOM (should align with the Item's factorToBase)
    factorToBase: { type: Number, default: 1 },  // Factor for UOM conversion from Primary to Base

    // Additional information about the stock value
    stockValueBase: { type: Number, default: 0 },   // Value in Base UOM
    stockValuePrimary: { type: Number, default: 0 }, // Value in Primary UOM
  },
  { timestamps: true }
);

// one row per (salesRep, item) pair
salesRepStockSchema.index({ salesRep: 1, item: 1 }, { unique: true });

module.exports = model("SalesRepStock", salesRepStockSchema);
