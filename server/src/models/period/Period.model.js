/**
 * Period Model
 * File: server/src/models/period/Period.model.js
 *
 * Tracks every period rollover job.
 * Acts as both an audit log and a resume checkpoint if rollover fails.
 */

const mongoose = require('mongoose');

const PeriodSchema = new mongoose.Schema(
  {
    // Flexible label — admin decides format e.g. "2025-Q1", "JAN-2025", "PERIOD-1"
    label: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // Rollover job status
    status: {
      type: String,
      enum: ['started', 'archiving', 'clearing', 'completed', 'failed'],
      default: 'started',
    },

    // Last completed checkpoint — used to resume if failed
    checkpoint: {
      type: String,
      enum: ['none', 'archived', 'done'],
      default: 'none',
    },

    // Timing
    startedAt:  { type: Date },
    closedAt:   { type: Date },
    failedAt:   { type: Date },

    // Who triggered it
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Failure info for admin dashboard
    failureReason: { type: String },

    // Summary counts of archived documents
    summary: {
      salesInvoices:    { type: Number, default: 0 },
      salesReturns:     { type: Number, default: 0 },
      stockAdjustments: { type: Number, default: 0 },
      salesRepStocks:   { type: Number, default: 0 },
      grns:             { type: Number, default: 0 },
      salesLedger:      { type: Number, default: 0 },
      purchaseLedger:   { type: Number, default: 0 },
      stockLedger:      { type: Number, default: 0 },
      customerPayments: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    collection: 'periods',
  }
);

module.exports = mongoose.model('Period', PeriodSchema);