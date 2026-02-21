// // models/ledger/SalesLedger.model.js
// const { Schema, model, Types } = require("mongoose");

// const salesLedgerSchema = new Schema(
//   {
//     // CORE REFERENCES
//     item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
//     branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
//     customer: { type: Types.ObjectId, ref: "Customer" },
//     salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

//     // TRANSACTION META
//     transactionType: { type: String, required: true, index: true },
//     refModel: { type: String, required: true },
//     refId: { type: Types.ObjectId, required: true, index: true },

//     // QUANTITY & PRICING
//     qty: { type: Number, required: true },
//     sellingPriceBase: { type: Number, default: 0 },
//     grossSellingValue: { type: Number, default: 0 },
//     discountAmount: { type: Number, default: 0 },
//     totalSellingValue: { type: Number, default: 0 },

//     remarks: { type: String },
//     createdBy: { type: Types.ObjectId, ref: "User" },
//   },
//   { timestamps: true }
// );

// // INDEXES
// salesLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });
// salesLedgerSchema.index({ refModel: 1, refId: 1 });
// salesLedgerSchema.index({ customer: 1, createdAt: -1 });
// salesLedgerSchema.index({ salesRep: 1, createdAt: -1 });

// module.exports = model("SalesLedger", salesLedgerSchema);



// models/ledger/SalesLedger.model.js
const { Schema, model, Types } = require("mongoose");

const salesLedgerSchema = new Schema(
  {
    // CORE REFERENCES
    item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
    customer: { type: Types.ObjectId, ref: "Customer" },
    salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

    // TRANSACTION META
    transactionType: { type: String, required: true, index: true }, // e.g. "sale", "sales-return", etc.
    refModel: { type: String, required: true },                     // "SalesInvoice", "SalesReturn", ...
    refId: { type: Types.ObjectId, required: true, index: true },

    // QUANTITY & PRICING (MULTI-UOM)
    // Split qty into primary & base with conversion factor
    factorToBase: { type: Number, required: true }, // primary → base factor

    primaryQty: { type: Number, required: true },   // e.g. cartons / boxes
    baseQty: { type: Number, required: true },      // e.g. pieces

    // Snapshot of selling prices at the time of transaction
    sellingPriceBase: { type: Number, default: 0 },     // per 1 base UOM
    sellingPricePrimary: { type: Number, default: 0 },  // per 1 primary UOM

    // VALUE FIELDS
    grossSellingValue: { type: Number, default: 0 }, // if you ever want pre-discount total
    discountAmount: { type: Number, default: 0 },
    totalSellingValue: { type: Number, default: 0 }, // final line value after discount

    // OTHER
    remarks: { type: String },
    createdBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// INDEXES
salesLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });
salesLedgerSchema.index({ refModel: 1, refId: 1 });
salesLedgerSchema.index({ customer: 1, createdAt: -1 });
salesLedgerSchema.index({ salesRep: 1, createdAt: -1 });

module.exports = model("SalesLedger", salesLedgerSchema);
