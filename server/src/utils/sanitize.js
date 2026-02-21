function sanitizeString(str = '') {
  return String(str).replace(/[<>]/g, '');
}

module.exports = { sanitizeString };
