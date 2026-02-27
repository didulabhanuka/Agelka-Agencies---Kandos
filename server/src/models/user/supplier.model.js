// models/user/Supplier.model.js
const { Schema, model } = require("mongoose");

// Stores supplier master data, linked items/transactions, and optional sales rep ownership.
const supplierSchema = new Schema({
  supplierCode: { type: String, unique: true, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },
  owner: { type: String, required: true, trim: true },
  items: [{ type: Schema.Types.ObjectId, ref: "Item" }],
  status: { type: String, required: true, enum: ["active", "inactive"], default: "active" },
  grns: [{ type: Schema.Types.ObjectId, ref: 'GRN' }],
  purchaseOrders: [{ type: Schema.Types.ObjectId, ref: "PurchaseOrder" }],
  salesRep: { type: Schema.Types.ObjectId, ref: "SalesRep" },
}, { timestamps: true });

module.exports = model("Supplier", supplierSchema);