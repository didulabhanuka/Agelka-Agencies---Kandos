// middlewares/handleValidation.js
const { validationResult } = require('express-validator');
const { ApiError } = require('./error'); // adjust path if needed

// Collects express-validator errors and forwards a standardized 400 ApiError when validation fails.
function handleValidation(req, _res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Map validator errors into a predictable field/message shape for API clients.
    const details = errors.array().map(e => ({
      field: e.path,
      message: e.msg,
    }));

    // Forward validation failure to the global error handler.
    return next(new ApiError(400, 'Validation failed', details));
  }

  next();
}

module.exports = { handleValidation };