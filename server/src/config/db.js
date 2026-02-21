const mongoose = require('mongoose');
const { logger } = require('./logger');
const { MONGODB_URI } = require('./env');

mongoose.set('strictQuery', true);

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      autoIndex: false,
      maxPoolSize: 10,
    });
    logger.info('✅ MongoDB connected');
  } catch (err) {
    logger.error({ err }, '❌ MongoDB connection error');
    process.exit(1);
  }
}

module.exports = { connectDB };
