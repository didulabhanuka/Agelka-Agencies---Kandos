// server/src/config/historyDb.js
const mongoose = require('mongoose');

let historyConn = null;

const getHistoryDb = () => {
  if (historyConn) return historyConn;

  const uri = process.env.MONGODB_URI_HISTORY;
  if (!uri) {
    throw new Error('MONGODB_URI_HISTORY is not set. Add it to your environment variables.');
  }

  historyConn = mongoose.createConnection(uri);

  historyConn.on('connected', () => {
    console.log('History DB connected (agelka-history-db)');
  });

  historyConn.on('error', (err) => {
    console.error('History DB connection error:', err.message);
  });

  return historyConn;
};

module.exports = { getHistoryDb };