const { body } = require('express-validator');

const inquiryRules = [
  body('name').isString().trim().notEmpty(),
  body('email').isEmail(),
  body('message').isString().trim().isLength({ min: 5 }),
];

module.exports = { inquiryRules };
