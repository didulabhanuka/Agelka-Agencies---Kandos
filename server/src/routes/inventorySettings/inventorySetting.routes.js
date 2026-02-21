// routes/ledger/ledger.routes.js 
const express = require('express');
const router = express.Router();

const { verifyJWT, requireRole } = require('../../middlewares/auth/auth.middleware');
const { asyncHandler } = require('../../utils/asyncHandler');
const { handleValidation } = require('../../middlewares/handleValidation');

// Controllers
const brctrl = require("../../controllers/inventorySettings/branch.controller");
const brandCtrl = require('../../controllers/inventorySettings/brand.controller');
const groupCtrl = require('../../controllers/inventorySettings/productGroup.controller');

// Validators
const { createBranchRules, updateBranchRules, branchIdParam, listBranchQuery, } = require("../../validators/inventory/branch.validator");
const { 
  mongoId, pagination,
  createBrandRules, updateBrandRules,
  createGroupRules, updateGroupRules,
 } = require('../../validators/product/product.validator');

// Role shortcuts
const adminOnly = [verifyJWT, requireRole('Admin')];
const staffOrAdmin = [verifyJWT, requireRole('Admin', 'DataEntry')];


router
    // Brands
    .post('/brands', ...staffOrAdmin, createBrandRules, handleValidation, asyncHandler(brandCtrl.create))
    .get('/brands', verifyJWT, pagination, handleValidation, asyncHandler(brandCtrl.list))
    .get('/brands/:id', verifyJWT, mongoId(), handleValidation, asyncHandler(brandCtrl.get))
    .put('/brands/:id', ...staffOrAdmin, mongoId(), updateBrandRules, handleValidation, asyncHandler(brandCtrl.update))
    .delete('/brands/:id', ...adminOnly, mongoId(), handleValidation, asyncHandler(brandCtrl.remove))

    // Product Groups
    .post('/groups', ...staffOrAdmin, handleValidation, asyncHandler(groupCtrl.create))
    .get('/groups', verifyJWT, pagination, handleValidation, asyncHandler(groupCtrl.list))
    .get('/groups/:id', verifyJWT, mongoId(), handleValidation, asyncHandler(groupCtrl.get))
    .put('/groups/:id', ...staffOrAdmin, mongoId(),  handleValidation, asyncHandler(groupCtrl.update))
    .delete('/groups/:id', ...adminOnly, mongoId(), handleValidation, asyncHandler(groupCtrl.remove))

    // BRANCHES
    .post("/branches", ...adminOnly, createBranchRules, handleValidation, asyncHandler(brctrl.create))
    .get("/branches", listBranchQuery, handleValidation, asyncHandler(brctrl.list))
    .get("/branches/:id", ...staffOrAdmin, branchIdParam, handleValidation, asyncHandler(brctrl.get))
    .put("/branches/:id", ...adminOnly, updateBranchRules, handleValidation, asyncHandler(brctrl.update))
    .delete("/branches/:id", ...adminOnly, branchIdParam, handleValidation, asyncHandler(brctrl.delete));

module.exports = router;
