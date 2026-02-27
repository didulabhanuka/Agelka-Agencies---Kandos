// src/models/sale/SalesReturn.model.js
const { Schema, model, Types } = require("mongoose");

// Stores sales return header, UOM-aware return lines, and approval workflow fields.
const SalesReturnSchema = new Schema({
  returnNo: { type: String, required: true, unique: true, trim: true },
  salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },
  originalInvoice: { type: Types.ObjectId, ref: "SalesInvoice", default: null },
  customer: { type: Types.ObjectId, ref: "Customer", required: true },
  branch: { type: Types.ObjectId, ref: "Branch", required: true },

  // Return line items with returned quantities, selling price snapshot, and UOM conversion data.
  items: [{
    item: { type: Types.ObjectId, ref: "Item", required: true },
    qtyReturnPrimary: { type: Number, required: true },
    qtyReturnBase: { type: Number, required: true },
    sellingPriceBase: { type: Number, required: true },
    sellingPricePrimary: { type: Number, required: true },
    factorToBase: { type: Number, required: true },
    discountPerUnit: { type: Number, default: 0 },
    totalSellingValue: { type: Number, required: true },
  }],

  totalReturnValue: { type: Number, required: true },

  // Approval workflow state for sales return processing.
  status: { type: String, enum: ["waiting_for_approval", "approved", "cancelled"], default: "waiting_for_approval" },

  returnDate: { type: Date, required: true },
  remarks: { type: String, trim: true },

  approvedBy: { type: Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  cancelledBy: { type: Types.ObjectId, ref: "User" },
  cancelledAt: { type: Date },
}, { timestamps: true });

// Indexes for sales rep/date views and original invoice return lookups.
SalesReturnSchema.index({ salesRep: 1, returnDate: -1 });
SalesReturnSchema.index({ originalInvoice: 1, status: 1 });

module.exports = model("SalesReturn", SalesReturnSchema);