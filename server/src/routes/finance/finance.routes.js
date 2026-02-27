// src/routes/finance.routes.js
const router = require("express").Router();

const { asyncHandler } = require("../../utils/asyncHandler");
const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const { pagination, mongoId } = require("../../validators/commonValidators");
const paymentCtrl = require("../../controllers/finance/customerPayment.controller");

// Auth guards
const adminOnly = [verifyJWT, requireRole("Admin")];
const staffOrAdmin = [verifyJWT, requireRole("Admin", "DataEntry")];
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];

// Customer payments
router
  .post("/customer-payments", ...anyActor, asyncHandler(paymentCtrl.create))
  .put("/customer-payments/update/:id", ...anyActor, asyncHandler(paymentCtrl.update))
  .patch("/customer-payments/approve/:id", ...staffOrAdmin, asyncHandler(paymentCtrl.approve))
  .get("/customer-payments", verifyJWT, pagination, asyncHandler(paymentCtrl.list))
  .post("/customer-payments/preview", verifyJWT, asyncHandler(paymentCtrl.preview))
  .get("/customer-payments/reports/receivables", verifyJWT, asyncHandler(paymentCtrl.receivablesReport))
  .get("/customer-payments/:id", verifyJWT, mongoId(), asyncHandler(paymentCtrl.get))
  .delete("/customer-payments/:id", ...anyActor, mongoId(), asyncHandler(paymentCtrl.remove))
  .get("/customers/:customerId/outstanding", verifyJWT, mongoId("customerId"), asyncHandler(paymentCtrl.outstanding))
  .get("/customer-payments/by-invoice/:invoiceId", verifyJWT, mongoId("invoiceId"), asyncHandler(paymentCtrl.paymentsByInvoice))
  .get("/customers/:customerId/open-invoices", verifyJWT, mongoId("customerId"), asyncHandler(paymentCtrl.openInvoices));

module.exports = router;