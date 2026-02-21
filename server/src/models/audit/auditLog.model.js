// models/audit/audit.model.js
const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, 
    module: { type: String, default: '' }, 
    details: { type: String, default: '' },
    ip: { type: String, default: '' },
    ua: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = model('AuditLog', auditLogSchema);
