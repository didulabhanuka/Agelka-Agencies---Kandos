// src/services/user/customer.service.js
const Customer = require("../../models/user/customer.model");
const SalesRep = require("../../models/user/salesRep.model");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const CustomerPayment = require("../../models/finance/customerPayment.model");
const { updateCustomerCreditStatus, getCustomerOutstanding } = require("../finance/customerPayment.service");

// Validate assigned sales rep exists and is active.
async function ensureRep(repId) {
  if (!repId) return;
  const exists = await SalesRep.exists({ _id: repId, status: "active" });
  if (!exists) throw Object.assign(new Error("Invalid salesRep"), { status: 400 });
}

// Create customer after sales rep validation.
async function createCustomer(payload) {
  await ensureRep(payload.salesRep);
  const doc = await Customer.create(payload);
  return doc.toObject();
}

// List customers with pagination and optional keyword search.
async function listCustomers(filter = {}, { page = 1, limit = 50, q } = {}) {
  const where = { ...filter };
  if (q) where.$or = [{ customerCode: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }];
  return Customer.find(where).populate("salesRep", "repCode name").skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).lean();
}

// Fetch single customer with sales rep details.
async function getCustomer(id) {
  return Customer.findById(id).populate("salesRep", "repCode name").lean();
}

// Update customer after sales rep validation.
async function updateCustomer(id, payload) {
  await ensureRep(payload.salesRep);
  return Customer.findByIdAndUpdate(id, payload, { new: true }).populate("salesRep", "repCode name").lean();
}

// Prevent deleting customers linked to invoices or payments.
async function removeCustomer(id) {
  const hasInvoices = await SalesInvoice.exists({ customer: id });
  if (hasInvoices) throw Object.assign(new Error("Cannot delete customer with existing invoices"), { status: 400 });
  const hasPayments = await CustomerPayment.exists({ customer: id });
  if (hasPayments) throw Object.assign(new Error("Cannot delete customer with existing payments"), { status: 400 });
  return Customer.findByIdAndDelete(id).lean();
}

// Toggle manual credit block and recalculate when unblocking.
async function toggleCustomerCreditBlock(id) {
  const customer = await Customer.findById(id);
  if (!customer) throw Object.assign(new Error("Customer not found"), { status: 404 });
  if (customer.creditStatus === "blocked") {
    await Customer.findByIdAndUpdate(id, { creditStatus: "good" });
    await updateCustomerCreditStatus(id);
    return Customer.findById(id).lean();
  }
  customer.creditStatus = "blocked";
  await customer.save();
  return customer.toObject();
}

// Build customer snapshot with sales, credit, aging, trends, and recents.
async function getCustomerSnapshot(customerId, { recentLimit = 5, months = 6 } = {}) {
  const exists = await Customer.exists({ _id: customerId });
  if (!customerId || !exists) throw Object.assign(new Error("Invalid customer ID"), { status: 404 });

  const customer = await Customer.findById(customerId).populate("salesRep", "repCode name").lean();
  if (!customer) throw Object.assign(new Error("Customer not found"), { status: 404 });

  // Aggregate approved invoice totals for customer sales summary.
  const salesAgg = await SalesInvoice.aggregate([
    { $match: { customer: customer._id, status: "approved" } },
    { $group: { _id: "$customer", totalSalesValue: { $sum: "$totalValue" }, totalReturnedValue: { $sum: "$totalReturnedValue" }, netGoodsValue: { $sum: "$totalBalanceValue" }, totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } } } },
  ]);
  const sales = salesAgg[0] || { totalSalesValue: 0, totalReturnedValue: 0, netGoodsValue: 0, totalPaid: 0 };

  // Compute outstanding and credit utilization details.
  const outstanding = await getCustomerOutstanding(customerId);
  const creditLimit = Number(customer.creditLimit || 0);
  const creditUsed = outstanding;
  const creditRemaining = creditLimit > 0 ? Math.max(creditLimit - creditUsed, 0) : null;

  // Build aging buckets from unpaid approved invoice balances.
  const now = new Date();
  const agingRows = await SalesInvoice.aggregate([
    { $match: { customer: customer._id, status: "approved" } },
    { $project: { balance: { $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] }, ageDays: { $dateDiff: { startDate: "$invoiceDate", endDate: now, unit: "day" } } } },
    { $match: { balance: { $gt: 0 } } },
  ]);
  const aging = { "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
  for (const r of agingRows) {
    const bal = Number(r.balance || 0), ageDays = Number(r.ageDays || 0);
    if (ageDays <= 30) aging["0_30"] += bal;
    else if (ageDays <= 60) aging["31_60"] += bal;
    else if (ageDays <= 90) aging["61_90"] += bal;
    else aging["90_plus"] += bal;
  }

  // Prepare monthly trend window for invoice and payment summaries.
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - Number(months || 6));

  // Aggregate monthly approved sales trend by invoice date.
  const salesTrend = await SalesInvoice.aggregate([
    { $match: { customer: customer._id, status: "approved", invoiceDate: { $gte: fromDate } } },
    { $group: { _id: { year: { $year: "$invoiceDate" }, month: { $month: "$invoiceDate" } }, value: { $sum: "$totalBalanceValue" } } },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  // Aggregate monthly payment trend by payment date.
  const paymentTrend = await CustomerPayment.aggregate([
    { $match: { customer: customer._id, paymentDate: { $gte: fromDate } } },
    { $group: { _id: { year: { $year: "$paymentDate" }, month: { $month: "$paymentDate" } }, value: { $sum: "$amount" } } },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  // Fetch recent approved invoices for activity snapshot.
  const recentInvoices = await SalesInvoice.find({ customer: customerId, status: "approved" })
    .sort({ invoiceDate: -1 }).limit(Number(recentLimit)).select("invoiceNo invoiceDate totalBalanceValue paidAmount paymentStatus").lean();

  // Fetch recent customer payments for activity snapshot.
  const recentPayments = await CustomerPayment.find({ customer: customerId })
    .sort({ paymentDate: -1 }).limit(Number(recentLimit)).select("paymentNo paymentDate amount method").lean();

  // Return normalized customer snapshot payload for dashboard/report use.
  return {
    customer: { _id: customer._id, customerCode: customer.customerCode, name: customer.name, city: customer.city, contactNumber: customer.contactNumber, owner: customer.owner, salesRep: customer.salesRep, status: customer.status, creditStatus: customer.creditStatus, creditLimit, creditPeriod: customer.creditPeriod },
    sales,
    payments: { totalReceived: Number(sales.totalPaid || 0), outstanding: Number(outstanding || 0) },
    credit: { creditLimit, creditUsed, creditRemaining, status: customer.creditStatus },
    aging,
    trend: { sales: salesTrend, payments: paymentTrend },
    recentInvoices,
    recentPayments,
  };
}

module.exports = { createCustomer, listCustomers, getCustomer, updateCustomer, removeCustomer, toggleCustomerCreditBlock, getCustomerSnapshot };