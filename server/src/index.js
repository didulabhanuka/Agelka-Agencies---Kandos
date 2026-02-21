const { connectDB } = require('./config/db');
const app = require('./app');
const { NODE_ENV, PORT } = require('./config/env');
const { logger } = require('./config/logger');

async function start() {
  await connectDB();
  app.listen(PORT, () => logger.info({ port: PORT, env: NODE_ENV }, 'AGELKA API listening'));
}

start();
