const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { securityStack } = require('./middlewares/security');
const { globalLimiter } = require('./middlewares/rateLimit');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error');
const { logger } = require('./config/logger');

const app = express();

// Trust proxy if you’re behind one (for Secure cookies)
app.set('trust proxy', 1);

// Security + CORS + compression
securityStack(app);

// Cookies (needed for refresh token)
app.use(cookieParser());

// Global rate limiter
app.use(globalLimiter);

// // Logging
// app.use(morgan('combined', { stream: logger.stream }));

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', routes);

// 404 + Error
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
