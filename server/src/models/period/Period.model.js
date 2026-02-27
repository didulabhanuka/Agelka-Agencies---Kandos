/**
 * Period Model
 * File: server/src/models/period/Period.model.js
 *
 * Tracks every monthly period that has been closed.
 * Acts as an audit log for all rollovers.
 */

const mongoose = require('mongoose');

const PeriodSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,  // enforces YYYY-MM format
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'closed',
    },
    closedAt: {
      type: Date,
      required: true,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    summary: {
      invoices: { type: Number, default: 0 },
      salesReturns: { type: Number, default: 0 },
      grns: { type: Number, default: 0 },
      salesLedgerEntries: { type: Number, default: 0 },
      purchaseLedgerEntries: { type: Number, default: 0 },
      stockLedgerEntries: { type: Number, default: 0 },
      adjustments: { type: Number, default: 0 },
      payments: { type: Number, default: 0 },
      itemsCarriedForward: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    collection: 'periods',
  }
);

module.exports = mongoose.model('Period', PeriodSchema);
