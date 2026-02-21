// routes/user/user.routes.js 
const express = require('express');
const router = express.Router();

const { asyncHandler } = require('../../utils/asyncHandler');
const { verifyJWT, requireRole } = require('../../middlewares/auth/auth.middleware');
const { handleValidation } = require('../../middlewares/handleValidation');

// Controllers
const userCtrl = require('../../controllers/user/user.controller');
const supplierCtrl = require('../../controllers/user/supplier.controller');
const salesRepCtrl = require('../../controllers/user/salesRep.controller');
const customerCtrl = require('../../controllers/user/customer.controller');

// Validators
const { 
  mongoId, pagination,
  createUserRules, changePasswordRules, userIdParam,
  createSupplierRules, updateSupplierRules,
  createSalesRepRules, updateSalesRepRules,
  createCustomerRules, updateCustomerRules,
 } = require('../../validators/user/user.validator');

// Role shortcuts
const adminOnly = [verifyJWT, requireRole('Admin')];
const staffOrAdmin = [verifyJWT, requireRole('Admin', 'DataEntry')];



router
    // user routes
    .post( '/create-user', ...adminOnly, createUserRules, handleValidation, userCtrl.userCreate )
    .get('/users', ...adminOnly, asyncHandler(userCtrl.list))
    .get('/users/:id', ...adminOnly, userIdParam, handleValidation, asyncHandler(userCtrl.get))
    .put('/users/:id/', ...adminOnly, userIdParam, handleValidation, asyncHandler(userCtrl.update))
    .delete('/users/:id', ...adminOnly, userIdParam, handleValidation, asyncHandler(userCtrl.remove))

    // supplier routes
    .post('/suppliers', ...staffOrAdmin, createSupplierRules, handleValidation, asyncHandler(supplierCtrl.create))
    .get('/suppliers', verifyJWT, pagination, handleValidation, asyncHandler(supplierCtrl.list))
    .get('/suppliers/:id', verifyJWT, mongoId(), handleValidation, asyncHandler(supplierCtrl.get))
    .put('/suppliers/:id', ...staffOrAdmin, mongoId(), updateSupplierRules, handleValidation, asyncHandler(supplierCtrl.update))
    .delete('/suppliers/:id', verifyJWT, mongoId(), handleValidation, asyncHandler(supplierCtrl.remove))

    // salesRep routes
    .post('/sales-reps', ...staffOrAdmin, createSalesRepRules, handleValidation, asyncHandler(salesRepCtrl.create))
    .get('/sales-reps', verifyJWT, pagination, handleValidation, asyncHandler(salesRepCtrl.list))
    .get('/sales-reps/:id', verifyJWT, mongoId(), handleValidation, asyncHandler(salesRepCtrl.get))
    .put('/sales-reps/:id', ...staffOrAdmin, mongoId(), updateSalesRepRules, handleValidation, asyncHandler(salesRepCtrl.update))
    .delete('/sales-reps/:id', ...staffOrAdmin, mongoId(), handleValidation, asyncHandler(salesRepCtrl.remove))

    // customer routes
    .post('/customers', ...staffOrAdmin, createCustomerRules, handleValidation, asyncHandler(customerCtrl.create))
    .get('/customers', verifyJWT, pagination, handleValidation, asyncHandler(customerCtrl.list))
    .get('/customers/:id', verifyJWT, mongoId(), handleValidation, asyncHandler(customerCtrl.get))
    .put('/customers/:id', ...staffOrAdmin, mongoId(),  handleValidation, asyncHandler(customerCtrl.update))
    .delete('/customers/:id', ...staffOrAdmin, mongoId(), handleValidation, asyncHandler(customerCtrl.remove))
    .patch("/customers/:id/toggle-credit", ...staffOrAdmin, asyncHandler(customerCtrl.toggleCredit))
    .get("/customers/:id/snapshot", verifyJWT, mongoId(), handleValidation, asyncHandler(customerCtrl.snapshot));




module.exports = router;