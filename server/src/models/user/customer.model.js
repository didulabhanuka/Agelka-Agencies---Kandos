// models/user/Customer.model.js
const { Schema, model, Types } = require("mongoose");

// Stores customer master data, sales rep assignment, and credit-control fields.
const customerSchema = new Schema({
  customerCode: { type: String, unique: true, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  owner: { type: String, required: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },

  salesRep: { type: Types.ObjectId, ref: "SalesRep" },

  // Credit control limits and current computed/manual status.
  creditLimit: { type: Number, required: true, default: 0 },
  creditPeriod: { type: Number, required: true, default: 0 },
  creditStatus: { type: String, enum: ["good", "warning", "overdue", "over-limit", "blocked"], default: "good" },

  // Customer operational status in the system.
  status: { type: String, required: true, enum: ["active", "suspended"], default: "active" },

  // Reference arrays for related invoices and customer payments.
  saleInvoices: [{ type: Types.ObjectId, ref: "SalesInvoice" }],
  payments: [{ type: Types.ObjectId, ref: "CustomerPayment" }],
}, { timestamps: true });

module.exports = model("Customer", customerSchema);