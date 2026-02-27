// routes/inventory/inventory.routes.js
const router = require("express").Router();

const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const { asyncHandler } = require("../../utils/asyncHandler");
const { handleValidation } = require("../../middlewares/handleValidation");

const ledgerCtrl = require("../../controllers/ledger/stockLedger.controller");
const purchaseLedgerCtrl = require("../../controllers/ledger/purchaseLedger.controller");
const salesLedgerCtrl = require("../../controllers/ledger/salesLedger.controller");
const businessLedgerCtrl = require("../../controllers/ledger/businessLedger.controller");

const { postLedgerRules, itemIdParam, ledgerQuery } = require("../../validators/ledger/stockLedger.validator");
const { listPurchaseLedgerQuery } = require("../../validators/ledger/purchaseLedger.validator");
const { listSalesLedgerQuery } = require("../../validators/ledger/salesLedger.validator");
const { businessSummaryQuery } = require("../../validators/ledger/businessLedger.validator");

// Auth guards
const adminOnly = [verifyJWT, requireRole("Admin")];
const staffOrAdmin = [verifyJWT, requireRole("Admin", "DataEntry")];
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];

// Stock ledger
router
  .post("/stock-ledger", ...staffOrAdmin, postLedgerRules, handleValidation, asyncHandler(ledgerCtrl.postEntry))
  .get("/stock-ledger", ...anyActor, ledgerQuery, handleValidation, asyncHandler(ledgerCtrl.getStock))
  .get("/stock-ledger/:itemId/balance", ...anyActor, itemIdParam, handleValidation, asyncHandler(ledgerCtrl.getBalance))
  .get("/stock-ledger/:itemId/history", ...anyActor, itemIdParam, handleValidation, asyncHandler(ledgerCtrl.getHistory))
  .post("/stock-ledger/reverse/:refModel/:refId", ...adminOnly, asyncHandler(ledgerCtrl.reverseByRef))
  .get("/stock-ledger/snapshot", ...anyActor, ledgerQuery, handleValidation, asyncHandler(ledgerCtrl.snapshot));

// Purchase ledger
router
  .get("/purchase-ledger", ...anyActor, listPurchaseLedgerQuery, handleValidation, asyncHandler(purchaseLedgerCtrl.list))
  .get("/purchase-ledger/summary", ...anyActor, listPurchaseLedgerQuery, handleValidation, asyncHandler(purchaseLedgerCtrl.summaryBySupplier))
  .get("/purchase-ledger/item", ...anyActor, listPurchaseLedgerQuery, handleValidation, asyncHandler(purchaseLedgerCtrl.summaryByItem))
  .get("/purchase-ledger/snapshot", ...anyActor, listPurchaseLedgerQuery, handleValidation, asyncHandler(purchaseLedgerCtrl.snapshot));

// Sales ledger
router
  .get("/sales-ledger", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.list))
  .get("/sales-ledger/summary", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.summaryByItem))
  .get("/sales-ledger/customers", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.summaryByCustomer))
  .get("/sales-ledger/snapshot", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.snapshot));

// Business ledger
router
  .get("/business-ledger/summary", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getBusinessSummary))
  .get("/business-ledger/items", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getItemSummary))
  .get("/business-ledger/branches", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getBranchSummary))
  .get("/business-ledger/snapshot", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getBusinessSnapshot));

module.exports = router;