// src/services/finance/customerPayment.service.js
const mongoose = require("mongoose");
const CustomerPayment = require("../../models/finance/customerPayment.model");
const SalesInvoice = require("../../models/sale/SalesInvoice.model");
const Customer = require("../../models/user/customer.model");

/* ------------------------------------------------------------
   OUTSTANDING = totalBalanceValue - paidAmount
------------------------------------------------------------- */
async function getCustomerOutstanding(customerId) {
  const result = await SalesInvoice.aggregate([
    {
      $match: {
        customer: new mongoose.Types.ObjectId(customerId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$customer",
        outstanding: {
          $sum: {
            $subtract: [
              "$totalBalanceValue",
              { $ifNull: ["$paidAmount", 0] },
            ],
          },
        },
      },
    },
  ]);

  return result[0]?.outstanding || 0;
}

/* ------------------------------------------------------------
   CREDIT STATUS CALCULATOR
------------------------------------------------------------- */
async function updateCustomerCreditStatus(customerId) {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) return;

  if (customer.creditStatus === "blocked") return;

  const outstanding = await getCustomerOutstanding(customerId);

  if (outstanding > customer.creditLimit) {
    return Customer.findByIdAndUpdate(customerId, {
      creditStatus: "over-limit",
    });
  }

  const overdue = await SalesInvoice.exists({
    customer: customerId,
    status: "approved",
    invoiceDate: {
      $lt: new Date(Date.now() - customer.creditPeriod * 86400000),
    },
    $expr: {
      $gt: [
        {
          $subtract: [
            "$totalBalanceValue",
            { $ifNull: ["$paidAmount", 0] },
          ],
        },
        0,
      ],
    },
  });

  if (overdue) {
    return Customer.findByIdAndUpdate(customerId, {
      creditStatus: "overdue",
    });
  }

  if (outstanding > customer.creditLimit * 0.8) {
    return Customer.findByIdAndUpdate(customerId, {
      creditStatus: "warning",
    });
  }

  return Customer.findByIdAndUpdate(customerId, { creditStatus: "good" });
}

/* ------------------------------------------------------------
   PAYMENT STATUS HELPER
------------------------------------------------------------- */
function computePaymentStatus(invoice) {
  const goodsValue = Number(invoice.totalBalanceValue || 0);
  const paid = Number(invoice.paidAmount || 0);

  if (paid <= 0) return "unpaid";
  if (paid < goodsValue) return "partially_paid";
  return "paid";
}

/* ------------------------------------------------------------
   LIST OPEN (OUTSTANDING) INVOICES FOR CUSTOMER (for UI select)
------------------------------------------------------------- */
async function listOpenInvoicesForCustomer(customerId) {
  const invoices = await SalesInvoice.find({
    customer: customerId,
    status: "approved",
    totalBalanceValue: { $gt: 0 },
    $expr: {
      $gt: [
        {
          $subtract: ["$totalBalanceValue", { $ifNull: ["$paidAmount", 0] }],
        },
        0,
      ],
    },
  })
    .sort({ invoiceDate: 1 })
    .select("invoiceNo invoiceDate totalBalanceValue paidAmount")
    .lean();

  return invoices.map((inv) => {
    const total = Number(inv.totalBalanceValue || 0);
    const paid = Number(inv.paidAmount || 0);
    return {
      _id: inv._id,
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.invoiceDate,
      totalBalanceValue: total,
      paidAmount: paid,
      balance: total - paid,
    };
  });
}

/* ------------------------------------------------------------
   PREVIEW ALLOCATION (still ok to keep; optional for UI)
------------------------------------------------------------- */
async function previewPaymentAllocation({ customerId, amount }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0)
    throw Object.assign(new Error("Invalid preview amount"), {
      status: 400,
    });

  const invoices = await SalesInvoice.find({
    customer: customerId,
    status: "approved",
    totalBalanceValue: { $gt: 0 },
  })
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

    allocations.push({
      invoice: {
        ...inv,
        paidAmount: paid,
        balance: outstanding,
      },
      amount: allocate,
    });

    remaining -= allocate;
  }

  return { allocations };
}

/* ------------------------------------------------------------
   CREATE PAYMENT (MANUAL ONLY)
   - UI must send allocations: [{ invoice, amount }]
   - Total allocated MUST equal payment amount
------------------------------------------------------------- */
async function createCustomerPayment(payload) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      paymentNo,
      customer,
      paymentDate,
      amount,
      method,
      referenceNo,
      collectedBy,
      remarks,
      allocations: manualAllocations,
    } = payload;

    const customerDoc = await Customer.findById(customer)
      .session(session)
      .lean();
    if (!customerDoc)
      throw Object.assign(new Error("Customer not found"), { status: 400 });

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0)
      throw Object.assign(new Error("Invalid payment amount"), { status: 400 });

    // ✅ MANUAL REQUIRED
    if (!Array.isArray(manualAllocations) || manualAllocations.length === 0) {
      throw Object.assign(
        new Error("Manual allocations are required (select invoice + amount)"),
        { status: 400 }
      );
    }

    // normalize + merge duplicates (same invoice selected multiple times)
    const merged = new Map(); // invoiceId -> amount
    for (const a of manualAllocations) {
      const invoiceId = a?.invoice;
      const amt = Number(a?.amount);

      if (!invoiceId)
        throw Object.assign(new Error("Allocation invoice is required"), {
          status: 400,
        });
      if (!Number.isFinite(amt) || amt <= 0)
        throw Object.assign(new Error("Allocation amount must be > 0"), {
          status: 400,
        });

      merged.set(String(invoiceId), (merged.get(String(invoiceId)) || 0) + amt);
    }

    const cleaned = Array.from(merged.entries()).map(([invoice, amt]) => ({
      invoice,
      amount: amt,
    }));

    const totalAllocated = cleaned.reduce((s, a) => s + a.amount, 0);

    // IMPORTANT: keep strict equality (prevents "money left untracked")
    if (Math.abs(totalAllocated - numericAmount) > 0.0001) {
      throw Object.assign(
        new Error("Allocated total must equal payment amount"),
        { status: 400 }
      );
    }

    // validate + apply allocations
    for (const alloc of cleaned) {
      const invoice = await SalesInvoice.findById(alloc.invoice).session(
        session
      );

      if (!invoice) {
        throw Object.assign(new Error("Invoice not found for allocation"), {
          status: 400,
        });
      }

      // ensure same customer + approved
      if (String(invoice.customer) !== String(customer)) {
        throw Object.assign(new Error("Invoice does not belong to customer"), {
          status: 400,
        });
      }
      if (invoice.status !== "approved") {
        throw Object.assign(
          new Error(`Invoice not approved (${invoice.invoiceNo})`),
          { status: 400 }
        );
      }

      const goodsValue = Number(invoice.totalBalanceValue || 0);
      const paid = Number(invoice.paidAmount || 0);
      const outstanding = goodsValue - paid;

      if (outstanding <= 0) {
        throw Object.assign(
          new Error(`Invoice already fully paid (${invoice.invoiceNo})`),
          { status: 400 }
        );
      }

      if (alloc.amount > outstanding + 0.0001) {
        throw Object.assign(
          new Error(`Allocation exceeds invoice balance (${invoice.invoiceNo})`),
          { status: 400 }
        );
      }

      invoice.paidAmount = paid + alloc.amount;
      invoice.paymentStatus = computePaymentStatus(invoice);
      await invoice.save({ session });
    }

    // save payment
    const [doc] = await CustomerPayment.create(
      [
        {
          paymentNo,
          customer,
          paymentDate,
          amount: numericAmount,
          method,
          referenceNo,
          collectedBy,
          remarks,
          allocations: cleaned,
        },
      ],
      { session }
    );

    // add to invoice history
    for (const alloc of cleaned) {
      const invoice = await SalesInvoice.findById(alloc.invoice).session(
        session
      );
      if (!invoice) continue;

      invoice.paymentAllocations.push({
        paymentId: doc._id,
        amount: alloc.amount,
        date: paymentDate,
        method,
        referenceNo,
        collectedBy,
      });

      await invoice.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    await updateCustomerCreditStatus(customer);
    await Customer.findByIdAndUpdate(customer, {
      $addToSet: { payments: doc._id },
    });

    return {
      payment: doc.toObject(),
      unallocated: 0,
    };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

/* ------------------------------------------------------------
   LIST PAYMENTS
------------------------------------------------------------- */
async function listCustomerPayments(filter = {}, { page = 1, limit = 50, q }) {
  const where = { ...filter };
  if (q) where.paymentNo = { $regex: q, $options: "i" };

  return CustomerPayment.find(where)
    .populate("customer", "customerCode name creditStatus")
    .populate("collectedBy", "repCode name")
    .sort({ paymentDate: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();
}

/* ------------------------------------------------------------
   GET SINGLE PAYMENT
------------------------------------------------------------- */
async function getCustomerPayment(id) {
  return CustomerPayment.findById(id)
    .populate("customer", "customerCode name creditStatus")
    .populate("collectedBy", "repCode name")
    .populate({
      path: "allocations.invoice",
      select:
        "invoiceNo invoiceDate paidAmount paymentStatus totalBalanceValue paymentAllocations",
      populate: [
        {
          path: "paymentAllocations.collectedBy",
          select: "repCode name",
        },
      ],
    })
    .lean();
}

/* ------------------------------------------------------------
   DELETE PAYMENT
------------------------------------------------------------- */
async function deleteCustomerPayment(id) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await CustomerPayment.findById(id).session(session);
    if (!payment)
      throw Object.assign(new Error("Payment not found"), { status: 404 });

    const customerId = payment.customer;

    for (const alloc of payment.allocations) {
      const invoice = await SalesInvoice.findById(alloc.invoice).session(
        session
      );
      if (!invoice) continue;

      invoice.paidAmount = Math.max(
        0,
        Number(invoice.paidAmount || 0) - Number(alloc.amount || 0)
      );

      invoice.paymentStatus = computePaymentStatus(invoice);

      invoice.paymentAllocations = invoice.paymentAllocations.filter(
        (p) => String(p.paymentId) !== String(payment._id)
      );

      await invoice.save({ session });
    }

    await CustomerPayment.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    await updateCustomerCreditStatus(customerId);
    await Customer.findByIdAndUpdate(customerId, {
      $pull: { payments: payment._id },
    });

    return { success: true };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

/* ------------------------------------------------------------
   GET PAYMENTS FOR A SPECIFIC INVOICE
------------------------------------------------------------- */
async function getPaymentsByInvoice(invoiceId) {
  const payments = await CustomerPayment.find({
    "allocations.invoice": invoiceId,
  })
    .populate("customer", "customerCode name creditStatus")
    .populate("collectedBy", "repCode name")
    .lean();

  return payments.map((p) => {
    const alloc = p.allocations.find(
      (a) => String(a.invoice) === String(invoiceId)
    );
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

module.exports = {
  createCustomerPayment,
  listCustomerPayments,
  getCustomerPayment,
  getCustomerOutstanding,
  updateCustomerCreditStatus,
  deleteCustomerPayment,
  previewPaymentAllocation,
  getPaymentsByInvoice,
  listOpenInvoicesForCustomer, // ✅ new
};
