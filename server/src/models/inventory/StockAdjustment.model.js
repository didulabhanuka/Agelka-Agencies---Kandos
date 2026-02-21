// // models/inventory/StockAdjustment.model.js
// const { Schema, model, Types } = require("mongoose");

// const adjustmentItemSchema = new Schema(
//   {
//     item: { type: Types.ObjectId, ref: "Item", required: true },
//     qty: { type: Number, required: true },

//     // For goods adjustments (adj-goods-*)
//     avgCostBase: { type: Number, default: 0 },

//     // For sales adjustments (adj-sale / adj-sales-return)
//     sellingPriceBase: { type: Number, default: 0 },

//     // Abs(qty) * priceBase (avgCostBase or sellingPriceBase)
//     itemTotalValue: { type: Number, default: 0 },

//     reason: { type: String, default: null },
//   },
//   { _id: false }
// );

// const adjustmentSchema = new Schema(
//   {
//     adjustmentNo: { type: String, required: true, unique: true, index: true },

//     branch: { type: Types.ObjectId, ref: "Branch", required: true },

//     // ✅ NEW: ownership / scoping
//     salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

//     adjustmentDate: { type: Date, default: Date.now },

//     // Namespaced types
//     type: {
//       type: String,
//       enum: ["adj-sale", "adj-sales-return", "adj-goods-receive", "adj-goods-return"],
//       required: true,
//     },

//     // Optional links (audit/analytics)
//     relatedSupplier: { type: Types.ObjectId, ref: "Supplier", default: null },
//     relatedCustomer: { type: Types.ObjectId, ref: "Customer", default: null },

//     items: [adjustmentItemSchema],
//     totalValue: { type: Number, default: 0 },

//     status: {
//       type: String,
//       enum: ["waiting_for_approval", "approved", "cancelled"],
//       default: "waiting_for_approval",
//     },

//     approvedBy: { type: Types.ObjectId, ref: "User" },
//     approvedAt: { type: Date },
//     cancelledBy: { type: Types.ObjectId, ref: "User" },
//     cancelledAt: { type: Date },

//     remarks: { type: String },

//     // Keep existing field for Admin/DataEntry creates
//     createdBy: { type: Types.ObjectId, ref: "User", default: null },

//     // ✅ NEW: if SalesRep creates
//     createdBySalesRep: { type: Types.ObjectId, ref: "SalesRep", default: null },
//   },
//   { timestamps: true }
// );

// adjustmentSchema.index({ branch: 1, adjustmentDate: -1 });
// adjustmentSchema.index({ salesRep: 1, adjustmentDate: -1 });

// module.exports = model("StockAdjustment", adjustmentSchema);






// models/inventory/StockAdjustment.model.js
const { Schema, model, Types } = require("mongoose");

const adjustmentItemSchema = new Schema(
  {
    item: { type: Types.ObjectId, ref: "Item", required: true },

    // For goods adjustments (adj-goods-*), we're keeping avgCostBase.
    avgCostPrimary: { type: Number, default: 0 }, // Added avgCostPrimary
    avgCostBase: { type: Number, default: 0 },    // For calculating the total cost for base UOM

    // For sales adjustments (adj-sale / adj-sales-return)
    sellingPricePrimary: { type: Number, default: 0 }, // Added sellingPricePrimary
    sellingPriceBase: { type: Number, default: 0 },    // For calculating total selling value

    // Primary and Base Quantities
    primaryQty: { type: Number, required: true },  // Quantity in Primary UOM
    baseQty: { type: Number, required: true },     // Quantity in Base UOM

    // Conversion factor from primary to base UOM
    factorToBase: { type: Number, required: true, min: 0 },

    // Abs(qty) * priceBase (avgCostBase or sellingPriceBase) => itemTotalValue
    itemTotalValue: { type: Number, default: 0 },

    reason: { type: String, default: null },
  },
  { _id: false }
);

const adjustmentSchema = new Schema(
  {
    adjustmentNo: { type: String, required: true, unique: true, index: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true },
    salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },
    adjustmentDate: { type: Date, default: Date.now },

    // Namespaced types
    type: {
      type: String,
      enum: ["adj-sale", "adj-sales-return", "adj-goods-receive", "adj-goods-return"],
      required: true,
    },

    // Optional links (audit/analytics)
    relatedSupplier: { type: Types.ObjectId, ref: "Supplier", default: null },
    relatedCustomer: { type: Types.ObjectId, ref: "Customer", default: null },

    items: [adjustmentItemSchema],
    totalValue: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["waiting_for_approval", "approved", "cancelled"],
      default: "waiting_for_approval",
    },

    approvedBy: { type: Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    cancelledBy: { type: Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },

    remarks: { type: String },

    // Keep existing field for Admin/DataEntry creates
    createdBy: { type: Types.ObjectId, ref: "User", default: null },
    createdBySalesRep: { type: Types.ObjectId, ref: "SalesRep", default: null },
  },
  { timestamps: true }
);

// Indexes for performance
adjustmentSchema.index({ branch: 1, adjustmentDate: -1 });
adjustmentSchema.index({ salesRep: 1, adjustmentDate: -1 });

module.exports = model("StockAdjustment", adjustmentSchema);
