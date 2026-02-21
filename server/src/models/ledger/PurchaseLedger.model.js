// // models/inventory/PurchaseLedger.model.js
// const { Schema, model, Types } = require("mongoose");

// const purchaseLedgerSchema = new Schema(
//   {
//     item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
//     branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
//     supplier: { type: Types.ObjectId, ref: "Supplier" },
//     salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

//     transactionType: { type: String, required: true, index: true },
//     refModel: { type: String, required: true },
//     refId: { type: Types.ObjectId, required: true, index: true },

//     qty: { type: Number, required: true },
//     avgCostBase: { type: Number, default: 0 },
//     discountAmount: { type: Number, default: 0 }, // Add this line
//     totalCostValue: { type: Number, default: 0 },
//     remarks: { type: String },

//     // remains staff user (approve/posting typically done by staff)
//     createdBy: { type: Types.ObjectId, ref: "User" },
//   },
//   { timestamps: true }
// );

// purchaseLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });
// purchaseLedgerSchema.index({ refModel: 1, refId: 1 });
// purchaseLedgerSchema.index({ supplier: 1, createdAt: -1 });

// // ✅ NEW helpful index
// purchaseLedgerSchema.index({ salesRep: 1, createdAt: -1 });

// module.exports = model("PurchaseLedger", purchaseLedgerSchema);





// models/inventory/PurchaseLedger.model.js
const { Schema, model, Types } = require("mongoose");

const purchaseLedgerSchema = new Schema(
  {
    // --------------------
    // Core references
    // --------------------
    item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
    supplier: { type: Types.ObjectId, ref: "Supplier", index: true },
    salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

    // --------------------
    // Source tracking
    // --------------------
    transactionType: {
      type: String,
      required: true,
      index: true, // purchase | purchase_return | opening | adjustment
    },
    refModel: { type: String, required: true },
    refId: { type: Types.ObjectId, required: true, index: true },

    // --------------------
    // ✅ UOM-aware quantities
    // --------------------
    primaryQty: { type: Number, required: true, min: 0 }, // Primary UOM qty
    baseQty: { type: Number, required: true, min: 0 },    // Base UOM qty
    factorToBase: { type: Number, required: true, min: 0 },

    // --------------------
    // ✅ Cost snapshot at posting time
    // --------------------
    avgCostPrimary: { type: Number, required: true, min: 0 },
    avgCostBase: { type: Number, required: true, min: 0 },

    // --------------------
    // Financials
    // --------------------
    discountAmount: { type: Number, default: 0 },
    totalCostValue: { type: Number, required: true, min: 0 },

    remarks: { type: String },

    // --------------------
    // Audit
    // --------------------
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// --------------------
// Indexes
// --------------------
purchaseLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });
purchaseLedgerSchema.index({ refModel: 1, refId: 1 });
purchaseLedgerSchema.index({ supplier: 1, createdAt: -1 });
purchaseLedgerSchema.index({ salesRep: 1, createdAt: -1 });

module.exports = model("PurchaseLedger", purchaseLedgerSchema);
