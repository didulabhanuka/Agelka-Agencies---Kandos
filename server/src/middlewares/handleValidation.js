// middlewares/handleValidation.js
const { validationResult } = require('express-validator');
const { ApiError } = require('./error'); // adjust path if needed

/**
 * Centralized validation middleware.
 * - Collects express-validator errors.
 * - Wraps them in ApiError for consistent global handling.
 * - Keeps payload minimal and secure (no raw stack traces).
 */
function handleValidation(req, _res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format errors cleanly and predictably
    const details = errors.array().map(e => ({
      field: e.path,
      message: e.msg,
    }));

    // Pass to global error handler
    return next(new ApiError(400, 'Validation failed', details));
  }

  next();
}

module.exports = { handleValidation };
