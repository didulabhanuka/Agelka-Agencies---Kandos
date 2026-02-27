// routes/purchases/purchases.routes.js
const router = require("express").Router();

const { verifyJWT, requireRole, scopeBySalesRep } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");
const { handleValidation } = require("../../middlewares/handleValidation");

const grnCtrl = require("../../controllers/purchases/grn.controller");
const { createGRNRules, grnIdParam, listGRNQuery } = require("../../validators/inventory/grn.validator");

// Auth guards
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];
const staffOnly = [verifyJWT, requireRole("Admin", "DataEntry")];

// GRN
router
  .get("/grn/summary", ...staffOnly, asyncHandler(grnCtrl.summary))
  .post("/grn", ...anyActor, handleValidation, asyncHandler(grnCtrl.create))
  .get("/grn", ...anyActor, scopeBySalesRep("salesRep"), listGRNQuery, handleValidation, asyncHandler(grnCtrl.list))
  .get("/grn/:id", ...anyActor, scopeBySalesRep("salesRep"), grnIdParam, handleValidation, asyncHandler(grnCtrl.get))
  .put("/grn/:id", ...anyActor, grnIdParam, handleValidation, asyncHandler(grnCtrl.update))
  .delete("/grn/:id", ...anyActor, grnIdParam, handleValidation, asyncHandler(grnCtrl.delete))
  .post("/grn/:id/approve", ...staffOnly, grnIdParam, handleValidation, asyncHandler(grnCtrl.approve));

module.exports = router;