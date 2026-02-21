// routes/purchases/purchases.routes.js
const express = require("express");
const router = express.Router();

const { verifyJWT, requireRole, scopeBySalesRep } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");
const { handleValidation } = require("../../middlewares/handleValidation");

// Controllers
const grnCtrl = require("../../controllers/purchases/grn.controller");

// Validators
const { createGRNRules, grnIdParam, listGRNQuery } = require("../../validators/inventory/grn.validator");

// Role shortcuts
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];
const staffOnly = [verifyJWT, requireRole("Admin", "DataEntry")];

router
  // GRN
  .get("/grn/summary", ...staffOnly, asyncHandler(grnCtrl.summary))

  // ✅ create: Admin/DataEntry/SalesRep
  .post("/grn", ...anyActor, handleValidation, asyncHandler(grnCtrl.create))

  // ✅ list: SalesRep should only see own -> scopeBySalesRep("salesRep")
  .get("/grn", ...anyActor, scopeBySalesRep("salesRep"), listGRNQuery, handleValidation, asyncHandler(grnCtrl.list))

  // ✅ get: scoped list + controller safety check already added
  .get("/grn/:id", ...anyActor, scopeBySalesRep("salesRep"), grnIdParam, handleValidation, asyncHandler(grnCtrl.get))

  // ✅ update: Admin/DataEntry can update any, SalesRep only own (service enforces)
  .put("/grn/:id", ...anyActor, grnIdParam, handleValidation, asyncHandler(grnCtrl.update))

  // ✅ delete: Admin/DataEntry can delete any, SalesRep only own (service enforces)
  .delete("/grn/:id", ...anyActor, grnIdParam, handleValidation, asyncHandler(grnCtrl.delete))

  // ✅ approve: Admin/DataEntry only
  .post("/grn/:id/approve", ...staffOnly, grnIdParam, handleValidation, asyncHandler(grnCtrl.approve));

module.exports = router;
