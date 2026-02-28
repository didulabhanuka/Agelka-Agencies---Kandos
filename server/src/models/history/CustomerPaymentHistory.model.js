// server/src/models/history/CustomerPaymentHistory.model.js
const mongoose = require("mongoose");

const CustomerPaymentHistorySchema = new mongoose.Schema({
  paymentNo: { type: String },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  paymentDate: { type: Date },
  amount: { type: Number },
  method: { type: String },
  referenceNo: { type: String },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep" },
  remarks: { type: String },
  allocations: [{
    invoice: { type: mongoose.Schema.Types.ObjectId },
    amount: { type: Number },
    _id: false,
  }],
  status: { type: String },
  createdAt: { type: Date },
  updatedAt: { type: Date },
  // ── History tracking ─────────────────────────────────────────
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: "customerpayments_history" });

CustomerPaymentHistorySchema.index({ period: 1, customer: 1 });

module.exports = mongoose.model("CustomerPaymentHistory", CustomerPaymentHistorySchema);
