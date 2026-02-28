// server/src/models/history/SalesLedgerHistory.model.js
const mongoose = require('mongoose');
const { getHistoryDb } = require('../../config/historyDb');

const SalesLedgerHistorySchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId },
  branch: { type: mongoose.Schema.Types.ObjectId },
  customer: { type: mongoose.Schema.Types.ObjectId },
  salesRep: { type: mongoose.Schema.Types.ObjectId },
  transactionType: { type: String }, refModel: { type: String },
  refId: { type: mongoose.Schema.Types.ObjectId },
  factorToBase: { type: Number }, primaryQty: { type: Number }, baseQty: { type: Number },
  sellingPriceBase: { type: Number }, sellingPricePrimary: { type: Number },
  grossSellingValue: { type: Number }, discountAmount: { type: Number }, totalSellingValue: { type: Number },
  remarks: { type: String }, createdBy: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date }, updatedAt: { type: Date },
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'salesledgers_history' });

SalesLedgerHistorySchema.index({ period: 1, item: 1 });
SalesLedgerHistorySchema.index({ period: 1, customer: 1 });
module.exports = getHistoryDb().model('SalesLedgerHistory', SalesLedgerHistorySchema);