// // src/services/finance/customerPayment.service.js
// const mongoose = require("mongoose");
// const CustomerPayment = require("../../models/finance/customerPayment.model");
// const SalesInvoice = require("../../models/sale/SalesInvoice.model");
// const Customer = require("../../models/user/customer.model");

// // Calculate total outstanding balance for a customer from approved invoices.
// async function getCustomerOutstanding(customerId) {
//   const result = await SalesInvoice.aggregate([
//     { $match: { customer: new mongoose.Types.ObjectId(customerId), status: "approved" } },
//     {
//       $group: {
//         _id: "$customer",
//         outstanding: { $sum: { $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] } },
//       },
//     },
//   ]);
//   return result[0]?.outstanding || 0;
// }

// // Recompute customer credit status using outstanding, overdue, and limit thresholds.
// async function updateCustomerCreditStatus(customerId) {
//   const customer = await Customer.findById(customerId).lean();
//   if (!customer) return;
//   if (customer.creditStatus === "blocked") return;

//   const outstanding = await getCustomerOutstanding(customerId);

//   if (outstanding > customer.creditLimit) {
//     return Customer.findByIdAndUpdate(customerId, { creditStatus: "over-limit" });
//   }

//   const overdue = await SalesInvoice.exists({
//     customer: customerId,
//     status: "approved",
//     invoiceDate: { $lt: new Date(Date.now() - customer.creditPeriod * 86400000) },
//     $expr: { $gt: [{ $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] }, 0] },
//   });

//   if (overdue) return Customer.findByIdAndUpdate(customerId, { creditStatus: "overdue" });
//   if (outstanding > customer.creditLimit * 0.8) return Customer.findByIdAndUpdate(customerId, { creditStatus: "warning" });
//   return Customer.findByIdAndUpdate(customerId, { creditStatus: "good" });
// }

// // Derive invoice payment status from invoice total and paid amount.
// function computePaymentStatus(invoice) {
//   const goodsValue = Number(invoice.totalBalanceValue || 0);
//   const paid = Number(invoice.paidAmount || 0);
//   if (paid <= 0) return "unpaid";
//   if (paid < goodsValue) return "partially_paid";
//   return "paid";
// }

// // Return approved invoices with positive outstanding balances for customer payment selection.
// async function listOpenInvoicesForCustomer(customerId) {
//   const invoices = await SalesInvoice.find({
//     customer: customerId,
//     status: "approved",
//     totalBalanceValue: { $gt: 0 },
//     $expr: { $gt: [{ $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] }, 0] },
//   })
//     .sort({ invoiceDate: 1 })
//     .select("invoiceNo invoiceDate totalBalanceValue paidAmount")
//     .lean();

//   return invoices.map((inv) => {
//     const total = Number(inv.totalBalanceValue || 0);
//     const paid = Number(inv.paidAmount || 0);
//     return { _id: inv._id, invoiceNo: inv.invoiceNo, invoiceDate: inv.invoiceDate, totalBalanceValue: total, paidAmount: paid, balance: total - paid };
//   });
// }

// // Preview FIFO-style allocation of a payment amount across open invoices.
// async function previewPaymentAllocation({ customerId, amount }) {
//   const numericAmount = Number(amount);
//   if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw Object.assign(new Error("Invalid preview amount"), { status: 400 });

//   const invoices = await SalesInvoice.find({ customer: customerId, status: "approved", totalBalanceValue: { $gt: 0 } })
//     .sort({ invoiceDate: 1 })
//     .lean();

//   let remaining = numericAmount;
//   const allocations = [];

//   for (const inv of invoices) {
//     if (remaining <= 0) break;
//     const goodsValue = Number(inv.totalBalanceValue || 0);
//     const paid = Number(inv.paidAmount || 0);
//     const outstanding = goodsValue - paid;
//     if (outstanding <= 0) continue;

//     const allocate = Math.min(outstanding, remaining);
//     allocations.push({ invoice: { ...inv, paidAmount: paid, balance: outstanding }, amount: allocate });
//     remaining -= allocate;
//   }

//   return { allocations };
// }

// // Create a customer payment with mandatory manual allocations and invoice updates in a transaction.
// async function createCustomerPayment(payload) {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { paymentNo, customer, paymentDate, amount, method, referenceNo, collectedBy, remarks, allocations: manualAllocations } = payload;

//     const customerDoc = await Customer.findById(customer).session(session).lean();
//     if (!customerDoc) throw Object.assign(new Error("Customer not found"), { status: 400 });

//     const numericAmount = Number(amount);
//     if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw Object.assign(new Error("Invalid payment amount"), { status: 400 });

//     // Require explicit manual invoice allocations from the UI.
//     if (!Array.isArray(manualAllocations) || manualAllocations.length === 0) {
//       throw Object.assign(new Error("Manual allocations are required (select invoice + amount)"), { status: 400 });
//     }

//     // Normalize and merge duplicate invoice allocations by invoice ID.
//     const merged = new Map();
//     for (const a of manualAllocations) {
//       const invoiceId = a?.invoice;
//       const amt = Number(a?.amount);

//       if (!invoiceId) throw Object.assign(new Error("Allocation invoice is required"), { status: 400 });
//       if (!Number.isFinite(amt) || amt <= 0) throw Object.assign(new Error("Allocation amount must be > 0"), { status: 400 });

//       merged.set(String(invoiceId), (merged.get(String(invoiceId)) || 0) + amt);
//     }

//     const cleaned = Array.from(merged.entries()).map(([invoice, amt]) => ({ invoice, amount: amt }));
//     const totalAllocated = cleaned.reduce((s, a) => s + a.amount, 0);

//     // Enforce exact allocation total to keep payment tracking consistent.
//     if (Math.abs(totalAllocated - numericAmount) > 0.0001) {
//       throw Object.assign(new Error("Allocated total must equal payment amount"), { status: 400 });
//     }

//     // Validate each allocation and apply paid amounts to invoices.
//     for (const alloc of cleaned) {
//       const invoice = await SalesInvoice.findById(alloc.invoice).session(session);

//       if (!invoice) throw Object.assign(new Error("Invoice not found for allocation"), { status: 400 });
//       if (String(invoice.customer) !== String(customer)) throw Object.assign(new Error("Invoice does not belong to customer"), { status: 400 });
//       if (invoice.status !== "approved") throw Object.assign(new Error(`Invoice not approved (${invoice.invoiceNo})`), { status: 400 });

//       const goodsValue = Number(invoice.totalBalanceValue || 0);
//       const paid = Number(invoice.paidAmount || 0);
//       const outstanding = goodsValue - paid;

//       if (outstanding <= 0) throw Object.assign(new Error(`Invoice already fully paid (${invoice.invoiceNo})`), { status: 400 });
//       if (alloc.amount > outstanding + 0.0001) throw Object.assign(new Error(`Allocation exceeds invoice balance (${invoice.invoiceNo})`), { status: 400 });

//       invoice.paidAmount = paid + alloc.amount;
//       invoice.paymentStatus = computePaymentStatus(invoice);
//       await invoice.save({ session });
//     }

//     // Persist the payment document after invoice validations succeed.
//     const [doc] = await CustomerPayment.create(
//       [{ paymentNo, customer, paymentDate, amount: numericAmount, method, referenceNo, collectedBy, remarks, allocations: cleaned }],
//       { session }
//     );

//     // Append allocation history entries to the affected invoices.
//     for (const alloc of cleaned) {
//       const invoice = await SalesInvoice.findById(alloc.invoice).session(session);
//       if (!invoice) continue;

//       invoice.paymentAllocations.push({ paymentId: doc._id, amount: alloc.amount, date: paymentDate, method, referenceNo, collectedBy });
//       await invoice.save({ session });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     await updateCustomerCreditStatus(customer);
//     await Customer.findByIdAndUpdate(customer, { $addToSet: { payments: doc._id } });

//     return { payment: doc.toObject(), unallocated: 0 };
//   } catch (err) {
//     if (session.inTransaction()) await session.abortTransaction();
//     session.endSession();
//     throw err;
//   }
// }

// // List customer payments with optional search and pagination.
// async function listCustomerPayments(filter = {}, { page = 1, limit = 50, q }) {
//   const where = { ...filter };
//   if (q) where.paymentNo = { $regex: q, $options: "i" };

//   return CustomerPayment.find(where)
//     .populate("customer", "customerCode name creditStatus")
//     .populate("collectedBy", "repCode name")
//     .sort({ paymentDate: -1 })
//     .skip((page - 1) * limit)
//     .limit(Number(limit))
//     .lean();
// }

// // Get a single customer payment with invoice allocation and collector details.
// async function getCustomerPayment(id) {
//   return CustomerPayment.findById(id)
//     .populate("customer", "customerCode name creditStatus")
//     .populate("collectedBy", "repCode name")
//     .populate({
//       path: "allocations.invoice",
//       select: "invoiceNo invoiceDate paidAmount paymentStatus totalBalanceValue paymentAllocations",
//       populate: [{ path: "paymentAllocations.collectedBy", select: "repCode name" }],
//     })
//     .lean();
// }

// // Delete a payment and roll back invoice paid amounts and allocation history in a transaction.
// async function deleteCustomerPayment(id) {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const payment = await CustomerPayment.findById(id).session(session);
//     if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });

//     const customerId = payment.customer;

//     for (const alloc of payment.allocations) {
//       const invoice = await SalesInvoice.findById(alloc.invoice).session(session);
//       if (!invoice) continue;

//       invoice.paidAmount = Math.max(0, Number(invoice.paidAmount || 0) - Number(alloc.amount || 0));
//       invoice.paymentStatus = computePaymentStatus(invoice);
//       invoice.paymentAllocations = invoice.paymentAllocations.filter((p) => String(p.paymentId) !== String(payment._id));
//       await invoice.save({ session });
//     }

//     await CustomerPayment.findByIdAndDelete(id).session(session);
//     await session.commitTransaction();
//     session.endSession();

//     await updateCustomerCreditStatus(customerId);
//     await Customer.findByIdAndUpdate(customerId, { $pull: { payments: payment._id } });

//     return { success: true };
//   } catch (err) {
//     if (session.inTransaction()) await session.abortTransaction();
//     session.endSession();
//     throw err;
//   }
// }

// // Return all payments that allocated amounts to a specific invoice.
// async function getPaymentsByInvoice(invoiceId) {
//   const payments = await CustomerPayment.find({ "allocations.invoice": invoiceId })
//     .populate("customer", "customerCode name creditStatus")
//     .populate("collectedBy", "repCode name")
//     .lean();

//   return payments.map((p) => {
//     const alloc = p.allocations.find((a) => String(a.invoice) === String(invoiceId));
//     return {
//       _id: p._id,
//       paymentNo: p.paymentNo,
//       paymentDate: p.paymentDate,
//       amount: p.amount,
//       method: p.method,
//       referenceNo: p.referenceNo,
//       collectedBy: p.collectedBy,
//       customer: p.customer,
//       allocationAmount: alloc?.amount || 0,
//     };
//   });
// }

// // Build receivables report with paged invoice rows, summaries, and grouped aggregates.
// async function getReceivablesReport({
//   customerId,
//   salesRepId,
//   dateFrom,
//   dateTo,
//   sortBy = "date",
//   sortOrder = "asc",
//   page = 1,
//   limit = 50,
// } = {}) {
//   const match = { status: "approved", totalBalanceValue: { $gt: 0 } };

//   if (customerId) match.customer = new mongoose.Types.ObjectId(customerId);
//   if (salesRepId) match.salesRep = new mongoose.Types.ObjectId(salesRepId); // Update field name if your invoice uses a different sales rep key.
//   if (dateFrom || dateTo) {
//     match.invoiceDate = {};
//     if (dateFrom) match.invoiceDate.$gte = new Date(dateFrom);
//     if (dateTo) {
//       const to = new Date(dateTo);
//       to.setHours(23, 59, 59, 999);
//       match.invoiceDate.$lte = to;
//     }
//   }

//   const outstandingExpr = { $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] };
//   const matchOutstandingGtZero = { $expr: { $gt: [outstandingExpr, 0] } };

//   const basePipeline = [
//     { $match: match },
//     { $match: matchOutstandingGtZero },
//     { $lookup: { from: "customers", localField: "customer", foreignField: "_id", as: "customer" } },
//     { $unwind: "$customer" },
//     { $lookup: { from: "salesreps", localField: "salesRep", foreignField: "_id", as: "salesRep" } }, // Update collection if sales reps are stored elsewhere.
//     { $unwind: { path: "$salesRep", preserveNullAndEmptyArrays: true } },
//     { $addFields: { total: { $ifNull: ["$totalBalanceValue", 0] }, paid: { $ifNull: ["$paidAmount", 0] }, balance: outstandingExpr } },
//     { $addFields: { ageDays: { $max: [0, { $dateDiff: { startDate: "$invoiceDate", endDate: "$$NOW", unit: "day" } }] } } }, // Age is based on invoiceDate because dueDate is not available.
//     {
//       $addFields: {
//         agingBucket: {
//           $switch: {
//             branches: [
//               { case: { $lte: ["$ageDays", 30] }, then: "0-30" },
//               { case: { $lte: ["$ageDays", 60] }, then: "31-60" },
//               { case: { $lte: ["$ageDays", 90] }, then: "61-90" },
//             ],
//             default: "90+",
//           },
//         },
//       },
//     },
//   ];

//   const rowSortMap = {
//     date: { invoiceDate: sortOrder === "desc" ? -1 : 1, _id: 1 },
//     customer: { "customer.name": sortOrder === "desc" ? -1 : 1, invoiceDate: 1, _id: 1 },
//     salesRep: { "salesRep.name": sortOrder === "desc" ? -1 : 1, invoiceDate: 1, _id: 1 },
//     balance: { balance: sortOrder === "desc" ? -1 : 1, invoiceDate: 1, _id: 1 },
//   };

//   // Generate paged invoice-level receivables rows.
//   const rowsPipeline = [
//     ...basePipeline,
//     {
//       $project: {
//         _id: 1,
//         invoiceNo: 1,
//         invoiceDate: 1,
//         paymentStatus: 1,
//         totalBalanceValue: "$total",
//         paidAmount: "$paid",
//         balance: 1,
//         ageDays: 1,
//         agingBucket: 1,
//         customer: { _id: "$customer._id", customerCode: "$customer.customerCode", name: "$customer.name" },
//         salesRep: { _id: "$salesRep._id", repCode: "$salesRep.repCode", name: "$salesRep.name" },
//       },
//     },
//     { $sort: rowSortMap[sortBy] || rowSortMap.date },
//     { $skip: (Number(page) - 1) * Number(limit) },
//     { $limit: Number(limit) },
//   ];

//   // Build overall outstanding summary and aging totals.
//   const summaryPipeline = [
//     ...basePipeline,
//     {
//       $group: {
//         _id: null,
//         totalOutstanding: { $sum: "$balance" },
//         totalInvoiceValue: { $sum: "$total" },
//         totalPaidValue: { $sum: "$paid" },
//         invoiceCount: { $sum: 1 },
//         customers: { $addToSet: "$customer._id" },
//         salesReps: { $addToSet: "$salesRep._id" },
//         age_0_30: { $sum: { $cond: [{ $eq: ["$agingBucket", "0-30"] }, "$balance", 0] } },
//         age_31_60: { $sum: { $cond: [{ $eq: ["$agingBucket", "31-60"] }, "$balance", 0] } },
//         age_61_90: { $sum: { $cond: [{ $eq: ["$agingBucket", "61-90"] }, "$balance", 0] } },
//         age_90_plus: { $sum: { $cond: [{ $eq: ["$agingBucket", "90+"] }, "$balance", 0] } },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         totalOutstanding: 1,
//         totalInvoiceValue: 1,
//         totalPaidValue: 1,
//         invoiceCount: 1,
//         customerCount: { $size: { $filter: { input: "$customers", as: "c", cond: { $ne: ["$$c", null] } } } },
//         salesRepCount: { $size: { $filter: { input: "$salesReps", as: "s", cond: { $ne: ["$$s", null] } } } },
//         aging: { "0_30": "$age_0_30", "31_60": "$age_31_60", "61_90": "$age_61_90", "90_plus": "$age_90_plus" },
//       },
//     },
//   ];

//   // Aggregate outstanding totals grouped by customer.
//   const byCustomerPipeline = [
//     ...basePipeline,
//     {
//       $group: {
//         _id: "$customer._id",
//         customerCode: { $first: "$customer.customerCode" },
//         customerName: { $first: "$customer.name" },
//         invoiceCount: { $sum: 1 },
//         totalInvoiceValue: { $sum: "$total" },
//         totalPaidValue: { $sum: "$paid" },
//         totalOutstanding: { $sum: "$balance" },
//         oldestInvoiceDate: { $min: "$invoiceDate" },
//         maxAgeDays: { $max: "$ageDays" },
//       },
//     },
//     { $sort: { totalOutstanding: -1, customerName: 1 } },
//     { $project: { _id: 1, customerCode: 1, customerName: 1, invoiceCount: 1, totalInvoiceValue: 1, totalPaidValue: 1, totalOutstanding: 1, oldestInvoiceDate: 1, maxAgeDays: 1 } },
//   ];

//   // Aggregate outstanding totals grouped by sales rep, including unassigned invoices.
//   const bySalesRepPipeline = [
//     ...basePipeline,
//     {
//       $group: {
//         _id: "$salesRep._id",
//         repCode: { $first: "$salesRep.repCode" },
//         repName: { $first: "$salesRep.name" },
//         invoiceCount: { $sum: 1 },
//         customerIds: { $addToSet: "$customer._id" },
//         totalInvoiceValue: { $sum: "$total" },
//         totalPaidValue: { $sum: "$paid" },
//         totalOutstanding: { $sum: "$balance" },
//       },
//     },
//     { $sort: { totalOutstanding: -1, repName: 1 } },
//     {
//       $project: {
//         _id: 1,
//         repCode: 1,
//         repName: { $ifNull: ["$repName", "Unassigned"] },
//         invoiceCount: 1,
//         customerCount: { $size: { $filter: { input: "$customerIds", as: "c", cond: { $ne: ["$$c", null] } } } },
//         totalInvoiceValue: 1,
//         totalPaidValue: 1,
//         totalOutstanding: 1,
//       },
//     },
//   ];

//   // Count total outstanding invoice rows for pagination.
//   const countPipeline = [...basePipeline, { $count: "totalRows" }];

//   const [rows, summaryAgg, byCustomer, bySalesRep, countAgg] = await Promise.all([
//     SalesInvoice.aggregate(rowsPipeline),
//     SalesInvoice.aggregate(summaryPipeline),
//     SalesInvoice.aggregate(byCustomerPipeline),
//     SalesInvoice.aggregate(bySalesRepPipeline),
//     SalesInvoice.aggregate(countPipeline),
//   ]);

//   const totalRows = countAgg[0]?.totalRows || 0;

//   return {
//     summary: summaryAgg[0] || {
//       totalOutstanding: 0,
//       totalInvoiceValue: 0,
//       totalPaidValue: 0,
//       invoiceCount: 0,
//       customerCount: 0,
//       salesRepCount: 0,
//       aging: { "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 },
//     },
//     rows,
//     byCustomer,
//     bySalesRep,
//     pagination: {
//       page: Number(page),
//       limit: Number(limit),
//       totalRows,
//       totalPages: Math.ceil(totalRows / Number(limit || 1)),
//       count: rows.length,
//     },
//   };
// }

// module.exports = {
//   createCustomerPayment,
//   listCustomerPayments,
//   getCustomerPayment,
//   getCustomerOutstanding,
//   updateCustomerCreditStatus,
//   deleteCustomerPayment,
//   previewPaymentAllocation,
//   getPaymentsByInvoice,
//   listOpenInvoicesForCustomer,
//   getReceivablesReport,
// };

// src/services/finance/customerPayment.service.js
const mongoose = require("mongoose");
const CustomerPayment = require("../../models/finance/customerPayment.model");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const Customer = require("../../models/user/customer.model");

// Calculate total outstanding balance for a customer from approved invoices.
async function getCustomerOutstanding(customerId) {
  const result = await SalesInvoice.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(customerId), status: "approved" } },
    {
      $group: {
        _id: "$customer",
        outstanding: { $sum: { $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] } },
      },
    },
  ]);
  return result[0]?.outstanding || 0;
}

// Recompute customer credit status using outstanding, overdue, and limit thresholds.
async function updateCustomerCreditStatus(customerId) {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) return;
  if (customer.creditStatus === "blocked") return;

  const outstanding = await getCustomerOutstanding(customerId);

  if (outstanding > customer.creditLimit) {
    return Customer.findByIdAndUpdate(customerId, { creditStatus: "over-limit" });
  }

  const overdue = await SalesInvoice.exists({
    customer: customerId,
    status: "approved",
    invoiceDate: { $lt: new Date(Date.now() - customer.creditPeriod * 86400000) },
    $expr: { $gt: [{ $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] }, 0] },
  });

  if (overdue) return Customer.findByIdAndUpdate(customerId, { creditStatus: "overdue" });
  if (outstanding > customer.creditLimit * 0.8) return Customer.findByIdAndUpdate(customerId, { creditStatus: "warning" });
  return Customer.findByIdAndUpdate(customerId, { creditStatus: "good" });
}

// Derive invoice payment status from invoice total and paid amount.
function computePaymentStatus(invoice) {
  const goodsValue = Number(invoice.totalBalanceValue || 0);
  const paid = Number(invoice.paidAmount || 0);
  if (paid <= 0) return "unpaid";
  if (paid < goodsValue) return "partially_paid";
  return "paid";
}

// Return approved invoices with positive outstanding balances for customer payment selection.
async function listOpenInvoicesForCustomer(customerId) {
  const invoices = await SalesInvoice.find({
    customer: customerId,
    status: "approved",
    totalBalanceValue: { $gt: 0 },
    $expr: { $gt: [{ $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] }, 0] },
  })
    .sort({ invoiceDate: 1 })
    .select("invoiceNo invoiceDate totalBalanceValue paidAmount")
    .lean();

  return invoices.map((inv) => {
    const total = Number(inv.totalBalanceValue || 0);
    const paid = Number(inv.paidAmount || 0);
    return { _id: inv._id, invoiceNo: inv.invoiceNo, invoiceDate: inv.invoiceDate, totalBalanceValue: total, paidAmount: paid, balance: total - paid };
  });
}

// Preview FIFO-style allocation of a payment amount across open invoices.
async function previewPaymentAllocation({ customerId, amount }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw Object.assign(new Error("Invalid preview amount"), { status: 400 });

  const invoices = await SalesInvoice.find({ customer: customerId, status: "approved", totalBalanceValue: { $gt: 0 } })
    .sort({ invoiceDate: 1 })
    .lean();

  let remaining = numericAmount;
  const allocations = [];

  for (const inv of invoices) {
    if (remaining <= 0) break;
    const goodsValue = Number(inv.totalBalanceValue || 0);
    const paid = Number(inv.paidAmount || 0);
    const outstanding = goodsValue - paid;
    if (outstanding <= 0) continue;

    const allocate = Math.min(outstanding, remaining);
    allocations.push({ invoice: { ...inv, paidAmount: paid, balance: outstanding }, amount: allocate });
    remaining -= allocate;
  }

  return { allocations };
}

// Create a customer payment with mandatory manual allocations and invoice updates in a transaction.
async function createCustomerPayment(payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentNo, customer, paymentDate, amount, method, referenceNo, collectedBy, remarks, allocations: manualAllocations } = payload;

    const customerDoc = await Customer.findById(customer).session(session).lean();
    if (!customerDoc) throw Object.assign(new Error("Customer not found"), { status: 400 });

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw Object.assign(new Error("Invalid payment amount"), { status: 400 });

    // Require explicit manual invoice allocations from the UI.
    if (!Array.isArray(manualAllocations) || manualAllocations.length === 0) {
      throw Object.assign(new Error("Manual allocations are required (select invoice + amount)"), { status: 400 });
    }

    // Normalize and merge duplicate invoice allocations by invoice ID.
    const merged = new Map();
    for (const a of manualAllocations) {
      const invoiceId = a?.invoice;
      const amt = Number(a?.amount);

      if (!invoiceId) throw Object.assign(new Error("Allocation invoice is required"), { status: 400 });
      if (!Number.isFinite(amt) || amt <= 0) throw Object.assign(new Error("Allocation amount must be > 0"), { status: 400 });

      merged.set(String(invoiceId), (merged.get(String(invoiceId)) || 0) + amt);
    }

    const cleaned = Array.from(merged.entries()).map(([invoice, amt]) => ({ invoice, amount: amt }));
    const totalAllocated = cleaned.reduce((s, a) => s + a.amount, 0);

    // Enforce exact allocation total to keep payment tracking consistent.
    if (Math.abs(totalAllocated - numericAmount) > 0.0001) {
      throw Object.assign(new Error("Allocated total must equal payment amount"), { status: 400 });
    }

    // Create the payment in "pending" status
    const [doc] = await CustomerPayment.create(
      [{ paymentNo, customer, paymentDate, amount: numericAmount, method, referenceNo, collectedBy, remarks, allocations: cleaned, status: "waiting_for_approval" }],
      { session }
    );

    // Append allocation history entries to the affected invoices.
    for (const alloc of cleaned) {
      const invoice = await SalesInvoice.findById(alloc.invoice).session(session);
      if (!invoice) continue;

      invoice.paymentAllocations.push({ paymentId: doc._id, amount: alloc.amount, date: paymentDate, method, referenceNo, collectedBy });
      await invoice.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    await updateCustomerCreditStatus(customer);
    await Customer.findByIdAndUpdate(customer, { $addToSet: { payments: doc._id } });

    return { payment: doc.toObject(), unallocated: 0 };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Approve a customer payment by updating invoice paid amounts, credit status, and payment allocation.
async function approveCustomerPayment(paymentId, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await CustomerPayment.findById(paymentId).session(session);
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });

    // Ensure the payment is still in pending status before approval
    if (payment.status !== "waiting_for_approval") throw Object.assign(new Error("Payment is already processed"), { status: 400 });

    const customerDoc = await Customer.findById(payment.customer).session(session).lean();
    if (!customerDoc) throw Object.assign(new Error("Customer not found"), { status: 400 });

    // Check each invoice in the payment allocation
    for (const alloc of payment.allocations) {
      const invoice = await SalesInvoice.findById(alloc.invoice).session(session);
      if (!invoice) throw Object.assign(new Error("Invoice not found for allocation"), { status: 400 });

      // Ensure that the invoice is approved and can receive the payment
      if (invoice.status !== "approved") {
        throw Object.assign(new Error(`Invoice ${invoice.invoiceNo} is not approved`), { status: 400 });
      }

      const goodsValue = Number(invoice.totalBalanceValue || 0);
      const paid = Number(invoice.paidAmount || 0);
      const outstanding = goodsValue - paid;

      // If the invoice is already fully paid, throw an error
      if (outstanding <= 0) {
        throw Object.assign(new Error(`Invoice ${invoice.invoiceNo} is already fully paid`), { status: 400 });
      }

      // Apply the payment to the invoice
      invoice.paidAmount = paid + alloc.amount;
      invoice.paymentStatus = computePaymentStatus(invoice);
      await invoice.save({ session });
    }

    // Update the payment status to approved
    payment.status = "approved";
    payment.approvedBy = userId;
    payment.approvedAt = new Date();
    await payment.save({ session });

    // Update the customer's credit status based on the payment and outstanding balance
    await updateCustomerCreditStatus(payment.customer);

    // Commit the transaction and end the session
    await session.commitTransaction();
    session.endSession();

    return payment.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// List customer payments with optional search and pagination.
async function listCustomerPayments(filter = {}, { page = 1, limit = 50, q }) {
  const where = { ...filter };
  if (q) where.paymentNo = { $regex: q, $options: "i" };

  return CustomerPayment.find(where)
    .populate("customer", "customerCode name creditStatus")
    .populate("collectedBy", "repCode name")
    .populate({
      path: "allocations.invoice",
      select: "invoiceNo invoiceDate paidAmount totalBalanceValue",
    })
    .sort({ paymentDate: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();
}

// Get a single customer payment with invoice allocation and collector details.
async function getCustomerPayment(id) {
  return CustomerPayment.findById(id)
    .populate("customer", "customerCode name creditStatus")
    .populate("collectedBy", "repCode name")
    .populate({
      path: "allocations.invoice",
      select: "invoiceNo invoiceDate paidAmount paymentStatus totalBalanceValue paymentAllocations",
      populate: [{ path: "paymentAllocations.collectedBy", select: "repCode name" }],
    })
    .lean();
}


// Delete a payment and roll back invoice paid amounts and allocation history in a transaction.
async function deleteCustomerPayment(id) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await CustomerPayment.findById(id).session(session);
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });

    if (payment.status === "approved") throw Object.assign(new Error("Cannot delete approved payments"), { status: 400 });

    const customerId = payment.customer;

    for (const alloc of payment.allocations) {
      const invoice = await SalesInvoice.findById(alloc.invoice).session(session);
      if (!invoice) continue;

      invoice.paidAmount = Math.max(0, Number(invoice.paidAmount || 0) - Number(alloc.amount || 0));
      invoice.paymentStatus = computePaymentStatus(invoice);
      invoice.paymentAllocations = invoice.paymentAllocations.filter((p) => String(p.paymentId) !== String(payment._id));
      await invoice.save({ session });
    }

    await CustomerPayment.findByIdAndDelete(id).session(session);
    await session.commitTransaction();
    session.endSession();

    await updateCustomerCreditStatus(customerId);
    await Customer.findByIdAndUpdate(customerId, { $pull: { payments: payment._id } });

    return { success: true };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Build receivables report with paged invoice rows, summaries, and grouped aggregates.
async function getReceivablesReport({
  customerId,
  salesRepId,
  dateFrom,
  dateTo,
  sortBy = "date",
  sortOrder = "asc",
  page = 1,
  limit = 50,
} = {}) {
  const match = { status: "approved", totalBalanceValue: { $gt: 0 } };

  if (customerId) match.customer = new mongoose.Types.ObjectId(customerId);
  if (salesRepId) match.salesRep = new mongoose.Types.ObjectId(salesRepId); // Update field name if your invoice uses a different sales rep key.
  if (dateFrom || dateTo) {
    match.invoiceDate = {};
    if (dateFrom) match.invoiceDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      match.invoiceDate.$lte = to;
    }
  }

  const outstandingExpr = { $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }] };
  const matchOutstandingGtZero = { $expr: { $gt: [outstandingExpr, 0] } };

  const basePipeline = [
    { $match: match },
    { $match: matchOutstandingGtZero },
    { $lookup: { from: "customers", localField: "customer", foreignField: "_id", as: "customer" } },
    { $unwind: "$customer" },
    { $lookup: { from: "salesreps", localField: "salesRep", foreignField: "_id", as: "salesRep" } }, // Update collection if sales reps are stored elsewhere.
    { $unwind: { path: "$salesRep", preserveNullAndEmptyArrays: true } },
    { $addFields: { total: { $ifNull: ["$totalBalanceValue", 0] }, paid: { $ifNull: ["$paidAmount", 0] }, balance: outstandingExpr } },
    { $addFields: { ageDays: { $max: [0, { $dateDiff: { startDate: "$invoiceDate", endDate: "$$NOW", unit: "day" } }] } } }, // Age is based on invoiceDate because dueDate is not available.
    {
      $addFields: {
        agingBucket: {
          $switch: {
            branches: [
              { case: { $lte: ["$ageDays", 30] }, then: "0-30" },
              { case: { $lte: ["$ageDays", 60] }, then: "31-60" },
              { case: { $lte: ["$ageDays", 90] }, then: "61-90" },
            ],
            default: "90+",
          },
        },
      },
    },
  ];

  const rowSortMap = {
    date: { invoiceDate: sortOrder === "desc" ? -1 : 1, _id: 1 },
    customer: { "customer.name": sortOrder === "desc" ? -1 : 1, invoiceDate: 1, _id: 1 },
    salesRep: { "salesRep.name": sortOrder === "desc" ? -1 : 1, invoiceDate: 1, _id: 1 },
    balance: { balance: sortOrder === "desc" ? -1 : 1, invoiceDate: 1, _id: 1 },
  };

  // Generate paged invoice-level receivables rows.
  const rowsPipeline = [
    ...basePipeline,
    {
      $project: {
        _id: 1,
        invoiceNo: 1,
        invoiceDate: 1,
        paymentStatus: 1,
        totalBalanceValue: "$total",
        paidAmount: "$paid",
        balance: 1,
        ageDays: 1,
        agingBucket: 1,
        customer: { _id: "$customer._id", customerCode: "$customer.customerCode", name: "$customer.name" },
        salesRep: { _id: "$salesRep._id", repCode: "$salesRep.repCode", name: "$salesRep.name" },
      },
    },
    { $sort: rowSortMap[sortBy] || rowSortMap.date },
    { $skip: (Number(page) - 1) * Number(limit) },
    { $limit: Number(limit) },
  ];

  // Build overall outstanding summary and aging totals.
  const summaryPipeline = [
    ...basePipeline,
    {
      $group: {
        _id: null,
        totalOutstanding: { $sum: "$balance" },
        totalInvoiceValue: { $sum: "$total" },
        totalPaidValue: { $sum: "$paid" },
        invoiceCount: { $sum: 1 },
        customers: { $addToSet: "$customer._id" },
        salesReps: { $addToSet: "$salesRep._id" },
        age_0_30: { $sum: { $cond: [{ $eq: ["$agingBucket", "0-30"] }, "$balance", 0] } },
        age_31_60: { $sum: { $cond: [{ $eq: ["$agingBucket", "31-60"] }, "$balance", 0] } },
        age_61_90: { $sum: { $cond: [{ $eq: ["$agingBucket", "61-90"] }, "$balance", 0] } },
        age_90_plus: { $sum: { $cond: [{ $eq: ["$agingBucket", "90+"] }, "$balance", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalOutstanding: 1,
        totalInvoiceValue: 1,
        totalPaidValue: 1,
        invoiceCount: 1,
        customerCount: { $size: { $filter: { input: "$customers", as: "c", cond: { $ne: ["$$c", null] } } } },
        salesRepCount: { $size: { $filter: { input: "$salesReps", as: "s", cond: { $ne: ["$$s", null] } } } },
        aging: { "0_30": "$age_0_30", "31_60": "$age_31_60", "61_90": "$age_61_90", "90_plus": "$age_90_plus" },
      },
    },
  ];

  // Aggregate outstanding totals grouped by customer.
  const byCustomerPipeline = [
    ...basePipeline,
    {
      $group: {
        _id: "$customer._id",
        customerCode: { $first: "$customer.customerCode" },
        customerName: { $first: "$customer.name" },
        invoiceCount: { $sum: 1 },
        totalInvoiceValue: { $sum: "$total" },
        totalPaidValue: { $sum: "$paid" },
        totalOutstanding: { $sum: "$balance" },
        oldestInvoiceDate: { $min: "$invoiceDate" },
        maxAgeDays: { $max: "$ageDays" },
      },
    },
    { $sort: { totalOutstanding: -1, customerName: 1 } },
    { $project: { _id: 1, customerCode: 1, customerName: 1, invoiceCount: 1, totalInvoiceValue: 1, totalPaidValue: 1, totalOutstanding: 1, oldestInvoiceDate: 1, maxAgeDays: 1 } },
  ];

  // Aggregate outstanding totals grouped by sales rep, including unassigned invoices.
  const bySalesRepPipeline = [
    ...basePipeline,
    {
      $group: {
        _id: "$salesRep._id",
        repCode: { $first: "$salesRep.repCode" },
        repName: { $first: "$salesRep.name" },
        invoiceCount: { $sum: 1 },
        customerIds: { $addToSet: "$customer._id" },
        totalInvoiceValue: { $sum: "$total" },
        totalPaidValue: { $sum: "$paid" },
        totalOutstanding: { $sum: "$balance" },
      },
    },
    { $sort: { totalOutstanding: -1, repName: 1 } },
    {
      $project: {
        _id: 1,
        repCode: 1,
        repName: { $ifNull: ["$repName", "Unassigned"] },
        invoiceCount: 1,
        customerCount: { $size: { $filter: { input: "$customerIds", as: "c", cond: { $ne: ["$$c", null] } } } },
        totalInvoiceValue: 1,
        totalPaidValue: 1,
        totalOutstanding: 1,
      },
    },
  ];

  // Count total outstanding invoice rows for pagination.
  const countPipeline = [...basePipeline, { $count: "totalRows" }];

  const [rows, summaryAgg, byCustomer, bySalesRep, countAgg] = await Promise.all([
    SalesInvoice.aggregate(rowsPipeline),
    SalesInvoice.aggregate(summaryPipeline),
    SalesInvoice.aggregate(byCustomerPipeline),
    SalesInvoice.aggregate(bySalesRepPipeline),
    SalesInvoice.aggregate(countPipeline),
  ]);

  const totalRows = countAgg[0]?.totalRows || 0;

  return {
    summary: summaryAgg[0] || {
      totalOutstanding: 0,
      totalInvoiceValue: 0,
      totalPaidValue: 0,
      invoiceCount: 0,
      customerCount: 0,
      salesRepCount: 0,
      aging: { "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 },
    },
    rows,
    byCustomer,
    bySalesRep,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      totalRows,
      totalPages: Math.ceil(totalRows / Number(limit || 1)),
      count: rows.length,
    },
  };
}

// Return all payments that allocated amounts to a specific invoice.
async function getPaymentsByInvoice(invoiceId) {
  const payments = await CustomerPayment.find({ "allocations.invoice": invoiceId })
    .populate("customer", "customerCode name creditStatus")
    .populate("collectedBy", "repCode name")
    .lean();

  return payments.map((p) => {
    const alloc = p.allocations.find((a) => String(a.invoice) === String(invoiceId));
    return {
      _id: p._id,
      paymentNo: p.paymentNo,
      paymentDate: p.paymentDate,
      amount: p.amount,
      method: p.method,
      referenceNo: p.referenceNo,
      collectedBy: p.collectedBy,
      customer: p.customer,
      allocationAmount: alloc?.amount || 0,
    };
  });
}

// Update a pending customer payment, including its allocations and payment amount, ensuring the total allocated amount matches the payment amount.
async function updateCustomerPayment(id, payload, scope = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await CustomerPayment.findById(id).session(session);
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });

    // Ensure the payment is still in pending status before updating
    if (payment.status === "approved") throw Object.assign(new Error("Cannot update approved payments"), { status: 400 });

    // If updating allocations, ensure the total allocated amount matches the payment amount
    const { allocations: manualAllocations, amount } = payload;

    if (manualAllocations) {
      const cleaned = new Map();
      for (const alloc of manualAllocations) {
        const invoiceId = alloc?.invoice;
        const amt = Number(alloc?.amount);

        if (!invoiceId) throw Object.assign(new Error("Allocation invoice is required"), { status: 400 });
        if (!Number.isFinite(amt) || amt <= 0) throw Object.assign(new Error("Allocation amount must be > 0"), { status: 400 });

        cleaned.set(String(invoiceId), (cleaned.get(String(invoiceId)) || 0) + amt);
      }

      const totalAllocated = Array.from(cleaned.values()).reduce((s, a) => s + a, 0);

      // Enforce exact allocation total to keep payment tracking consistent.
      if (Math.abs(totalAllocated - amount) > 0.0001) {
        throw Object.assign(new Error("Allocated total must equal payment amount"), { status: 400 });
      }

      payment.allocations = Array.from(cleaned.entries()).map(([invoice, amt]) => ({ invoice, amount: amt }));
    }

    // Update payment amount (if necessary)
    if (amount !== undefined) {
      payment.amount = amount;
    }

    // Update any other fields in the payment document
    Object.assign(payment, payload);

    await payment.save({ session });

    // Commit the transaction and end the session
    await session.commitTransaction();
    session.endSession();

    // Recalculate the customer's credit status
    await updateCustomerCreditStatus(payment.customer);

    return payment.toObject();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Export the functions
module.exports = {
  createCustomerPayment,
  updateCustomerPayment,
  deleteCustomerPayment,
  approveCustomerPayment,
  listCustomerPayments,
  getCustomerPayment,
  getCustomerOutstanding,
  updateCustomerCreditStatus,
  previewPaymentAllocation,
  getPaymentsByInvoice,
  listOpenInvoicesForCustomer,
  getReceivablesReport,
};