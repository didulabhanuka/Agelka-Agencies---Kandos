const AuditLog = require('../../models/audit/auditLog.model');

async function logAction({ userId, action, module, details, ip, ua }) {
  try {
    await AuditLog.create({
      userId,
      action,
      module,
      details: details ? JSON.stringify(details).slice(0, 2000) : '',
      ip,
      ua,
    });
  } catch {
    // fail-quiet logging to avoid blocking main flow
  }
}

module.exports = { logAction };
