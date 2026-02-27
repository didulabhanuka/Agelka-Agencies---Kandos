// src/controllers/finance/customerPayment.controller.js
const {
  createCustomerPayment,
  updateCustomerPayment, 
  approveCustomerPayment,
  listCustomerPayments,
  getCustomerPayment,
  getCustomerOutstanding,
  deleteCustomerPayment,
  previewPaymentAllocation,
  getPaymentsByInvoice,
  listOpenInvoicesForCustomer,
  getReceivablesReport,
} = require("../../services/finance/customerPayment.service");

// GET /finance/customer-payments/open-invoices/:customerId - Returns open invoices for manual payment allocation UI.
async function openInvoices(req, res) {
  const { customerId } = req.params;
  const invoices = await listOpenInvoicesForCustomer(customerId);

  return res.json({
    customerId,
    count: invoices.length,
    invoices,
  });
}

// POST /finance/customer-payments - Creates a new customer payment and applies allocation logic in service layer.
async function create(req, res) {
  const result = await createCustomerPayment(req.body);
  return res.status(201).json(result);
}

// POST /finance/customer-payments/update/:id - Updates a pending customer payment by id.
async function update(req, res) {
  const { id } = req.params;

  try {
    const updatedPayment = await updateCustomerPayment(id, req.body);
    return res.json(updatedPayment);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

// POST /finance/customer-payments/approve/:id - Approves a customer payment by id.
async function approve(req, res) {
  console.log("Approve request received"); // Check if the request reaches here
  const { id } = req.params;
  const userId = req.user._id; // Assuming user ID is available in req.user (from authentication middleware)

  try {
    const approvedPayment = await approveCustomerPayment(id, userId);
    console.log("Approved Payment:", approvedPayment); // Log the approved payment status
    return res.json(approvedPayment);
  } catch (err) {
    console.error("Error:", err);
    return res.status(400).json({ message: err.message });
  }
}

// GET /finance/customer-payments - Lists customer payments with pagination and optional search/customer filters.
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

// GET /finance/customer-payments/:id - Returns a single customer payment by id.
async function get(req, res) {
  const { id } = req.params;
  const doc = await getCustomerPayment(id);

  if (!doc) {
    return res.status(404).json({ message: "Payment not found" });
  }

  return res.json(doc);
}

// GET /finance/customer-payments/outstanding/:customerId - Returns total outstanding amount for a customer.
async function outstanding(req, res) {
  const { customerId } = req.params;
  const outstanding = await getCustomerOutstanding(customerId);

  return res.json({ customerId, outstanding });
}

// DELETE /finance/customer-payments/:id - Deletes a customer payment and reverses related effects in service layer.
async function remove(req, res) {
  const { id } = req.params;

  const result = await deleteCustomerPayment(id);

  return res.json({
    message: "Payment deleted successfully",
    ...result,
  });
}

// POST /finance/customer-payments/preview - Previews automatic allocation result without persisting payment.
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

// GET /finance/customer-payments/by-invoice/:invoiceId - Returns payments allocated to a specific invoice.
async function paymentsByInvoice(req, res) {
  const { invoiceId } = req.params;

  const payments = await getPaymentsByInvoice(invoiceId);

  return res.json({
    invoiceId,
    count: payments.length,
    payments,
  });
}

// GET /finance/customer-payments/reports/receivables - Returns receivables dashboard data (summary, invoice rows, totals by customer, totals by salesRep) with optional filters and sorting.
async function receivablesReport(req, res) {
  const {
    customerId,
    salesRepId,
    dateFrom,
    dateTo,
    sortBy = "date",
    sortOrder = "asc",
    page = 1,
    limit = 50,
  } = req.query;

  const result = await getReceivablesReport({
    customerId,
    salesRepId,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    page: Number(page),
    limit: Number(limit),
  });

  return res.json(result);
}

module.exports = {
  create,
  update,
  approve,
  list,
  get,
  outstanding,
  remove,
  preview,
  paymentsByInvoice,
  openInvoices,
  receivablesReport,
};