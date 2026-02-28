// server/src/routes/period/period.routes.js
const router = require("express").Router();
const { asyncHandler } = require("../../utils/asyncHandler");
const { verifyJWT, requireRole } = require("../../middlewares/auth/auth.middleware");
const periodCtrl = require("../../controllers/period/period.controller");

const adminOnly = [verifyJWT, requireRole("Admin")];
const allStaff  = [verifyJWT];

router.post("/rollover",           ...adminOnly, asyncHandler(periodCtrl.rollover));
router.get("/status",              ...adminOnly, asyncHandler(periodCtrl.status));
router.get("/counts",              ...adminOnly, asyncHandler(periodCtrl.counts));
router.get("/history",             ...allStaff,  asyncHandler(periodCtrl.history));
router.get("/data/:model/:period", ...allStaff,  asyncHandler(periodCtrl.historicalData));

module.exports = router;