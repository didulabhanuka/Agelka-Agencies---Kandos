const { logger } = require('../config/logger');

class ApiError extends Error {
  constructor(status = 500, message = 'Internal Server Error', details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'Not Found'));
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isValidationError = status === 400 && err.details;

  const payload = {
    message: err.message || 'Internal Server Error',
    ...(isValidationError || process.env.NODE_ENV === 'development'
      ? { details: err.details }
      : {}),
  };

  if (status >= 500) logger.error({ err }, 'Unhandled error');
  res.status(status).json(payload);
}

module.exports = { ApiError, notFoundHandler, errorHandler };
