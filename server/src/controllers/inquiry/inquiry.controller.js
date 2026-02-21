const { asyncHandler } = require('../../utils/asyncHandler');
const { sendInquiry } = require('../../services/inquiry/inquiry.service');

exports.postInquiry = asyncHandler(async (req, res) => {
  const saved = await sendInquiry(req.body);
  res.status(200).json({ message: 'Inquiry submitted', id: saved._id });
});
