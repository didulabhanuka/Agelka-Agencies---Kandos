// models/purchases/grn.model.js
const { Schema, model, Types } = require("mongoose");

// Stores one GRN line with UOM quantities, conversion factor, and cost snapshot values.
const grnItemSchema = new Schema({
  item: { type: Types.ObjectId, ref: "Item", required: true },
  avgCostPrimary: { type: Number, required: true, min: 0 },
  avgCostBase: { type: Number, required: true, min: 0 },
  factorToBase: { type: Number, required: true, min: 0 }, // Primary-to-base UOM conversion factor.
  primaryQty: { type: Number, required: true, min: 0 }, // Quantity in primary UOM.
  baseQty: { type: Number, required: true, min: 0 }, // Quantity in base UOM.
  itemTotalValue: { type: Number, required: true, min: 0 },
  discountPerUnit: { type: Number, default: 0 },
}, { _id: false });

// Stores GRN header data, line items, approval workflow state, and source actor ownership.
const grnSchema = new Schema({
  grnNo: { type: String, unique: true, required: true, index: true, immutable: true },
  supplier: { type: Types.ObjectId, ref: "Supplier", required: true, index: true },
  salesRep: { type: Types.ObjectId, ref: "SalesRep", required: true, index: true },
  createdByModel: { type: String, required: true, enum: ["User", "SalesRep"] },
  createdBy: { type: Types.ObjectId, required: true, refPath: "createdByModel" },
  items: { type: [grnItemSchema], validate: (v) => v.length > 0 },
  totalValue: { type: Number, required: true, min: 0 },
  receivedDate: { type: Date, required: true, index: true },
  status: { type: String, enum: ["waiting_for_approval", "approved", "cancelled"], default: "waiting_for_approval", index: true },
  approvedBy: { type: Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  supplierInvoiceNo: { type: String, trim: true },
  supplierInvoiceDate: { type: Date },
  branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  cancelledBy: { type: Types.ObjectId, ref: "User", default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = model("GRN", grnSchema);