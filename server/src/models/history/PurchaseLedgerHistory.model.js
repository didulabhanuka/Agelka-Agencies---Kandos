// server/src/models/history/PurchaseLedgerHistory.model.js
const mongoose = require('mongoose');
const { getHistoryDb } = require('../../config/historyDb');

const PurchaseLedgerHistorySchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId },
  branch: { type: mongoose.Schema.Types.ObjectId },
  supplier: { type: mongoose.Schema.Types.ObjectId },
  salesRep: { type: mongoose.Schema.Types.ObjectId },
  transactionType: { type: String }, refModel: { type: String },
  refId: { type: mongoose.Schema.Types.ObjectId },
  primaryQty: { type: Number }, baseQty: { type: Number }, factorToBase: { type: Number },
  avgCostPrimary: { type: Number }, avgCostBase: { type: Number },
  discountAmount: { type: Number }, totalCostValue: { type: Number },
  remarks: { type: String }, createdBy: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date }, updatedAt: { type: Date },
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'purchaseledgers_history' });

PurchaseLedgerHistorySchema.index({ period: 1, item: 1 });
PurchaseLedgerHistorySchema.index({ period: 1, supplier: 1 });
module.exports = getHistoryDb().model('PurchaseLedgerHistory', PurchaseLedgerHistorySchema);