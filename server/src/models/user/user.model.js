// models/user/User.model.js
const { Schema, model, Types } = require('mongoose');

// Stores internal user accounts (Admin/DataEntry) and authentication/profile fields.
const userSchema = new Schema({
  username: { type: String, unique: true, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  email: { type: String, unique: true, sparse: true, trim: true },
  role: { type: String, enum: ['Admin', 'DataEntry'], required: true },
  number: { type: String, trim: true },
  branch: { type: Types.ObjectId, ref: 'Branch' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

module.exports = model('User', userSchema);