// utils/logger.js
const logger = {
  info: (...msg) => console.log(`ℹ️ [INFO] ${new Date().toISOString()}:`, ...msg),
  warn: (...msg) => console.warn(`⚠️ [WARN] ${new Date().toISOString()}:`, ...msg),
  error: (...msg) => console.error(`❌ [ERROR] ${new Date().toISOString()}:`, ...msg),
  debug: (...msg) => console.log(`🔍 [DEBUG] ${new Date().toISOString()}:`, ...msg),
};

module.exports = logger;

