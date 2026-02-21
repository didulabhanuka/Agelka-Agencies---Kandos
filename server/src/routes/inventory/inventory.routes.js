// routes/ledger/ledger.routes.js
const express = require("express");
const router = express.Router();

const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");
const { handleValidation } = require("../../middlewares/handleValidation");

const itemCtrl = require("../../controllers/inventory/item.controller");
const adjCtrl = require("../../controllers/inventory/adjustment.controller");

const {
  mongoId,
  pagination,
  createItemRules,
  updateItemRules,
} = require("../../validators/product/product.validator");

const {
  createAdjustmentRules,
  adjustmentIdParam,
  listAdjustmentQuery,
} = require("../../validators/inventory/adjustment.validator");

// Role shortcuts
const adminOnly = [verifyJWT, requireRole("Admin")];
const approverOnly = [verifyJWT, requireRole("Admin", "DataEntry")]; // ✅ approve rights
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];

router
  // -------------------- ITEMS --------------------
  .post("/items", ...approverOnly, handleValidation, asyncHandler(itemCtrl.create))
  .get("/items", ...anyActor, pagination, handleValidation, asyncHandler(itemCtrl.list))
  .get("/items/:id", ...anyActor, mongoId(), handleValidation, asyncHandler(itemCtrl.get))
  .put("/items/:id", ...approverOnly, mongoId(), handleValidation, asyncHandler(itemCtrl.update))
  .delete("/items/:id", ...adminOnly, mongoId(), handleValidation, asyncHandler(itemCtrl.remove))
  .get("/items/supplier/:supplierId", ...anyActor, handleValidation, asyncHandler(itemCtrl.getBySupplier))

  // -------------------- STOCK ADJUSTMENTS --------------------
  // ✅ Admin/DataEntry/SalesRep can create/update/delete/list/get
  // ✅ Only Admin/DataEntry can approve

  .post("/adjustments", ...anyActor,handleValidation, asyncHandler(adjCtrl.create))
  .get("/adjustments", ...anyActor, listAdjustmentQuery, handleValidation, asyncHandler(adjCtrl.list))
  .get("/adjustments/:id", ...anyActor, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.get))
  .patch("/adjustments/:id/approve", ...approverOnly, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.approve))
  .patch("/adjustments/:id", ...anyActor, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.update))
  .delete("/adjustments/:id", ...anyActor, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.delete));

module.exports = router;
