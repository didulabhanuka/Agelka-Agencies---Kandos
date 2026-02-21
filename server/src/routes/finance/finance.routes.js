// src/routes/finance.routes.js
const router = require("express").Router();

const { asyncHandler } = require('../../utils/asyncHandler');
const { verifyJWT, requireRole } = require('../../middlewares/auth/auth.middleware');
const { pagination, mongoId } = require("../../validators/commonValidators");

// Controllers
const paymentCtrl = require("../../controllers/finance/customerPayment.controller");

// Role shortcuts
const adminOnly = [verifyJWT, requireRole('Admin')];
const staffOrAdmin = [verifyJWT, requireRole('Admin', 'DataEntry')];

// CREATE PAYMENT
router
  .post("/customer-payments",...staffOrAdmin,asyncHandler(paymentCtrl.create))
  .get("/customer-payments",verifyJWT,pagination,asyncHandler(paymentCtrl.list))
  .get("/customer-payments/:id",verifyJWT,mongoId(),asyncHandler(paymentCtrl.get))
  .delete("/customer-payments/:id",...adminOnly,mongoId(),asyncHandler(paymentCtrl.remove))
  .post("/customer-payments/preview",verifyJWT,asyncHandler(paymentCtrl.preview))
  .get("/customers/:customerId/outstanding",verifyJWT,mongoId("customerId"),asyncHandler(paymentCtrl.outstanding))
  .get("/customer-payments/by-invoice/:invoiceId",verifyJWT,mongoId("invoiceId"),asyncHandler(paymentCtrl.paymentsByInvoice))
  .get("/customers/:customerId/open-invoices",verifyJWT,mongoId("customerId"),asyncHandler(paymentCtrl.openInvoices));
module.exports = router;
