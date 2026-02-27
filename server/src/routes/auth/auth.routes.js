const router = require("express").Router();

const ctrl = require("../../controllers/auth/auth.controller");

// Auth
router.post("/login", ctrl.login);
router.post("/refresh", ctrl.refresh);
router.post("/logout", ctrl.logout);

module.exports = router;