// // src/models/sale/SalesReturn.model.js
// const { Schema, model, Types } = require("mongoose");

// const SalesReturnSchema = new Schema(
//   {
//     returnNo: { type: String, required: true, unique: true, trim: true },
//     salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },
//     originalInvoice: { type: Types.ObjectId, ref: "SalesInvoice", default: null },
//     customer: { type: Types.ObjectId, ref: "Customer", required: true },
//     branch: { type: Types.ObjectId, ref: "Branch", required: true },

//     items: [
//       {
//         item: { type: Types.ObjectId, ref: "Item", required: true },
//         qtyReturn: { type: Number, required: true },
//         sellingPriceBase: { type: Number, required: true },
//         discountPerUnit: { type: Number, default: 0 },
//         totalSellingValue: { type: Number, required: true },
//       },
//     ],

//     totalReturnValue: { type: Number, required: true },

//     status: {
//       type: String,
//       enum: ["waiting_for_approval", "approved", "cancelled"],
//       default: "waiting_for_approval",
//     },

//     returnDate: { type: Date, required: true },
//     remarks: { type: String, trim: true },

//     approvedBy: { type: Types.ObjectId, ref: "User" },
//     approvedAt: { type: Date },
//     cancelledBy: { type: Types.ObjectId, ref: "User" },
//     cancelledAt: { type: Date },
//   },
//   { timestamps: true }
// );

// SalesReturnSchema.index({ salesRep: 1, returnDate: -1 });

// module.exports = model("SalesReturn", SalesReturnSchema);

// src/models/sale/SalesReturn.model.js
const { Schema, model, Types } = require("mongoose");

const SalesReturnSchema = new Schema(
  {
    returnNo: { type: String, required: true, unique: true, trim: true },
    salesRep: { type: Types.ObjectId, ref: "SalesRep", default: null, index: true },
    originalInvoice: { type: Types.ObjectId, ref: "SalesInvoice", default: null },
    customer: { type: Types.ObjectId, ref: "Customer", required: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true },

    items: [
      {
        item: { type: Types.ObjectId, ref: "Item", required: true },
        qtyReturnPrimary: { type: Number, required: true }, // Primary UOM quantity returned
        qtyReturnBase: { type: Number, required: true },    // Base UOM quantity returned
        sellingPriceBase: { type: Number, required: true },
        sellingPricePrimary: { type: Number, required: true }, // Primary UOM selling price
        factorToBase: { type: Number, required: true }, // Conversion factor from primary to base UOM
        discountPerUnit: { type: Number, default: 0 },
        totalSellingValue: { type: Number, required: true },
      },
    ],

    totalReturnValue: { type: Number, required: true },
    status: {
      type: String,
      enum: ["waiting_for_approval", "approved", "cancelled"],
      default: "waiting_for_approval",
    },

    returnDate: { type: Date, required: true },
    remarks: { type: String, trim: true },

    approvedBy: { type: Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    cancelledBy: { type: Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

// Adding indexes for improved querying
SalesReturnSchema.index({ salesRep: 1, returnDate: -1 });
SalesReturnSchema.index({ originalInvoice: 1, status: 1 });

module.exports = model("SalesReturn", SalesReturnSchema);
