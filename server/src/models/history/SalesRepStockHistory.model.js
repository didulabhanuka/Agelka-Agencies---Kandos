// server/src/models/history/SalesRepStockHistory.model.js
const mongoose = require('mongoose');
const { getHistoryDb } = require('../../config/historyDb');

const SalesRepStockHistorySchema = new mongoose.Schema({
  salesRep: { type: mongoose.Schema.Types.ObjectId },
  item: { type: mongoose.Schema.Types.ObjectId },
  qtyOnHandPrimary: { type: Number }, qtyOnHandBase: { type: Number },
  factorToBase: { type: Number },
  stockValueBase: { type: Number }, stockValuePrimary: { type: Number },
  createdAt: { type: Date }, updatedAt: { type: Date },
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'salesrepstocks_history' });

SalesRepStockHistorySchema.index({ period: 1, salesRep: 1 });
module.exports = getHistoryDb().model('SalesRepStockHistory', SalesRepStockHistorySchema);