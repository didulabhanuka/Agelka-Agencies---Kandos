// routes/ledger/ledger.routes.js
const router = require("express").Router();

const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");
const { handleValidation } = require("../../middlewares/handleValidation");

const itemCtrl = require("../../controllers/inventory/item.controller");
const adjCtrl = require("../../controllers/inventory/adjustment.controller");

const { mongoId, pagination } = require("../../validators/product/product.validator");
const { adjustmentIdParam, listAdjustmentQuery } = require("../../validators/inventory/adjustment.validator");

// Auth guards
const adminOnly = [verifyJWT, requireRole("Admin")];
const approverOnly = [verifyJWT, requireRole("Admin", "DataEntry")];
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];

// Items
router
  .post("/items", ...approverOnly, handleValidation, asyncHandler(itemCtrl.create))
  .get("/items", ...anyActor, pagination, handleValidation, asyncHandler(itemCtrl.list))
  .get("/items/supplier/:supplierId", ...anyActor, handleValidation, asyncHandler(itemCtrl.getBySupplier))
  .get("/items/sales-rep-stock", ...anyActor, handleValidation, asyncHandler(itemCtrl.listSalesRepStockDetails))
  .get("/items/:id", ...anyActor, mongoId(), handleValidation, asyncHandler(itemCtrl.get))
  .put("/items/:id", ...approverOnly, mongoId(), handleValidation, asyncHandler(itemCtrl.update))
  .delete("/items/:id", ...adminOnly, mongoId(), handleValidation, asyncHandler(itemCtrl.remove));

// Stock adjustments
router
  .post("/adjustments", ...anyActor, handleValidation, asyncHandler(adjCtrl.create))
  .get("/adjustments", ...anyActor, listAdjustmentQuery, handleValidation, asyncHandler(adjCtrl.list))
  .get("/adjustments/:id", ...anyActor, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.get))
  .patch("/adjustments/:id/approve", ...approverOnly, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.approve))
  .patch("/adjustments/:id", ...anyActor, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.update))
  .delete("/adjustments/:id", ...anyActor, adjustmentIdParam, handleValidation, asyncHandler(adjCtrl.delete));

module.exports = router;