const nodemailer = require('nodemailer');
const Inquiry = require('../../models/inquiry/inquiry.model');
const {
  INQUIRY_TO_EMAIL,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
} = require('../../config/env');

async function sendInquiry(inquiryData) {
  const saved = await Inquiry.create(inquiryData);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: Boolean(SMTP_SECURE),
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: inquiryData.email,
    to: INQUIRY_TO_EMAIL,
    subject: 'New Inquiry',
    text: `Name: ${inquiryData.name}\nEmail: ${inquiryData.email}\n\n${inquiryData.message}`,
  });

  return saved;
}

module.exports = { sendInquiry };
