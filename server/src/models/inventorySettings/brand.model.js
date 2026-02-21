// models/product/brand.model.js
const { Schema, model } = require('mongoose');

const brandSchema = new Schema(
  {
    brandCode: { type: String, unique: true, required: true, trim: true },
    name:      { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    groups: [{ type: Schema.Types.ObjectId, ref: "ProductGroup" }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

brandSchema.index({ name: 1, status: 1 });

module.exports = model('Brand', brandSchema);
