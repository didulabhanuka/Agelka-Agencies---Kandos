// controllers/settings/cleaner.controller.js
const cleanerService = require("../../services/settings/cleaner.service");

// Delete Sales Invoices and cascade-delete their linked Returns and Customer Payments
const deleteSalesInvoicesAndReturns = async (req, res) => {
  const { startDate, endDate, scope } = req.body;
  try {
    const result = await cleanerService.deleteSalesInvoicesAndReturnsInRange(startDate, endDate, scope);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error deleting sales invoices, returns and payments:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete Stock Adjustments — with or without a date range
const deleteStockAdjustments = async (req, res) => {
  const { startDate, endDate, scope } = req.body;
  try {
    const result = await cleanerService.deleteStockAdjustmentsInRange(startDate, endDate, scope);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error deleting stock adjustments:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete SalesRep Stock records — with or without a date range
const deleteSalesRepStock = async (req, res) => {
  const { startDate, endDate, scope } = req.body;
  try {
    const result = await cleanerService.deleteSalesRepStockInRange(startDate, endDate, scope);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error deleting sales rep stock:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete GRNs — with or without a date range
const deleteGRNs = async (req, res) => {
  const { startDate, endDate, scope } = req.body;
  try {
    const result = await cleanerService.deleteGRNsInRange(startDate, endDate, scope);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error deleting GRNs:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete Ledgers — with or without a date range
const deleteLedgers = async (req, res) => {
  const { fromDate, toDate, startDate, endDate } = req.body;
  try {
    const result = await cleanerService.deleteLedgersInRange(
      fromDate || startDate,
      toDate || endDate
    );
    return res.status(200).json({
      message: "Ledgers deleted successfully",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete ledgers",
      error: error.message,
    });
  }
};

module.exports = {
  deleteSalesInvoicesAndReturns,
  deleteStockAdjustments,
  deleteSalesRepStock,
  deleteGRNs,
  deleteLedgers,
};