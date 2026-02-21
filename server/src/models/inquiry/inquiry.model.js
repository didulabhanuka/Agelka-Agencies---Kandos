// models/inquiry/inquiry.model.js
const { Schema, model } = require('mongoose');

const inquirySchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, trim: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = model('Inquiry', inquirySchema);
