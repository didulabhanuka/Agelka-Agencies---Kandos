// routes/ledger/ledger.routes.js
const router = require("express").Router();

const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");
const { handleValidation } = require("../../middlewares/handleValidation");

const brCtrl = require("../../controllers/inventorySettings/branch.controller");
const brandCtrl = require("../../controllers/inventorySettings/brand.controller");
const groupCtrl = require("../../controllers/inventorySettings/productGroup.controller");

const {
  createBranchRules,
  updateBranchRules,
  branchIdParam,
  listBranchQuery,
} = require("../../validators/inventory/branch.validator");

const {
  mongoId,
  pagination,
  createBrandRules,
  updateBrandRules,
  createGroupRules,
  updateGroupRules,
} = require("../../validators/product/product.validator");

// Auth guards
const adminOnly = [verifyJWT, requireRole("Admin")];
const staffOrAdmin = [verifyJWT, requireRole("Admin", "DataEntry")];

// Brands
router
  .post("/brands", ...staffOrAdmin, createBrandRules, handleValidation, asyncHandler(brandCtrl.create))
  .get("/brands", verifyJWT, pagination, handleValidation, asyncHandler(brandCtrl.list))
  .get("/brands/:id", verifyJWT, mongoId(), handleValidation, asyncHandler(brandCtrl.get))
  .put("/brands/:id", ...staffOrAdmin, mongoId(), updateBrandRules, handleValidation, asyncHandler(brandCtrl.update))
  .delete("/brands/:id", ...adminOnly, mongoId(), handleValidation, asyncHandler(brandCtrl.remove));

// Product groups
router
  .post("/groups", ...staffOrAdmin, createGroupRules, handleValidation, asyncHandler(groupCtrl.create))
  .get("/groups", verifyJWT, pagination, handleValidation, asyncHandler(groupCtrl.list))
  .get("/groups/:id", verifyJWT, mongoId(), handleValidation, asyncHandler(groupCtrl.get))
  .put("/groups/:id", ...staffOrAdmin, mongoId(), updateGroupRules, handleValidation, asyncHandler(groupCtrl.update))
  .delete("/groups/:id", ...adminOnly, mongoId(), handleValidation, asyncHandler(groupCtrl.remove));

// Branches
router
  .post("/branches", ...adminOnly, createBranchRules, handleValidation, asyncHandler(brCtrl.create))
  .get("/branches", verifyJWT, listBranchQuery, handleValidation, asyncHandler(brCtrl.list))
  .get("/branches/:id", ...staffOrAdmin, branchIdParam, handleValidation, asyncHandler(brCtrl.get))
  .put("/branches/:id", ...adminOnly, branchIdParam, updateBranchRules, handleValidation, asyncHandler(brCtrl.update))
  .delete("/branches/:id", ...adminOnly, branchIdParam, handleValidation, asyncHandler(brCtrl.delete));

module.exports = router;