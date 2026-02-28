// server/src/models/history/GRNHistory.model.js
const mongoose = require('mongoose');
const { getHistoryDb } = require('../../config/historyDb');

const GRNHistorySchema = new mongoose.Schema({
  grnNo: { type: String },
  supplier: { type: mongoose.Schema.Types.ObjectId },
  salesRep: { type: mongoose.Schema.Types.ObjectId },
  createdByModel: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId },
    avgCostPrimary: { type: Number }, avgCostBase: { type: Number },
    factorToBase: { type: Number }, primaryQty: { type: Number }, baseQty: { type: Number },
    itemTotalValue: { type: Number }, discountPerUnit: { type: Number },
  }],
  totalValue: { type: Number },
  receivedDate: { type: Date },
  status: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId }, approvedAt: { type: Date },
  supplierInvoiceNo: { type: String }, supplierInvoiceDate: { type: Date },
  branch: { type: mongoose.Schema.Types.ObjectId },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId }, cancelledAt: { type: Date },
  createdAt: { type: Date }, updatedAt: { type: Date },
  originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
  period: { type: String, required: true, index: true },
  archivedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'grns_history' });

GRNHistorySchema.index({ period: 1, archivedAt: -1 });
GRNHistorySchema.index({ period: 1, supplier: 1 });
module.exports = getHistoryDb().model('GRNHistory', GRNHistorySchema);