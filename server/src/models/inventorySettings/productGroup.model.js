// models/product/ProductGroup.model.js
const { Schema, model } = require('mongoose');

// Stores product group master data and its UOM classification.
const productGroupSchema = new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true },
  uomType: { type: String, enum: ['primary', 'base'], required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = model('ProductGroup', productGroupSchema);