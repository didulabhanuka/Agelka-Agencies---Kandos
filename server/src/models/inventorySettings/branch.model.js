// models/inventory/branch.model.js
const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    branchCode: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9-]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    address: { type: String, trim: true },
    phone: { type: String, trim: true, match: /^[0-9+ -]{6,20}$/ },
    email: { type: String, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

branchSchema.index({ branchCode: 1 }, { unique: true });
branchSchema.index({ name: 1 });

module.exports = mongoose.model("Branch", branchSchema);
