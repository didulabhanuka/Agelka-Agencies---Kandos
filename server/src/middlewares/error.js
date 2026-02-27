// middlewares/error.js
const { logger } = require('../config/logger');

// Standard API error type used across controllers/services for consistent HTTP error responses.
class ApiError extends Error {
  constructor(status = 500, message = 'Internal Server Error', details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Express 404 fallback middleware that forwards a standardized Not Found error.
function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'Not Found'));
}

// Centralized Express error middleware that shapes error responses and logs server-side failures.
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isValidationError = status === 400 && err.details;

  // Include error details for validation errors and in development mode only.
  const payload = {
    message: err.message || 'Internal Server Error',
    ...(isValidationError || process.env.NODE_ENV === 'development'
      ? { details: err.details }
      : {}),
  };

  // Log unhandled server errors (5xx) for diagnostics.
  if (status >= 500) logger.error({ err }, 'Unhandled error');
  res.status(status).json(payload);
}

module.exports = { ApiError, notFoundHandler, errorHandler };