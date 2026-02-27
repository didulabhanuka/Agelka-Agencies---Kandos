// models/inventory/PurchaseLedger.model.js
const { Schema, model, Types } = require("mongoose");

// Stores purchase-side ledger entries with UOM quantities, cost snapshot, and source references.
const purchaseLedgerSchema = new Schema({
  // Core references for item, location, supplier, and optional sales rep ownership.
  item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
  branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
  supplier: { type: Types.ObjectId, ref: "Supplier", index: true },
  salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

  // Source transaction trace fields (purchase, return, opening, adjustment, etc.).
  transactionType: { type: String, required: true, index: true },
  refModel: { type: String, required: true },
  refId: { type: Types.ObjectId, required: true, index: true },

  // UOM-aware quantities captured at posting time.
  primaryQty: { type: Number, required: true, min: 0 },
  baseQty: { type: Number, required: true, min: 0 },
  factorToBase: { type: Number, required: true, min: 0 },

  // Cost snapshot stored at posting time for reporting consistency.
  avgCostPrimary: { type: Number, required: true, min: 0 },
  avgCostBase: { type: Number, required: true, min: 0 },

  // Financial totals for the ledger line.
  discountAmount: { type: Number, default: 0 },
  totalCostValue: { type: Number, required: true, min: 0 },

  remarks: { type: String },

  // Audit actor who posted the ledger entry.
  createdBy: { type: Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

// Indexes for item/branch timelines, source lookups, and supplier/salesRep reporting.
purchaseLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });
purchaseLedgerSchema.index({ refModel: 1, refId: 1 });
purchaseLedgerSchema.index({ supplier: 1, createdAt: -1 });
purchaseLedgerSchema.index({ salesRep: 1, createdAt: -1 });

module.exports = model("PurchaseLedger", purchaseLedgerSchema);