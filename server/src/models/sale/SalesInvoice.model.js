// // src/models/sale/SalesInvoice.model.js
// const mongoose = require("mongoose");

// // Subdocument: items inside a linked Sales Return on the invoice
// const InvoiceReturnItemSchema = new mongoose.Schema(
//   {
//     item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
//     qtyReturned: { type: Number, required: true },
//     valueReturned: { type: Number, required: true },
//   },
//   { _id: false }
// );

// // Subdocument: one linked Sales Return on the invoice
// const InvoiceReturnSchema = new mongoose.Schema(
//   {
//     returnId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesReturn", required: true },
//     returnNo: { type: String, required: true },
//     returnDate: { type: Date, required: true },
//     totalReturnValue: { type: Number, required: true },
//     items: [InvoiceReturnItemSchema],
//   },
//   { _id: false }
// );

// // Subdocument: payment allocation history per invoice (rich)
// const PaymentAllocationSchema = new mongoose.Schema(
//   {
//     paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPayment", required: true },
//     amount: { type: Number, required: true },
//     date: { type: Date, required: true },
//     method: { type: String, enum: ["cash", "cheque", "bank-transfer", "other"], required: true },
//     referenceNo: { type: String, trim: true },
//     collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep" },
//   },
//   { _id: false }
// );

// const SalesInvoiceSchema = new mongoose.Schema(
//   {
//     invoiceNo: { type: String, required: true, unique: true, trim: true },
//     salesRep: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep", default: null, index: true },
//     customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
//     branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

//     items: [
//       {
//         item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
//         qty: { type: Number, required: true },
//         sellingPriceBase: { type: Number, required: true },
//         discountPerUnit: { type: Number, default: 0 },
//         totalSellingValue: { type: Number, required: true },
//       },
//     ],

//     totalValue: { type: Number, required: true },

//     // -------------------------
//     // RETURNS
//     // -------------------------
//     hasReturns: { type: Boolean, default: false },
//     totalReturnedValue: { type: Number, default: 0 },

//     // IMPORTANT: BALANCE = total - returns (NOT influenced by payments)
//     totalBalanceValue: { type: Number, default: 0 },

//     returns: [InvoiceReturnSchema],

//     // -------------------------
//     // PAYMENTS
//     // -------------------------
//     paidAmount: { type: Number, default: 0 },

//     paymentStatus: {
//       type: String,
//       enum: ["unpaid", "partially_paid", "paid"],
//       default: "unpaid",
//     },

//     paymentAllocations: [PaymentAllocationSchema],

//     status: {
//       type: String,
//       enum: ["draft", "waiting_for_approval", "approved", "cancelled"],
//       default: "waiting_for_approval",
//     },

//     invoiceDate: { type: Date, required: true },
//     remarks: { type: String, trim: true },

//     approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     approvedAt: { type: Date },
//     cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     cancelledAt: { type: Date },
//   },
//   { timestamps: true }
// );

// // Helpful indexes
// SalesInvoiceSchema.index({ customer: 1, status: 1 });
// SalesInvoiceSchema.index({ invoiceDate: -1 });
// SalesInvoiceSchema.index({ salesRep: 1, invoiceDate: -1 });

// module.exports = mongoose.model("SalesInvoice", SalesInvoiceSchema);





const mongoose = require("mongoose");

// Subdocument: items inside a linked Sales Return on the invoice
const InvoiceReturnItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    qtyReturnedBase:     { type: Number, default: 0, min: 0 },
    qtyReturnedPrimary:  { type: Number, default: 0, min: 0 },
    valueReturnedBase:   { type: Number, default: 0, min: 0 },
    valueReturnedPrimary:{ type: Number, default: 0, min: 0 },
    totalValueReturned:  { type: Number, required: true, min: 0 },
  },
  { _id: false }
);


// Subdocument: one linked Sales Return on the invoice
const InvoiceReturnSchema = new mongoose.Schema(
  {
    returnId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesReturn", required: true },
    returnNo: { type: String, required: true },
    returnDate: { type: Date, required: true },
    totalReturnValue: { type: Number, required: true },
    items: [InvoiceReturnItemSchema],
  },
  { _id: false }
);

// Subdocument: payment allocation history per invoice (rich)
const PaymentAllocationSchema = new mongoose.Schema(
  {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerPayment", required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    method: { type: String, enum: ["cash", "cheque", "bank-transfer", "other"], required: true },
    referenceNo: { type: String, trim: true },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep" },
  },
  { _id: false }
);

const SalesInvoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, trim: true },
    salesRep: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep", default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    items: [
      {
        item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
        sellingPriceBase: { type: Number, required: true },
        sellingPricePrimary: { type: Number, required: true },  // Added field for Primary UOM selling price
        factorToBase: { type: Number, required: true }, // Conversion factor from primary to base UOM
        primaryQty: { type: Number, required: true },  // Quantity in Primary UOM
        baseQty: { type: Number, required: true },     // Quantity in Base UOM
        totalSellingValue: { type: Number, required: true },  // Total selling value after applying prices and quantities
        discountPerUnit: { type: Number, default: 0 },
      },
    ],

    totalValue: { type: Number, required: true },

    // -------------------------
    // RETURNS
    // -------------------------
    hasReturns: { type: Boolean, default: false },
    totalReturnedValue: { type: Number, default: 0 },

    // IMPORTANT: BALANCE = total - returns (NOT influenced by payments)
    totalBalanceValue: { type: Number, default: 0 },

    returns: [InvoiceReturnSchema],

    // -------------------------
    // PAYMENTS
    // -------------------------
    paidAmount: { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid"],
      default: "unpaid",
    },

    paymentAllocations: [PaymentAllocationSchema],

    status: {
      type: String,
      enum: ["draft", "waiting_for_approval", "approved", "cancelled"],
      default: "waiting_for_approval",
    },

    invoiceDate: { type: Date, required: true },
    remarks: { type: String, trim: true },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

// Helpful indexes
SalesInvoiceSchema.index({ customer: 1, status: 1 });
SalesInvoiceSchema.index({ invoiceDate: -1 });
SalesInvoiceSchema.index({ salesRep: 1, invoiceDate: -1 });

module.exports = mongoose.model("SalesInvoice", SalesInvoiceSchema);
