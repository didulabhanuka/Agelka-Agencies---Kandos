// src/lib/api/period.api.js
import api from './axios';

// Trigger or resume a period rollover — Admin only
// payload: { periodLabel, fromDate, toDate }
export const triggerRollover = async (periodLabel, fromDate, toDate) =>
  (await api.post('/period/rollover', { periodLabel, fromDate, toDate })).data;

// Get active/failed rollover job status — Admin only
export const getRolloverStatus = async () =>
  (await api.get('/period/status')).data;

// Get document counts filtered by date range — Admin only
// Pass null/undefined for both to get all records
export const getCurrentCounts = async (fromDate, toDate) => {
  const params = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate)   params.toDate   = toDate;
  return (await api.get('/period/counts', { params })).data;
};

// Get all closed periods
export const getClosedPeriods = async () =>
  (await api.get('/period/history')).data;

// Get historical data for a closed period
// model: invoices | returns | payments | adjustments | repStocks | grns | salesLedger | purchaseLedger | stockLedger
export const getHistoricalData = async (model, period) =>
  (await api.get(`/period/data/${model}/${period}`)).data;