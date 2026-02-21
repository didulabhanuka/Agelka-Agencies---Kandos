// // models/inventory/StockLedger.model.js
// const { Schema, model, Types } = require("mongoose");

// const stockLedgerSchema = new Schema(
//   {
//     item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
//     branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
//     salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

//     transactionType: { type: String, required: true, index: true },
//     refModel: { type: String, required: true },
//     refId: { type: Types.ObjectId, required: true, index: true },

//     qty: { type: Number, required: true },
//     avgCostBase: { type: Number, default: 0 },
//     sellingPriceBase: { type: Number, default: 0, index: true },
//     itemTotalValue: { type: Number, default: 0 },

//     runningBalance: { type: Number, required: true },

//     remarks: { type: String },
//     createdBy: { type: Types.ObjectId, ref: "User" },
//   },
//   { timestamps: true }
// );

// stockLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });

// // include salesRep in reference uniqueness scope
// stockLedgerSchema.index({
//   item: 1,
//   branch: 1,
//   salesRep: 1,
//   refModel: 1,
//   refId: 1,
//   transactionType: 1,
// });

// module.exports = model("StockLedger", stockLedgerSchema);










const { Schema, model, Types } = require("mongoose");

const stockLedgerSchema = new Schema(
  {
    // CORE REFERENCES
    item: { type: Types.ObjectId, ref: "Item", required: true, index: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true, index: true },
    salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },

    // TRANSACTION INFO
    transactionType: { type: String, required: true, index: true },
    refModel: { type: String, required: true },
    refId: { type: Types.ObjectId, required: true, index: true },

    // MULTI-UOM (movement)
    factorToBase: { type: Number, default: 1 },      // primary → base
    primaryQty: { type: Number, default: 0 },        // movement in primary UOM
    baseQty: { type: Number, default: 0 },           // movement in base UOM

    // COSTS & PRICES (snapshot at time of movement)
    avgCostBase: { type: Number, default: 0 },
    avgCostPrimary: { type: Number, default: 0 },
    sellingPriceBase: { type: Number, default: 0, index: true },
    sellingPricePrimary: { type: Number, default: 0 },

    // Value of this movement (usually cost-based)
    itemTotalValue: { type: Number, default: 0 },

    // RUNNING BALANCE (base-equivalent qty) for this stream
    runningBalance: { type: Number, required: true },

    // META
    remarks: { type: String },
    createdBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// latest per item+branch
stockLedgerSchema.index({ item: 1, branch: 1, createdAt: -1 });

// include salesRep in uniqueness scope for ref
stockLedgerSchema.index({
  item: 1,
  branch: 1,
  salesRep: 1,
  refModel: 1,
  refId: 1,
  transactionType: 1,
});

module.exports = model("StockLedger", stockLedgerSchema);
