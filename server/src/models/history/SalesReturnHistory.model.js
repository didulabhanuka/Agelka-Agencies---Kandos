// server/src/models/history/SalesReturnHistory.model.js
const mongoose = require('mongoose');
const { getHistoryDb } = require('../../config/historyDb');

const SalesReturnHistorySchema = new mongoose.Schema({
  returnNo: { type: String },
  salesRep: { type: mongoose.Schema.Types.ObjectId },
  originalInvoice: { type: mongoose.Schema.Types.ObjectId },
  customer: { type: mongoose.Schema.Types.ObjectId },
  branch: { type: mongoose.Schema.Types.ObjectId },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId },
    qtyReturnPrimary: { type: Number }, qtyReturnBase: { type: Number },
    sellingPriceBase: { type: Number }, sellingPricePrimary: { type: Number },
    factorToBase: { type: Number }, discountPerUnit: { type: Number },
    totalSellingValue: { type: Number },
  }],
  totalReturnValue: { type: Number },
  status: { type: String },
  returnDate: { type: Date },
  remarks: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId }, approvedAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId }, cancelledAt: { type: Date },
  createdAt: { type: Date }, updatedAt: { type: Date },
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'salesreturns_history' });

SalesReturnHistorySchema.index({ period: 1, archivedAt: -1 });
module.exports = getHistoryDb().model('SalesReturnHistory', SalesReturnHistorySchema);