// // models/product/ProductGroup.model.js
// const { Schema, model, Types } = require('mongoose');

// const productGroupSchema = new Schema(
//   {
//     groupCode: { type: String, unique: true, required: true, trim: true },
//     name: { type: String, required: true, trim: true },
//     description: { type: String, trim: true },

//     status: { type: String, enum: ['active', 'inactive'], default: 'active' },

//     // existing → allowed brands for this group
//     brands: [{ type: Types.ObjectId, ref: 'Brand' }],

//     // NEW → Allowed Unit Types (Piece, Pack, Box, Carton, etc.)
//     units: [{ type: String, trim: true  }],
//   },
//   { timestamps: true }
// );

// productGroupSchema.index({ name: 1, status: 1 });
// productGroupSchema.index({ brands: 1, name: 1, status: 1 });
// productGroupSchema.index({ units: 1, name: 1, status: 1 });

// module.exports = model('ProductGroup', productGroupSchema);




// models/product/ProductGroup.model.js
const { Schema, model } = require('mongoose');

const productGroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    uomType: {
      type: String,
      enum: ['primary', 'base'],
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  { timestamps: true }
);

module.exports = model('ProductGroup', productGroupSchema);
