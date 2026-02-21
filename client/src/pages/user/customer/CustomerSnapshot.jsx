import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getCustomerSnapshot } from "../../../lib/api/users.api";

import { getSalesInvoice } from "../../../lib/api/sales.api";
import { getPaymentsForInvoice, getCustomerPayment } from "../../../lib/api/finance.api";

import SalesInvoiceViewModal from "../../sales/sales-invoice/SalesInvoiceViewModal";
import PaymentCreateModal from "../../finance/PaymentCreateModal";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

export default function CustomerSnapshot({ customerId }) {
  const id = customerId;

  // ---------------- State ----------------
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ StockDashboard-style filters
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [appliedFilters, setAppliedFilters] = useState({ from: "", to: "" });
  const [periodLabel, setPeriodLabel] = useState("No period selected");

  // ✅ Recent Invoice status filter (match backend values)
  const [invoiceStatus, setInvoiceStatus] = useState("all"); // all | paid | unpaid | partially_paid

  // view modals (same pattern as dashboards)
  const [viewLoading, setViewLoading] = useState(false);

  const [invoiceViewOpen, setInvoiceViewOpen] = useState(false);
  const [invoiceForView, setInvoiceForView] = useState(null);

  const [paymentViewOpen, setPaymentViewOpen] = useState(false);
  const [paymentForView, setPaymentForView] = useState(null);

  // ---------------- Helpers ----------------
  const formatMoney = (v) =>
    v == null
      ? "—"
      : "LKR " +
        Number(v).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const t = new Date();
    return (
      d.getFullYear() === t.getFullYear() &&
      d.getMonth() === t.getMonth() &&
      d.getDate() === t.getDate()
    );
  };

  /** Builds a readable period label like "Nov 1, 2025 – Present" */
  const buildPeriodLabel = (fromStr, toStr) => {
    if (!fromStr && !toStr) return "No period selected";

    try {
      const from = fromStr ? new Date(fromStr) : null;
      const to = toStr ? new Date(toStr) : null;

      const fmt = (d) =>
        d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

      if (from && to) {
        const toLabel = isToday(toStr) ? "Present" : fmt(to);
        return `${fmt(from)} – ${toLabel}`;
      }
      if (from) return `From ${fmt(from)}`;
      if (to) return `Until ${fmt(to)}`;
      return "Custom period";
    } catch {
      return `${fromStr || ""} – ${toStr || ""}`;
    }
  };

  /** Date range filter (inclusive) */
  const isWithinAppliedRange = (dateValue) => {
    const { from, to } = appliedFilters;

    if (!from && !to) return true;

    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return false;

    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    if (from) {
      const f = new Date(from);
      const fDay = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
      if (day < fDay) return false;
    }

    if (to) {
      const t = new Date(to);
      const tDay = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
      if (day > tDay) return false;
    }

    return true;
  };

  // ---------------- Payment status helpers (status-pill) ----------------
  const normalizePaymentStatus = (status) => {
    const s = String(status || "").toLowerCase();

    if (s === "paid") return "paid";
    if (s === "partially_paid" || s === "partial_paid" || s === "partial")
      return "partially_paid";

    return "unpaid";
  };

  const getPaymentStatusLabel = (status) => {
    switch (normalizePaymentStatus(status)) {
      case "paid":
        return "Paid";
      case "partially_paid":
        return "Partially Paid";
      case "unpaid":
      default:
        return "Unpaid";
    }
  };

  const getPaymentStatusClass = (status) => {
    switch (normalizePaymentStatus(status)) {
      case "paid":
        return "status-approved"; // green
      case "partially_paid":
        return "status-pending"; // amber
      case "unpaid":
      default:
        return "status-cancelled"; // red/grey
    }
  };

  // ---------------- Load ----------------
  useEffect(() => {
    if (!id) return;

    // ✅ Initial load → current month (like StockDashboard)
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);

    const fromStr = first.toISOString().slice(0, 10);
    const toStr = today.toISOString().slice(0, 10);

    setFilters({ from: fromStr, to: toStr });
    setAppliedFilters({ from: fromStr, to: toStr });
    setPeriodLabel(buildPeriodLabel(fromStr, toStr));

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const res = await getCustomerSnapshot(id);
      setData(res);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customer snapshot.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- Filter handlers ----------------
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    if (!filters.from && !filters.to) {
      toast.warn("Please select at least a From or To date.");
      return;
    }

    setAppliedFilters({ from: filters.from, to: filters.to });
    setPeriodLabel(buildPeriodLabel(filters.from, filters.to));
  };

  const handlePreset = (preset) => {
    const now = new Date();

    if (preset === "thisMonth") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const f = first.toISOString().slice(0, 10);
      const t = now.toISOString().slice(0, 10);

      setFilters({ from: f, to: t });
      setAppliedFilters({ from: f, to: t });
      setPeriodLabel(buildPeriodLabel(f, t));
      return;
    }

    if (preset === "last30") {
      const past = new Date();
      past.setDate(past.getDate() - 29);

      const f = past.toISOString().slice(0, 10);
      const t = now.toISOString().slice(0, 10);

      setFilters({ from: f, to: t });
      setAppliedFilters({ from: f, to: t });
      setPeriodLabel(buildPeriodLabel(f, t));
    }
  };

  // ---------------- Safe extraction ----------------
  const customer = data?.customer || {};
  const sales = data?.sales || {};
  const credit = data?.credit || {};
  const payments = data?.payments || {};
  const aging = data?.aging || {};
  const recentInvoices = Array.isArray(data?.recentInvoices) ? data.recentInvoices : [];
  const recentPayments = Array.isArray(data?.recentPayments) ? data.recentPayments : [];
  const trend = data?.trend || { sales: [], payments: [] };

  // ---------------- Derived ----------------
  const filteredInvoices = useMemo(() => {
    return recentInvoices
      .filter((i) => isWithinAppliedRange(i.invoiceDate))
      .filter((i) => {
        if (invoiceStatus === "all") return true;
        return normalizePaymentStatus(i.paymentStatus) === invoiceStatus;
      });
  }, [recentInvoices, appliedFilters.from, appliedFilters.to, invoiceStatus]);

  const filteredPayments = useMemo(() => {
    return recentPayments.filter((p) => isWithinAppliedRange(p.paymentDate));
  }, [recentPayments, appliedFilters.from, appliedFilters.to]);

  const filteredTrend = useMemo(() => {
    const merged = mergeTrends(trend.sales, trend.payments);

    return merged.filter((r) => {
      const monthDate = new Date(r.year, r.month - 1, 1);
      return isWithinAppliedRange(monthDate);
    });
  }, [trend.sales, trend.payments, appliedFilters.from, appliedFilters.to]);

  // ---------------- Actions (View buttons) ----------------
  const handleViewInvoice = async (inv) => {
    if (!inv?._id) return;

    try {
      setViewLoading(true);

      const full = await getSalesInvoice(inv._id);
      const paymentsRes = await getPaymentsForInvoice(inv._id);

      full.paymentAllocations = Array.isArray(paymentsRes?.payments) ? paymentsRes.payments : [];

      setInvoiceForView(full);
      setInvoiceViewOpen(true);
    } catch (err) {
      console.error("❌ Failed to load invoice:", err);
      toast.error("Failed to load invoice details.");
    } finally {
      setViewLoading(false);
    }
  };

  const handleViewPayment = async (p) => {
    if (!p?._id) return;

    try {
      setViewLoading(true);

      const full = await getCustomerPayment(p._id);

      setPaymentForView(full);
      setPaymentViewOpen(true);
    } catch (err) {
      console.error("❌ Failed to load payment:", err);
      toast.error("Failed to load payment details.");
    } finally {
      setViewLoading(false);
    }
  };

  const openPaymentViewerFromInvoice = async (paymentObj) => {
    if (!paymentObj) return;

    try {
      setViewLoading(true);

      const full = paymentObj._id ? await getCustomerPayment(paymentObj._id) : paymentObj;

      setPaymentForView(full);
      setPaymentViewOpen(true);
    } catch (err) {
      console.error("❌ Failed to open payment:", err);
      toast.error("Failed to load payment.");
    } finally {
      setViewLoading(false);
    }
  };

  const closePaymentViewer = () => {
    setPaymentForView(null);
    setPaymentViewOpen(false);
  };

  // ---------------- Render ----------------
  if (loading) {
    return (
      <div className="container-fluid py-4 px-5">
        <div className="text-muted">Loading customer snapshot...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container-fluid py-4 px-5">
        <div className="text-danger">Failed to load customer snapshot.</div>
        <ToastContainer position="top-right" autoClose={2500} />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-5">
      {/* --------------------------------------------------
        HEADER + FILTER BAR (StockDashboard style)
      -------------------------------------------------- */}
      <div className="d-flex justify-content-between align-items-end flex-wrap mb-3">
        <div>
          <h2 className="page-title">{customer.name}</h2>
          <p className="page-subtitle">
            {customer.owner} | {customer.contactNumber || "—"}
          </p>
        </div>

        {/* Filters */}
        <div className="ms-auto">
          <div className="row filter-bar justify-content-end">
            <div className="col-auto filter-group">
              <span className="filter-label">Date Range</span>

              <input
                type="date"
                name="from"
                className="filter-date"
                value={filters.from}
                onChange={handleFilterChange}
              />

              <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>to</span>

              <input
                type="date"
                name="to"
                className="filter-date"
                value={filters.to}
                onChange={handleFilterChange}
              />

              <button
                className="filter-apply-btn"
                onClick={handleApplyFilters}
                disabled={loading || viewLoading}
                type="button"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Loading...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat me-1" />
                    Apply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        SUMMARY CARDS
      -------------------------------------------------- */}
      <div className="summary-grid mb-2">
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Lifetime Sales</span>
            <i className="bi bi-receipt summary-icon" />
          </div>
          <div className="summary-value">{formatMoney(sales.netGoodsValue)}</div>
          <div className="summary-sub">Net goods value</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Paid / Outstanding</span>
            <i className="bi bi-cash-stack summary-icon" />
          </div>
          <div className="summary-value">{formatMoney(sales.totalPaid)}</div>
          <div className="summary-sub">Outstanding: {formatMoney(payments.outstanding)}</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Credit Usage</span>
            <i className="bi bi-shield-lock summary-icon" />
          </div>
          <div className="summary-value">{formatMoney(credit.creditUsed)}</div>
          <div className="summary-sub">
            Limit: {credit.creditLimit ? formatMoney(credit.creditLimit) : "—"}
          </div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Credit Status</span>
            <i
              className={`bi ${
                credit.status === "blocked" ? "bi-lock-fill" : "bi-unlock-fill"
              } summary-icon`}
            />
          </div>
          <div className="summary-value">{String(credit.status || "—").toUpperCase()}</div>
          <div className="summary-sub">Manual / auto</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>
      </div>

      {/* ---------------- Tables Layout ---------------- */}
      <div className="row g-2 mt-2">
        {/* LEFT: Receivable Aging + Recent Invoices */}
        <div className="col-lg-6">
          {/* Receivable Aging */}
          <div className="table-container">
            <div className="table-block">
              <div className="section-title mb-2">Receivable Aging</div>

              <div className="table-responsive">
                <table className="modern-table">
                  <tbody>
                    <AgingRow label="0–30 Days" value={aging["0_30"]} />
                    <AgingRow label="31–60 Days" value={aging["31_60"]} />
                    <AgingRow label="61–90 Days" value={aging["61_90"]} />
                    <AgingRow label="90+ Days" value={aging["90_plus"]} />
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="table-container mt-2">
            <div className="table-block">
              {/* title + status filter */}
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="section-title mb-0">Recent Invoices</div>

                <select
                  className="custom-select"
                  style={{ width: 180 }}
                  value={invoiceStatus}
                  onChange={(e) => setInvoiceStatus(e.target.value)}
                  disabled={loading || viewLoading}
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partially_paid">Partially Paid</option>
                </select>
              </div>

              <div className="table-responsive" style={{ maxHeight: "360px", overflowY: "auto" }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Date</th>
                      <th className="text-end">Total</th>
                      <th className="text-end">Paid</th>
                      <th>Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-3">
                          No invoices found.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((i) => (
                        <tr key={i._id}>
                          <td>{i.invoiceNo}</td>
                          <td>{new Date(i.invoiceDate).toLocaleDateString()}</td>
                          <td className="text-end">{formatMoney(i.totalBalanceValue)}</td>
                          <td className="text-end">{formatMoney(i.paidAmount || 0)}</td>
                          <td>
                            <span className={`status-pill ${getPaymentStatusClass(i.paymentStatus)}`}>
                              {getPaymentStatusLabel(i.paymentStatus)}
                            </span>
                          </td>
                          <td className="text-center">
                            <button
                              className="icon-btn"
                              title="View invoice"
                              onClick={() => handleViewInvoice(i)}
                              disabled={viewLoading}
                              type="button"
                            >
                              <i className="bi bi-eye" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Monthly Activity + Recent Payments */}
        <div className="col-lg-6">
          {/* Monthly Activity */}
          <div className="table-container">
            <div className="table-block">
              <div className="section-title mb-2">Monthly Activity</div>

              <div className="table-responsive" style={{ maxHeight: "360px", overflowY: "auto" }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-end">Sales</th>
                      <th className="text-end">Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrend.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-3">
                          No monthly activity in this range.
                        </td>
                      </tr>
                    ) : (
                      filteredTrend.map((r) => (
                        <tr key={`${r.year}-${r.month}`}>
                          <td>
                            {String(r.month).padStart(2, "0")}/{r.year}
                          </td>
                          <td className="text-end">{formatMoney(r.sales)}</td>
                          <td className="text-end">{formatMoney(r.payments)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="table-container mt-2">
            <div className="table-block">
              <div className="section-title mb-2">Recent Payments</div>

              <div className="table-responsive" style={{ maxHeight: "360px", overflowY: "auto" }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th className="text-end">Amount</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3">
                          No payments found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((p) => (
                        <tr key={p._id}>
                          <td>{p.paymentNo}</td>
                          <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                          <td>{p.method}</td>
                          <td className="text-end">{formatMoney(p.amount)}</td>
                          <td className="text-center">
                            <button
                              className="icon-btn"
                              title="View payment"
                              onClick={() => handleViewPayment(p)}
                              disabled={viewLoading}
                              type="button"
                            >
                              <i className="bi bi-eye" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Modals ---------------- */}
      {invoiceViewOpen && (
        <SalesInvoiceViewModal
          show={invoiceViewOpen}
          invoice={invoiceForView}
          onClose={() => setInvoiceViewOpen(false)}
          onOpenPayment={openPaymentViewerFromInvoice}
        />
      )}

      {paymentViewOpen && (
        <PaymentCreateModal
          show={paymentViewOpen}
          mode="view"
          payment={paymentForView}
          onClose={closePaymentViewer}
        />
      )}

      <ToastContainer position="top-right" autoClose={2500} />
    </div>
  );
}

/* ---------------- Components ---------------- */

function AgingRow({ label, value }) {
  const formatMoney = (v) =>
    v == null
      ? "—"
      : "LKR " +
        Number(v).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return (
    <tr>
      <td>{label}</td>
      <td className="text-end">{formatMoney(value)}</td>
    </tr>
  );
}

function mergeTrends(sales = [], payments = []) {
  const map = {};

  (sales || []).forEach((s) => {
    const k = `${s._id.year}-${s._id.month}`;
    map[k] = {
      year: s._id.year,
      month: s._id.month,
      sales: s.value,
      payments: 0,
    };
  });

  (payments || []).forEach((p) => {
    const k = `${p._id.year}-${p._id.month}`;
    map[k] =
      map[k] || {
        year: p._id.year,
        month: p._id.month,
        sales: 0,
        payments: 0,
      };
    map[k].payments = p.value;
  });

  return Object.values(map).sort((a, b) =>
    a.year === b.year ? a.month - b.month : a.year - b.year
  );
}
