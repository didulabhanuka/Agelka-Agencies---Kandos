// src/controllers/finance/customerPayment.controller.js
const {
  createCustomerPayment,
  listCustomerPayments,
  getCustomerPayment,
  getCustomerOutstanding,
  deleteCustomerPayment,
  previewPaymentAllocation,
  getPaymentsByInvoice,
  listOpenInvoicesForCustomer,
} = require("../../services/finance/customerPayment.service");



// ------------------------------------------------------------
// Get Outstanding Invoices for Manual Allocation (UI select)
// ------------------------------------------------------------
async function openInvoices(req, res) {
  const { customerId } = req.params;
  const invoices = await listOpenInvoicesForCustomer(customerId);

  return res.json({
    customerId,
    count: invoices.length,
    invoices,
  });
}

// ------------------------------------------------------------
// Create Payment
// ------------------------------------------------------------
async function create(req, res) {
  const result = await createCustomerPayment(req.body);
  return res.status(201).json(result);
}

// ------------------------------------------------------------
// List Payments
// ------------------------------------------------------------
async function list(req, res) {
  const { page = 1, limit = 50, q, customer } = req.query;

  const filter = {};
  if (customer) filter.customer = customer;

  const data = await listCustomerPayments(filter, {
    page: Number(page),
    limit: Number(limit),
    q,
  });

  return res.json(data);
}

// ------------------------------------------------------------
// Get One Payment
// ------------------------------------------------------------
async function get(req, res) {
  const { id } = req.params;
  const doc = await getCustomerPayment(id);

  if (!doc) {
    return res.status(404).json({ message: "Payment not found" });
  }

  return res.json(doc);
}

// ------------------------------------------------------------
// Customer Outstanding
// ------------------------------------------------------------
async function outstanding(req, res) {
  const { customerId } = req.params;
  const outstanding = await getCustomerOutstanding(customerId);

  return res.json({ customerId, outstanding });
}

// ------------------------------------------------------------
// Delete Payment
// ------------------------------------------------------------
async function remove(req, res) {
  const { id } = req.params;

  const result = await deleteCustomerPayment(id);

  return res.json({
    message: "Payment deleted successfully",
    ...result,
  });
}

// ------------------------------------------------------------
// Preview Allocation (for UI preview only)
// ------------------------------------------------------------
async function preview(req, res) {
  const { customer, amount } = req.body;

  if (!customer || !amount) {
    return res
      .status(400)
      .json({ message: "Customer and amount are required" });
  }

  const result = await previewPaymentAllocation({
    customerId: customer,
    amount,
  });

  return res.json(result);
}

// ------------------------------------------------------------
// Get Payments Allocated to a Specific Invoice
// ------------------------------------------------------------
async function paymentsByInvoice(req, res) {
  const { invoiceId } = req.params;

  const payments = await getPaymentsByInvoice(invoiceId);

  return res.json({
    invoiceId,
    count: payments.length,
    payments,
  });
}

module.exports = {
  create,
  list,
  get,
  outstanding,
  remove,
  preview,
  paymentsByInvoice,
  openInvoices,
};
