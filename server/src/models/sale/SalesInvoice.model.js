// src/models/sale/SalesInvoice.model.js
const mongoose = require("mongoose");

// Stores returned quantities/values per item for a linked sales return on an invoice.
const InvoiceReturnItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  qtyReturnedBase: { type: Number, default: 0, min: 0 },
  qtyReturnedPrimary: { type: Number, default: 0, min: 0 },
  valueReturnedBase: { type: Number, default: 0, min: 0 },
  valueReturnedPrimary: { type: Number, default: 0, min: 0 },
  totalValueReturned: { type: Number, required: true, min: 0 },
}, { _id: false });

// Stores one linked sales return summary embedded inside the invoice.
const InvoiceReturnSchema = new mongoose.Schema({
  returnId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesReturn", required: true },
  returnNo: { type: String, required: true },
  returnDate: { type: Date, required: true },
  totalReturnValue: { type: Number, required: true },
  items: [InvoiceReturnItemSchema],
}, { _id: false });

// Stores payment allocation history applied to the invoice.
const PaymentAllocationSchema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPayment", required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  method: { type: String, enum: ["cash", "cheque", "bank-transfer", "other"], required: true },
  referenceNo: { type: String, trim: true },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep" },
}, { _id: false });

// Stores sales invoice header, line items, returns, payments, and approval workflow fields.
const SalesInvoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true, trim: true },
  salesRep: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep", default: null, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

  // Invoice line items with UOM-aware quantities and selling price snapshot.
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    sellingPriceBase: { type: Number, required: true },
    sellingPricePrimary: { type: Number, required: true },
    factorToBase: { type: Number, required: true },
    primaryQty: { type: Number, required: true },
    baseQty: { type: Number, required: true },
    totalSellingValue: { type: Number, required: true },
    discountPerUnit: { type: Number, default: 0 },
    baseUom: { type: String, default: "null" }, 
    primaryUom: { type: String, default: "null" },
  }],

  totalValue: { type: Number, required: true },

  // Return tracking (balance is reduced by returns, not by payments).
  hasReturns: { type: Boolean, default: false },
  totalReturnedValue: { type: Number, default: 0 },
  totalBalanceValue: { type: Number, default: 0 },
  returns: [InvoiceReturnSchema],

  // Payment tracking and payment allocation history.
  paidAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["unpaid", "partially_paid", "paid"], default: "unpaid" },
  paymentAllocations: [PaymentAllocationSchema],

  // Approval workflow and invoice metadata.
  status: { type: String, enum: ["draft", "waiting_for_approval", "approved", "cancelled"], default: "waiting_for_approval" },
  invoiceDate: { type: Date, required: true },
  remarks: { type: String, trim: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  cancelledAt: { type: Date },
}, { timestamps: true });

// Indexes for customer/status filtering and date-based reporting.
SalesInvoiceSchema.index({ customer: 1, status: 1 });
SalesInvoiceSchema.index({ invoiceDate: -1 });
SalesInvoiceSchema.index({ salesRep: 1, invoiceDate: -1 });

module.exports = mongoose.model("SalesInvoice", SalesInvoiceSchema);