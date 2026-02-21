const express = require('express');

const userRoutes = require('./user/user.routes');
const authRoutes = require('./auth/auth.routes');

const ledgerRoutes = require('./ledger/ledger.routes');

const saleRoutes = require('./sale/sale.routes');

const financeRoutes = require('./finance/finance.routes');

const inventoryRoutes = require('./inventory/inventory.routes');
const inventorySettingsRoutes = require('./inventorySettings/inventorySetting.routes');

const purchasesRoutes = require('./purchases/purchases.routes');



const auditRoutes = require('./audit/audit.routes');
const inquiryRoutes = require('./inquiry/inquiry.routes');




const router = express.Router();

router.use('/user', userRoutes);
router.use('/auth', authRoutes);
router.use('/inventorySettings', inventorySettingsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sale', saleRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/finance', financeRoutes);
router.use('/purchase', purchasesRoutes);



router.use('/audit', auditRoutes);
router.use('/inquiry', inquiryRoutes);

// Healthcheck
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = router;
