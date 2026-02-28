// server/src/models/history/SalesInvoiceHistory.model.js
const mongoose = require("mongoose");

const InvoiceReturnItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  qtyReturnedBase: { type: Number, default: 0 },
  qtyReturnedPrimary: { type: Number, default: 0 },
  valueReturnedBase: { type: Number, default: 0 },
  valueReturnedPrimary: { type: Number, default: 0 },
  totalValueReturned: { type: Number },
}, { _id: false });

const InvoiceReturnSchema = new mongoose.Schema({
  returnId: { type: mongoose.Schema.Types.ObjectId },
  returnNo: { type: String },
  returnDate: { type: Date },
  totalReturnValue: { type: Number },
  items: [InvoiceReturnItemSchema],
}, { _id: false });

const PaymentAllocationSchema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId },
  amount: { type: Number },
  date: { type: Date },
  method: { type: String },
  referenceNo: { type: String },
  collectedBy: { type: mongoose.Schema.Types.ObjectId },
}, { _id: false });

const SalesInvoiceHistorySchema = new mongoose.Schema({
  // ── Original fields ──────────────────────────────────────────
  invoiceNo: { type: String },
  salesRep: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep" },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    sellingPriceBase: { type: Number },
    sellingPricePrimary: { type: Number },
    factorToBase: { type: Number },
    primaryQty: { type: Number },
    baseQty: { type: Number },
    totalSellingValue: { type: Number },
    discountPerUnit: { type: Number },
    baseUom: { type: String },
    primaryUom: { type: String },
  }],
  totalValue: { type: Number },
  hasReturns: { type: Boolean },
  totalReturnedValue: { type: Number },
  totalBalanceValue: { type: Number },
  returns: [InvoiceReturnSchema],
  paidAmount: { type: Number },
  paymentStatus: { type: String },
  paymentAllocations: [PaymentAllocationSchema],
  status: { type: String },
  invoiceDate: { type: Date },
  remarks: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId },
  approvedAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId },
  cancelledAt: { type: Date },
  createdAt: { type: Date },
  updatedAt: { type: Date },

  // ── History tracking fields ───────────────────────────────────
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, {
  timestamps: false,
  collection: "salesinvoices_history",
});

SalesInvoiceHistorySchema.index({ period: 1, archivedAt: -1 });
SalesInvoiceHistorySchema.index({ period: 1, customer: 1 });

module.exports = mongoose.model("SalesInvoiceHistory", SalesInvoiceHistorySchema);
