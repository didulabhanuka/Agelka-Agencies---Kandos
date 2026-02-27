const router = require("express").Router();

const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");

const salesInvoiceCtrl = require("../../controllers/sale/salesInvoice.controller");
const salesReturnCtrl = require("../../controllers/sale/salesReturn.controller");

// Auth guards
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];
const approverOnly = [verifyJWT, requireRole("Admin", "DataEntry")];

// Sales invoices
router
  .post("/sales-invoice", ...anyActor, asyncHandler(salesInvoiceCtrl.create))
  .get("/sales-invoice/available-items", ...anyActor, asyncHandler(salesInvoiceCtrl.listAvailableItems))
  .get("/sales-invoice/:id", ...anyActor, asyncHandler(salesInvoiceCtrl.get))
  .get("/sales-invoices", ...anyActor, asyncHandler(salesInvoiceCtrl.list))
  .patch("/sales-invoice/:id/approve", ...approverOnly, asyncHandler(salesInvoiceCtrl.approve))
  .put("/sales-invoice/:id", ...anyActor, asyncHandler(salesInvoiceCtrl.update))
  .delete("/sales-invoice/:id", ...anyActor, asyncHandler(salesInvoiceCtrl.delete));

// Sales returns
router
  .post("/sales-return", ...anyActor, asyncHandler(salesReturnCtrl.create))
  .get("/sales-return/:id", ...anyActor, asyncHandler(salesReturnCtrl.get))
  .get("/sales-returns", ...anyActor, asyncHandler(salesReturnCtrl.list))
  .patch("/sales-return/:id/approve", ...approverOnly, asyncHandler(salesReturnCtrl.approve))
  .delete("/sales-return/:id", ...anyActor, asyncHandler(salesReturnCtrl.delete))  
  .put("/sales-return/:id", ...anyActor, asyncHandler(salesReturnCtrl.update)); 

module.exports = router;