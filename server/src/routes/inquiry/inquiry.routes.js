const express = require('express');
const router = express.Router();
const { postInquiry } = require('../../controllers/inquiry/inquiry.controller');
const { inquiryRules } = require('../../validators/inquiry/inquiry.validator');
const { handleValidation } = require('../../middlewares/handleValidation');

router.post('/', inquiryRules, handleValidation, postInquiry);

module.exports = router;
