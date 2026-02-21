// src/services/user/customer.service.js
const Customer = require("../../models/user/customer.model");
const SalesRep = require("../../models/user/salesRep.model");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const CustomerPayment = require("../../models/finance/customerPayment.model");
const { updateCustomerCreditStatus, getCustomerOutstanding } = require("../finance/customerPayment.service");

//-------------------- [ Validate SalesRep Exists & Active ] ----------------------
async function ensureRep(repId) {
  if (!repId) return;
  const exists = await SalesRep.exists({ _id: repId, status: "active" });
  if (!exists) throw Object.assign(new Error("Invalid salesRep"), { status: 400 });
}

//-------------------- [ Create Customer ] ----------------------
async function createCustomer(payload) {
  await ensureRep(payload.salesRep);
  const doc = await Customer.create(payload);
  return doc.toObject();
}

//-------------------- [ List Customers ] ----------------------
async function listCustomers(filter = {}, { page = 1, limit = 50, q } = {}) {
  const where = { ...filter };

  if (q) {
    where.$or = [
      { customerCode: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
    ];
  }

  return Customer.find(where)
    .populate("salesRep", "repCode name")
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();
}

//-------------------- [ Get Customer ] ----------------------
async function getCustomer(id) {
  return Customer.findById(id)
    .populate("salesRep", "repCode name")
    .lean();
}

//-------------------- [ Update Customer ] ----------------------
async function updateCustomer(id, payload) {
  await ensureRep(payload.salesRep);
  return Customer.findByIdAndUpdate(id, payload, { new: true }).lean();
}

//-------------------- [ DELETE PROTECTION ] ----------------------
async function removeCustomer(id) {
  // Prevent delete if finance history exists
  const hasInvoices = await SalesInvoice.exists({ customer: id });
  if (hasInvoices) {
    throw Object.assign(
      new Error("Cannot delete customer with existing invoices"),
      { status: 400 }
    );
  }

  const hasPayments = await CustomerPayment.exists({ customer: id });
  if (hasPayments) {
    throw Object.assign(
      new Error("Cannot delete customer with existing payments"),
      { status: 400 }
    );
  }

  return Customer.findByIdAndDelete(id).lean();
}

// -------------------- [ Toggle Credit Block State ] ----------------------
async function toggleCustomerCreditBlock(id) {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw Object.assign(new Error("Customer not found"), { status: 404 });
  }

  // If currently BLOCKED → UNBLOCK + recalc
  if (customer.creditStatus === "blocked") {
    // 1) First remove the manual block flag
    await Customer.findByIdAndUpdate(id, { creditStatus: "good" });

    // 2) Now run auto credit engine (will see GOOD, not BLOCKED)
    await updateCustomerCreditStatus(id);

    // 3) Return fresh doc
    const updated = await Customer.findById(id).lean();
    return updated;
  }

  // If NOT blocked → set to BLOCKED (manual override)
  customer.creditStatus = "blocked";
  await customer.save();
  return customer.toObject();
}

//-------------------- [ Get Customer Snapshot ] ----------------------
async function getCustomerSnapshot(customerId, { recentLimit = 5, months = 6 } = {}) {
  if (!customerId || !Customer.exists({ _id: customerId })) {
    throw Object.assign(new Error("Invalid customer ID"), { status: 404 });
  }

  /* ---------------- CUSTOMER ---------------- */
  const customer = await Customer.findById(customerId)
    .populate("salesRep", "repCode name")
    .lean();

  if (!customer) {
    throw Object.assign(new Error("Customer not found"), { status: 404 });
  }

  /* ---------------- SALES SUMMARY ---------------- */
  const salesAgg = await SalesInvoice.aggregate([
    { $match: { customer: customer._id, status: "approved" } },
    {
      $group: {
        _id: "$customer",
        totalSalesValue: { $sum: "$totalValue" },
        totalReturnedValue: { $sum: "$totalReturnedValue" },
        netGoodsValue: { $sum: "$totalBalanceValue" },
        totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } },
      },
    },
  ]);

  const sales = salesAgg[0] || {
    totalSalesValue: 0,
    totalReturnedValue: 0,
    netGoodsValue: 0,
    totalPaid: 0,
  };

  /* ---------------- OUTSTANDING ---------------- */
  const outstanding = await getCustomerOutstanding(customerId);

  /* ---------------- CREDIT ---------------- */
  const creditLimit = Number(customer.creditLimit || 0);
  const creditUsed = outstanding;
  const creditRemaining =
    creditLimit > 0 ? Math.max(creditLimit - creditUsed, 0) : null;

  /* ---------------- AGING ---------------- */
  const now = new Date();

  const agingRows = await SalesInvoice.aggregate([
    { $match: { customer: customer._id, status: "approved" } },
    {
      $project: {
        balance: {
          $subtract: [
            "$totalBalanceValue",
            { $ifNull: ["$paidAmount", 0] },
          ],
        },
        ageDays: {
          $dateDiff: {
            startDate: "$invoiceDate",
            endDate: now,
            unit: "day",
          },
        },
      },
    },
    { $match: { balance: { $gt: 0 } } },
  ]);

  const aging = { "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };

  for (const r of agingRows) {
    if (r.ageDays <= 30) aging["0_30"] += r.balance;
    else if (r.ageDays <= 60) aging["31_60"] += r.balance;
    else if (r.ageDays <= 90) aging["61_90"] += r.balance;
    else aging["90_plus"] += r.balance;
  }

  /* ---------------- MONTHLY TREND ---------------- */
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - months);

  const salesTrend = await SalesInvoice.aggregate([
    { $match: { customer: customer._id, status: "approved", invoiceDate: { $gte: fromDate } } },
    {
      $group: {
        _id: { year: { $year: "$invoiceDate" }, month: { $month: "$invoiceDate" } },
        value: { $sum: "$totalBalanceValue" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const paymentTrend = await CustomerPayment.aggregate([
    { $match: { customer: customer._id, paymentDate: { $gte: fromDate } } },
    {
      $group: {
        _id: { year: { $year: "$paymentDate" }, month: { $month: "$paymentDate" } },
        value: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  /* ---------------- RECENTS ---------------- */
  const recentInvoices = await SalesInvoice.find({
    customer: customerId,
    status: "approved",
  })
    .sort({ invoiceDate: -1 })
    .limit(recentLimit)
    .select("invoiceNo invoiceDate totalBalanceValue paidAmount paymentStatus")
    .lean();

  const recentPayments = await CustomerPayment.find({
    customer: customerId,
  })
    .sort({ paymentDate: -1 })
    .limit(recentLimit)
    .select("paymentNo paymentDate amount method")
    .lean();

  return {
    customer: {
      _id: customer._id,
      customerCode: customer.customerCode,
      name: customer.name,
      city: customer.city,
      contactNumber: customer.contactNumber,
      owner: customer.owner,
      salesRep: customer.salesRep,
      status: customer.status,
      creditStatus: customer.creditStatus,
      creditLimit,
      creditPeriod: customer.creditPeriod,
    },
    sales,
    payments: {
      totalReceived: sales.totalPaid,
      outstanding,
    },
    credit: {
      creditLimit,
      creditUsed,
      creditRemaining,
      status: customer.creditStatus,
    },
    aging,
    trend: {
      sales: salesTrend,
      payments: paymentTrend,
    },
    recentInvoices,
    recentPayments,
  };
}


module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  removeCustomer,
  toggleCustomerCreditBlock,
  getCustomerSnapshot,
};
