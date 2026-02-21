// routes/inventory/inventory.routes.js
const express = require("express");
const router = express.Router();

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

const adminOnly = [verifyJWT, requireRole("Admin")];
const staffOrAdmin = [verifyJWT, requireRole("Admin", "DataEntry")];
const anyActor = [verifyJWT, requireRole("Admin", "DataEntry", "SalesRep")];

router
  // -------------------- STOCK LEDGER --------------------
  // staff can post manual ledger entries
  .post(
    "/stock-ledger",
    ...staffOrAdmin,
    postLedgerRules,
    handleValidation,
    asyncHandler(ledgerCtrl.postEntry)
  )

  // ✅ allow SalesRep reads (controller scopes to own)
  .get("/stock-ledger", ...anyActor, ledgerQuery, handleValidation, asyncHandler(ledgerCtrl.getStock))
  .get("/stock-ledger/:itemId/balance", ...anyActor, itemIdParam, handleValidation, asyncHandler(ledgerCtrl.getBalance))
  .get("/stock-ledger/:itemId/history", ...anyActor, itemIdParam, handleValidation, asyncHandler(ledgerCtrl.getHistory))

  // admin-only reverse + snapshot
  .post("/stock-ledger/reverse/:refModel/:refId", ...adminOnly, asyncHandler(ledgerCtrl.reverseByRef))
  .get("/stock-ledger/snapshot", ...anyActor, ledgerQuery, handleValidation, asyncHandler(ledgerCtrl.snapshot))

  // -------------------- PURCHASE LEDGER --------------------
  // ✅ allow SalesRep reads (controller scopes to own)
  .get("/purchase-ledger", ...anyActor, listPurchaseLedgerQuery, handleValidation, asyncHandler(purchaseLedgerCtrl.list))
  .get("/purchase-ledger/summary", ...anyActor, listPurchaseLedgerQuery, handleValidation, asyncHandler(purchaseLedgerCtrl.summaryBySupplier))
  .get("/purchase-ledger/snapshot", ...anyActor, listPurchaseLedgerQuery, handleValidation, asyncHandler(purchaseLedgerCtrl.snapshot))

  // -------------------- SALES LEDGER --------------------
  // ✅ NOW allow SalesRep reads too (controller scopes to own)
  .get("/sales-ledger", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.list))
  .get("/sales-ledger/summary", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.summaryByItem))
  .get("/sales-ledger/customers", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.summaryByCustomer))
  .get("/sales-ledger/snapshot", ...anyActor, listSalesLedgerQuery, handleValidation, asyncHandler(salesLedgerCtrl.snapshot))

  // -------------------- BUSINESS LEDGER --------------------
  // keep business ledger admin only
  // BUSINESS LEDGER (✅ allow SalesRep reads; controller scopes to own)
  .get("/business-ledger/summary", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getBusinessSummary))
  .get("/business-ledger/items", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getItemSummary))
  .get("/business-ledger/branches", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getBranchSummary))
  .get("/business-ledger/snapshot", ...anyActor, businessSummaryQuery, handleValidation, asyncHandler(businessLedgerCtrl.getBusinessSnapshot));


module.exports = router;
