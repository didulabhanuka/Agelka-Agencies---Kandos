// sale/inventory.sale.js
const express = require("express");
const router = express.Router();

const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");

// Controllers
const salesInvoiceCtrl = require("../../controllers/sale/salesInvoice.controller");
const salesReturnCtrl = require("../../controllers/sale/salesReturn.controller");

// ✅ Role shortcuts
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];
const approverOnly = [verifyJWT, requireRole("Admin", "DataEntry")];

router
  // SALES INVOICE ROUTES
  .post("/sales-invoice", ...anyActor, asyncHandler(salesInvoiceCtrl.create))
  .get("/sales-invoice/available-items", ...anyActor, asyncHandler(salesInvoiceCtrl.listAvailableItems))
  .get("/sales-invoice/:id", ...anyActor, asyncHandler(salesInvoiceCtrl.get))
  .get("/sales-invoices", ...anyActor, asyncHandler(salesInvoiceCtrl.list))
  .patch("/sales-invoice/:id/approve", ...approverOnly, asyncHandler(salesInvoiceCtrl.approve))
  .delete("/sales-invoice/:id", ...anyActor, asyncHandler(salesInvoiceCtrl.delete))
  .put("/sales-invoice/:id", ...anyActor, asyncHandler(salesInvoiceCtrl.update))

  // SALES RETURN ROUTES
  .post("/sales-return", ...anyActor, asyncHandler(salesReturnCtrl.create))
  .get("/sales-return/:id", ...anyActor, asyncHandler(salesReturnCtrl.get))
  .get("/sales-returns", ...anyActor, asyncHandler(salesReturnCtrl.list))
  .patch("/sales-return/:id/approve", ...approverOnly, asyncHandler(salesReturnCtrl.approve));

module.exports = router;
