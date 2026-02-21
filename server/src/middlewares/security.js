const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const { CLIENT_ORIGIN } = require('../config/env');

function securityStack(app) {
  app.use(helmet());
  app.use(
    cors({
      origin: CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    })
  );
  app.use(compression());
}

module.exports = { securityStack };
