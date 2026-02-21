// src/models/finance/CustomerPayment.model.js
const { Schema, model, Types } = require("mongoose");

const allocationSchema = new Schema(
  {
    invoice: { type: Types.ObjectId, ref: "SalesInvoice", required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const customerPaymentSchema = new Schema(
  {
    paymentNo: { type: String, required: true, unique: true, trim: true },

    customer: { type: Types.ObjectId, ref: "Customer", required: true },

    paymentDate: { type: Date, required: true },

    amount: { type: Number, required: true, min: 0.01 },

    method: {
      type: String,
      enum: ["cash", "cheque", "bank-transfer", "other"],
      required: true,
    },

    referenceNo: { type: String, trim: true }, // cheque/slip/reference number

    collectedBy: { type: Types.ObjectId, ref: "SalesRep" },

    remarks: { type: String, trim: true },

    allocations: [allocationSchema], // auto-allocated to invoices
  },
  { timestamps: true }
);

module.exports = model("CustomerPayment", customerPaymentSchema);
