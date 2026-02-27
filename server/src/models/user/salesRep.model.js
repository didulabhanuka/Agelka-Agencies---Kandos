// models/user/saleRep.model.js
const { Schema, model } = require("mongoose");

// Stores sales rep master data, login capability fields, and related transaction references.
const salesRepSchema = new Schema({
  repCode: { type: String, unique: true, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  contactNumber: { type: String, trim: true },
  route: { type: String, trim: true, default: null },
  address: { type: String, trim: true, default: null },
  NIC: { type: String, trim: true, default: null },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  role: { type: String, default: "SalesRep" },

  passwordHash: { type: String, default: null, select: false },
  canLogin: { type: Boolean, default: false },
  lastLogin: { type: Date, default: null },

  grns: [{ type: Schema.Types.ObjectId, ref: "GRN" }],
  salesInvoices: [{ type: Schema.Types.ObjectId, ref: "SalesInvoice" }], 

}, { timestamps: true });

module.exports = model("SalesRep", salesRepSchema);