console.log("CustomerPayment model loaded from:", __filename);

const mongoose = require("mongoose");

// Invoice allocation line stored inside a customer payment.
const allocationSchema = new mongoose.Schema({ 
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", required: true }, 
  amount: { type: Number, required: true } 
}, { _id: false });

// Customer payment record with optional invoice allocations.
const customerPaymentSchema = new mongoose.Schema({
  paymentNo: { type: String, required: true, unique: true, trim: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  paymentDate: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ["cash", "cheque", "bank-transfer", "other"], required: true },
  referenceNo: { type: String, trim: true }, // Optional cheque/slip/reference number.
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep" },
  remarks: { type: String, trim: true },
  allocations: [allocationSchema], // Invoice allocations from auto/manual allocation flow.
  status: { type: String, enum: ["draft", "waiting_for_approval", "approved", "cancelled"], default: "waiting_for_approval" },
}, { timestamps: true });

module.exports = mongoose.model("CustomerPayment", customerPaymentSchema);