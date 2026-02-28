// server/src/models/history/StockAdjustmentHistory.model.js
const mongoose = require('mongoose');
const { getHistoryDb } = require('../../config/historyDb');

const StockAdjustmentHistorySchema = new mongoose.Schema({
  adjustmentNo: { type: String },
  branch: { type: mongoose.Schema.Types.ObjectId },
  salesRep: { type: mongoose.Schema.Types.ObjectId },
  adjustmentDate: { type: Date },
  type: { type: String },
  relatedSupplier: { type: mongoose.Schema.Types.ObjectId },
  relatedCustomer: { type: mongoose.Schema.Types.ObjectId },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId },
    avgCostPrimary: { type: Number }, avgCostBase: { type: Number },
    sellingPricePrimary: { type: Number }, sellingPriceBase: { type: Number },
    primaryQty: { type: Number }, baseQty: { type: Number },
    factorToBase: { type: Number }, itemTotalValue: { type: Number },
    reason: { type: String },
  }],
  totalValue: { type: Number },
  status: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId }, approvedAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId }, cancelledAt: { type: Date },
  remarks: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  createdBySalesRep: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date }, updatedAt: { type: Date },
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'stockadjustments_history' });

StockAdjustmentHistorySchema.index({ period: 1, archivedAt: -1 });
module.exports = getHistoryDb().model('StockAdjustmentHistory', StockAdjustmentHistorySchema);