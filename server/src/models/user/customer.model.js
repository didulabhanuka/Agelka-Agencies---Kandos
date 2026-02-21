// // models/user/Customer.model.js
// const { Schema, model, Types } = require('mongoose');

// const customerSchema = new Schema(
//   {
//     customerCode: { type: String, unique: true, required: true, trim: true },
//     name: { type: String, required: true, trim: true },
//     address: { type: String, required: true, trim: true },
//     city: { type: String, required: true, trim: true }, 
//     owner: { type: String, required: true, trim: true }, 
//     contactNumber: { type: String, required: true, trim: true },
//     salesRep: { type: Types.ObjectId, ref: 'SalesRep' },
//     creditLimit: { type: Number, required: true, default: 0 },
//     creditPeriod: { type: Number, required: true, default: 0 }, 
//     status: { type: String, required: true, enum: ['active', 'suspended'], default: 'active' },
//   },
//   { timestamps: true }
// );

// module.exports = model('Customer', customerSchema);

// models/user/Customer.model.js
const { Schema, model, Types } = require("mongoose");

const customerSchema = new Schema(
  {
    customerCode: { type: String, unique: true, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    owner: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },

    salesRep: { type: Types.ObjectId, ref: "SalesRep" },

    // --- CREDIT CONTROL ---
    creditLimit: { type: Number, required: true, default: 0 },
    creditPeriod: { type: Number, required: true, default: 0 },

    creditStatus: {
      type: String,
      enum: ["good", "warning", "overdue", "over-limit", "blocked"],
      default: "good",
    },

    // System usage (active or suspended)
    status: {
      type: String,
      required: true,
      enum: ["active", "suspended"],
      default: "active",
    },

    // --------------------------------------
    // NEW FIELDS (REFERENCE ONLY)
    // --------------------------------------
    saleInvoices: [
      {
        type: Types.ObjectId,
        ref: "SalesInvoice",
      },
    ],

    payments: [
      {
        type: Types.ObjectId,
        ref: "CustomerPayment",
      },
    ],
  },
  { timestamps: true }
);

module.exports = model("Customer", customerSchema);
