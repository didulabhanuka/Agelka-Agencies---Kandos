// models/inventory/StockAdjustment.model.js
const { Schema, model, Types } = require("mongoose");

// Stores one adjustment line with quantities, conversion factor, and value basis fields.
const adjustmentItemSchema = new Schema({
  item: { type: Types.ObjectId, ref: "Item", required: true },

  // Cost fields used for goods adjustment value calculations.
  avgCostPrimary: { type: Number, default: 0 },
  avgCostBase: { type: Number, default: 0 },

  // Selling price fields used for sales-related adjustment value calculations.
  sellingPricePrimary: { type: Number, default: 0 },
  sellingPriceBase: { type: Number, default: 0 },

  // Quantities tracked in both primary and base UOMs.
  primaryQty: { type: Number, required: true },
  baseQty: { type: Number, required: true },

  // Conversion factor from primary UOM to base UOM for this adjustment line.
  factorToBase: { type: Number, required: true, min: 0 },

  // Absolute quantity multiplied by base price (cost or selling) for this line.
  itemTotalValue: { type: Number, default: 0 },

  reason: { type: String, default: null },
}, { _id: false });

// Stores stock adjustment header data, line items, workflow status, and audit ownership fields.
const adjustmentSchema = new Schema({
  adjustmentNo: { type: String, required: true, unique: true, index: true },
  branch: { type: Types.ObjectId, ref: "Branch", required: true },
  salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },
  adjustmentDate: { type: Date, default: Date.now },

  // Namespaced adjustment types to separate goods vs sales stock impacts.
  type: {
    type: String,
    enum: ["adj-sale", "adj-sales-return", "adj-goods-receive", "adj-goods-return"],
    required: true,
  },

  // Optional links for audit traceability and reporting.
  relatedSupplier: { type: Types.ObjectId, ref: "Supplier", default: null },
  relatedCustomer: { type: Types.ObjectId, ref: "Customer", default: null },

  items: [adjustmentItemSchema],
  totalValue: { type: Number, default: 0 },

  // Approval workflow state for stock adjustment processing.
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

  // Creator ownership fields for internal users vs sales reps.
  createdBy: { type: Types.ObjectId, ref: "User", default: null },
  createdBySalesRep: { type: Types.ObjectId, ref: "SalesRep", default: null },
}, { timestamps: true });

// Indexes to speed up branch/salesRep timeline queries.
adjustmentSchema.index({ branch: 1, adjustmentDate: -1 });
adjustmentSchema.index({ salesRep: 1, adjustmentDate: -1 });

module.exports = model("StockAdjustment", adjustmentSchema);