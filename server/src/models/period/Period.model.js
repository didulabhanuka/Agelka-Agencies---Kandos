// server/src/models/period/Period.model.js
const mongoose = require('mongoose');

const PeriodSchema = new mongoose.Schema(
  {
    label: {
      type: String, required: true, unique: true,
      uppercase: true, trim: true, index: true,
    },
    // Date range this period covers
    fromDate: { type: Date },
    toDate:   { type: Date },

    // Rollover job status
    status: {
      type: String,
      enum: ['started', 'archiving', 'clearing', 'completed', 'failed'],
      default: 'started',
    },

    // Last completed checkpoint — for safe resume
    checkpoint: {
      type: String,
      enum: ['none', 'archived', 'done'],
      default: 'none',
    },

    startedAt:  { type: Date },
    closedAt:   { type: Date },
    failedAt:   { type: Date },

    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    failureReason: { type: String },

    // Archived document counts per collection
    summary: {
      salesInvoices:    { type: Number, default: 0 },
      salesReturns:     { type: Number, default: 0 },
      customerPayments: { type: Number, default: 0 },
      stockAdjustments: { type: Number, default: 0 },
      salesRepStocks:   { type: Number, default: 0 },
      grns:             { type: Number, default: 0 },
      salesLedger:      { type: Number, default: 0 },
      purchaseLedger:   { type: Number, default: 0 },
      stockLedger:      { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'periods' }
);

module.exports = mongoose.model('Period', PeriodSchema);