// server/src/models/history/StockLedgerHistory.model.js
const mongoose = require('mongoose');
const { getHistoryDb } = require('../../config/historyDb');

const StockLedgerHistorySchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId },
  branch: { type: mongoose.Schema.Types.ObjectId },
  salesRep: { type: mongoose.Schema.Types.ObjectId },
  transactionType: { type: String }, refModel: { type: String },
  refId: { type: mongoose.Schema.Types.ObjectId },
  factorToBase: { type: Number }, primaryQty: { type: Number }, baseQty: { type: Number },
  avgCostBase: { type: Number }, avgCostPrimary: { type: Number },
  sellingPriceBase: { type: Number }, sellingPricePrimary: { type: Number },
  itemTotalValue: { type: Number }, runningBalance: { type: Number },
  remarks: { type: String }, createdBy: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date }, updatedAt: { type: Date },
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'stockledgers_history' });

StockLedgerHistorySchema.index({ period: 1, item: 1 });
StockLedgerHistorySchema.index({ period: 1, branch: 1 });
module.exports = getHistoryDb().model('StockLedgerHistory', StockLedgerHistorySchema);