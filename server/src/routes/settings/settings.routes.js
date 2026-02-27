// routes/settings/settings.routes.js
const router = require("express").Router();
const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const cleanerController = require("../../controllers/settings/cleaner.controller");
const { asyncHandler } = require("../../utils/asyncHandler");

// Auth guard for Admin only
const adminOnly = [verifyJWT, requireRole("Admin")];

router
  // Deletes invoices + their linked returns + their linked customer payments in one shot
  .delete("/cleaner/salesInvoicesAndReturns", ...adminOnly, asyncHandler(cleanerController.deleteSalesInvoicesAndReturns))
  .delete("/cleaner/stockAdjustments",        ...adminOnly, asyncHandler(cleanerController.deleteStockAdjustments))
  .delete("/cleaner/salesRepStock",           ...adminOnly, asyncHandler(cleanerController.deleteSalesRepStock))
  .delete("/cleaner/grns",                    ...adminOnly, asyncHandler(cleanerController.deleteGRNs))
  .delete("/cleaner/ledgers",                 ...adminOnly, asyncHandler(cleanerController.deleteLedgers));

module.exports = router;