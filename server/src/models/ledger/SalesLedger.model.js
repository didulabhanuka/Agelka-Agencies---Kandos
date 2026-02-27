// models/ledger/SalesLedger.model.js
const { Schema, model, Types } = require("mongoose");

// Stores sales-side ledger entries with UOM quantities, price snapshot, and transaction references.
const salesLedgerSchema = new Schema({
  // Core references for item, branch, customer, and optional sales rep ownership.
  item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
  branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
  customer: { type: Types.ObjectId, ref: "Customer" },
  salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

  // Source transaction metadata for traceability to invoice/return records.
  transactionType: { type: String, required: true, index: true },
  refModel: { type: String, required: true },
  refId: { type: Types.ObjectId, required: true, index: true },

  // UOM-aware quantity snapshot captured at posting time.
  factorToBase: { type: Number, required: true },
  primaryQty: { type: Number, required: true },
  baseQty: { type: Number, required: true },

  // Selling price snapshot captured at the time of posting.
  sellingPriceBase: { type: Number, default: 0 },
  sellingPricePrimary: { type: Number, default: 0 },

  // Financial values for gross, discount, and net line totals.
  grossSellingValue: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  totalSellingValue: { type: Number, default: 0 },

  remarks: { type: String },
  createdBy: { type: Types.ObjectId, ref: "User" },
}, { timestamps: true });

// Indexes for item/branch timelines, source lookups, customer reports, and sales rep reports.
salesLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });
salesLedgerSchema.index({ refModel: 1, refId: 1 });
salesLedgerSchema.index({ customer: 1, createdAt: -1 });
salesLedgerSchema.index({ salesRep: 1, createdAt: -1 });

module.exports = model("SalesLedger", salesLedgerSchema);