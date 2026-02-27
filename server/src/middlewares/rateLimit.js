// middlewares/rateLimit.js
const rateLimit = require('express-rate-limit');

// Global API rate limiter to throttle excessive requests across all routes.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

module.exports = { globalLimiter };