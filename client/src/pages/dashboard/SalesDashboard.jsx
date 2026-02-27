// src/pages/reports/SalesDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getSalesSnapshot } from "../../lib/api/ledger.api";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const SalesDashboard = () => {
  // --------------------------------------------------
  // Local state
  // --------------------------------------------------
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState({
    generatedAt: null,

    totalNetRevenue: 0,
    totalGrossRevenue: 0,
    totalNetReturns: 0,

    totalNetItems: {
      itemsCount: 0,
      qty: {
        primaryQty: 0,
        baseQty: 0,
      },
    },

    customerCount: 0,
    branchCount: 0,

    invoices: {
      invoiceCount: 0,
      status: {
        approved: 0,
        waiting_for_approval: 0,
        cancelled: 0,
      },
    },
  });

  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [filters, setFilters] = useState({ from: "", to: "" });
  const [periodLabel, setPeriodLabel] = useState("");

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const formatMoney = (val) =>
    val == null
      ? "—"
      : "LKR " +
        Number(val).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const formatNumber = (val) =>
    Number(val || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });

  const formatPercent = (val) =>
    `${Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;

  const formattedGeneratedAt = useMemo(() => {
    if (!summary.generatedAt) return "-";
    try {
      const d = new Date(summary.generatedAt);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch {
      return summary.generatedAt;
    }
  }, [summary.generatedAt]);

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
        return `${fmt(from)} – ${isToday(toStr) ? "Present" : fmt(to)}`;
      }

      if (from && !to) return `From ${fmt(from)}`;
      if (!from && to) return `Until ${fmt(to)}`;
      return "Custom period";
    } catch {
      return `${fromStr || ""} – ${toStr || ""}`;
    }
  };

  // --------------------------------------------------
  // Derived Insights
  // --------------------------------------------------
  const topItems = useMemo(() => {
    return [...(items || [])]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 3);
  }, [items]);

  const topCustomers = useMemo(() => {
    return [...(customers || [])]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 3);
  }, [customers]);

  const totalItemRevenue = useMemo(
    () => items.reduce((acc, it) => acc + (it.totalRevenue || 0), 0),
    [items]
  );

  const totalCustomerRevenue = useMemo(
    () => customers.reduce((acc, c) => acc + (c.totalRevenue || 0), 0),
    [customers]
  );

  const returnRate = useMemo(() => {
    if (!summary.totalGrossRevenue) return 0;
    return (
      (Math.abs(summary.totalNetReturns || 0) / (summary.totalGrossRevenue || 1)) *
      100
    );
  }, [summary.totalNetReturns, summary.totalGrossRevenue]);

  // --------------------------------------------------
  // Loader
  // --------------------------------------------------
  const loadSnapshot = async (from, to) => {
    try {
      setLoading(true);

      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const data = await getSalesSnapshot(params);

      // New API shape support
      const generatedAt = data?.generatedAt || null;
      const totalNetRevenue = data?.totalNetRevenue || 0;
      const totalGrossRevenue = data?.totalGrossRevenue || 0;
      const totalNetReturns = data?.totalNetReturns || 0;
      const customerCount = data?.customerCount || 0;
      const branchCount = data?.branchCount || 0;

      const totalNetItems = {
        itemsCount: data?.totalNetItems?.itemsCount || 0,
        qty: {
          primaryQty: data?.totalNetItems?.qty?.primaryQty || 0,
          baseQty: data?.totalNetItems?.qty?.baseQty || 0,
        },
      };

      const invoices = {
        invoiceCount: data?.invoices?.invoiceCount || 0,
        status: {
          approved: data?.invoices?.status?.approved || 0,
          waiting_for_approval: data?.invoices?.status?.waiting_for_approval || 0,
          cancelled: data?.invoices?.status?.cancelled || 0,
        },
      };

      setSummary({
        generatedAt,
        totalNetRevenue,
        totalGrossRevenue,
        totalNetReturns,
        totalNetItems,
        customerCount,
        branchCount,
        invoices,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      setPeriodLabel(buildPeriodLabel(from, to));
    } catch (err) {
      console.error("❌ Error loading sales snapshot:", err);
      toast.error(
        err?.response?.data?.message || "Failed to load sales snapshot."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Init – load current month
  // --------------------------------------------------
  useEffect(() => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);

    const from = first.toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);

    setFilters({ from, to });
    loadSnapshot(from, to);
  }, []);

  // --------------------------------------------------
  // Filter handlers
  // --------------------------------------------------
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    if (!filters.from && !filters.to) {
      toast.warn("Please select at least a From or To date.");
      return;
    }
    loadSnapshot(filters.from, filters.to);
  };

  const handlePreset = (preset) => {
    const now = new Date();

    if (preset === "thisMonth") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const from = first.toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      setFilters({ from, to });
      loadSnapshot(from, to);
      return;
    }

    if (preset === "last30") {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      const from = past.toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      setFilters({ from, to });
      loadSnapshot(from, to);
    }
  };

  // --------------------------------------------------
  // Summary extraction
  // --------------------------------------------------
  const {
    totalNetRevenue,
    totalGrossRevenue,
    totalNetReturns,
    totalNetItems,
    customerCount,
    branchCount,
    invoices,
  } = summary;

  const totalNetItemsCount = totalNetItems?.itemsCount || 0;
  const totalNetQtyPrimary = totalNetItems?.qty?.primaryQty || 0;
  const totalNetQtyBase = totalNetItems?.qty?.baseQty || 0;

  const invoiceCount = invoices?.invoiceCount || 0;

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5">
      {/* --------------------------------------------------
        Header + Filters
      -------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "2rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        {/* Header */}
        <div className="pb-2" style={{ flex: 1 }}>
          <h2 className="page-title">Sales Snapshot</h2>
          <p className="page-subtitle">
            Overview of sales, returns, customers, and item performance.
          </p>

          <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
            Generated at: {formattedGeneratedAt}
            <span style={{ marginLeft: "0.5rem" }}>
              • Period: {periodLabel || "—"}
            </span>
          </small>
        </div>

        {/* Filters */}
        <div
          className="filter-bar"
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Date range */}
          <div className="filter-group" style={{ marginRight: "1rem" }}>
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
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm"></span>
                  <span> Loading...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat" /> Apply
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="filter-group">
            <span className="filter-label">Quick</span>

            <button
              className="filter-chip"
              onClick={() => handlePreset("thisMonth")}
            >
              This Month
            </button>

            <button
              className="filter-chip"
              onClick={() => handlePreset("last30")}
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        Summary Cards
      -------------------------------------------------- */}
      <div className="summary-grid">
        {/* Net Sales */}
        <div className="summary-card orange">
          <div className="summary-header">
            <span className="summary-label orange">Net Sales</span>
            <i className="bi bi-cash-stack summary-icon orange" />
          </div>

          <div className="summary-value">{formatMoney(totalNetRevenue)}</div>
          <div className="summary-sub">Revenue after returns impact.</div>
          <div className="summary-period">Period: {periodLabel || "—"}</div>
        </div>

        {/* Gross Sales + Return Impact (Combined) */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Gross Sales & Returns</span>
            <i className="bi bi-arrow-left-right summary-icon" />
          </div>

          <div className="summary-value">
            {formatMoney(totalGrossRevenue)}
          </div>

          <div className="summary-sub"> 
            Return impact: {formatMoney(totalNetReturns)}
          </div>

          <div className="summary-sub">
            Gross revenue with return deduction summary.
          </div>
          <div className="summary-period">
            Return rate: {formatPercent(returnRate)}
          </div>
        </div>

        {/* Net Items Sold */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Net Items Sold</span>
            <i className="bi bi-box-seam summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(totalNetItemsCount)} Items
          </div>

          <div className="summary-sub">
            {formatNumber(totalNetQtyPrimary)} Primary •{" "}
              {formatNumber(totalNetQtyBase)} Base
          </div>

          <div className="summary-sub">
            Net item count and quantities sold for the selected period.
          </div>
          <div className="summary-period">Period: {periodLabel || "—"}</div>
        </div>

        {/* Invoice + Customer Stats */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Activity</span>
            <i className="bi bi-receipt summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(invoiceCount)}{" "}
            <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              invoices
            </span>
          </div>

          <div className="summary-sub">
            {formatNumber(customerCount)} customers • {formatNumber(branchCount)}{" "}
            branches
          </div>

          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.78rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              color: "#4b5563",
            }}
          >
            <div>
              Approved:
              <span className="badge-pill blue">
                {formatNumber(invoices?.status?.approved || 0)}
              </span>
            </div>

            <div>
              Waiting:
              <span className="badge-pill yellow">
                {formatNumber(invoices?.status?.waiting_for_approval || 0)}
              </span>
            </div>

            <div>
              Cancelled:
              <span className="badge-pill red">
                {formatNumber(invoices?.status?.cancelled || 0)}
              </span>
            </div>
          </div>

          <div className="summary-period">Period: {periodLabel || "—"}</div>
        </div>
      </div>

      {/* --------------------------------------------------
        Sales Insights
      -------------------------------------------------- */}
      <div className="row g-2 mb-2">
        <div className="col-12">
          <div className="section-card">
            <div className="section-title">Sales Insights</div>
            <div className="section-subtitle">
              Top performers and period-level highlights.
            </div>

            <ul className="insights-list">
              <li>
                <strong>Top 3 Items:</strong>{" "}
                {topItems.length ? (
                  topItems.map((it, idx) => (
                    <span key={`${it.itemId}_${it.branchId}_${idx}`} style={{ marginRight: 8 }}>
                      <span className="badge-pill">
                        {idx + 1}. {it.itemName || "Unknown"} —{" "}
                        {formatMoney(it.totalRevenue)}
                      </span>
                    </span>
                  ))
                ) : (
                  "No item data."
                )}
              </li>

              <li>
                <strong>Top 3 Customers:</strong>{" "}
                {topCustomers.length ? (
                  topCustomers.map((c, idx) => (
                    <span key={`${c.customerId || "none"}_${idx}`} style={{ marginRight: 8 }}>
                      <span className="badge-pill">
                        {idx + 1}. {c.customerName || "Unknown"} —{" "}
                        {formatMoney(c.totalRevenue)}
                      </span>
                    </span>
                  ))
                ) : (
                  "No customer data."
                )}
              </li>

              <li>
                Items in period: <strong>{items.length}</strong>
                <span className="badge-pill orange">
                  Total item sales {formatMoney(totalItemRevenue)}
                </span>
              </li>

              <li>
                Customers in period: <strong>{customerCount}</strong>
                <span className="badge-pill orange">
                  Total customer sales {formatMoney(totalCustomerRevenue)}
                </span>
              </li>

              <li>
                Net returns:
                <span className="badge-pill red">
                  {formatMoney(totalNetReturns)}
                </span>
                <span className="badge-pill" style={{ marginLeft: 6 }}>
                  {formatPercent(returnRate)} of gross
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        Item + Customer Tables
      -------------------------------------------------- */}
      <div className="row g-2">
        {/* Item Table */}
        <div className="col-lg-7">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Item Sales</div>
                  <div className="section-subtitle">
                    {items.length} item{items.length === 1 ? "" : "s"} in result.
                  </div>
                </div>
              </div>

              <div
                className="table-responsive"
                style={{ maxHeight: "360px", overflowY: "auto" }}
              >
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Branch</th>
                      <th className="text-end">Qty Sold</th>
                      <th className="text-end">Revenue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          {loading
                            ? "Loading item sales..."
                            : "No item data for this period."}
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={`${it.itemId}_${it.branchId}`}>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {it.itemName || "Unknown"}
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                              }}
                            >
                              {it.itemCode || ""}
                            </div>
                          </td>

                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {it.branchName || "Unknown"}
                            </div>
                          </td>

                          <td className="text-end">
                            <div>{it.qtyDisplay || "—"}</div>
                            {typeof it.qtySoldBaseEq === "number" && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "#9ca3af",
                                }}
                              >
                                {it.qtySoldBaseEq.toLocaleString()} base units
                              </div>
                            )}
                          </td>

                          <td className="text-end">
                            {formatMoney(it.totalRevenue)}
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

        {/* Customer Table */}
        <div className="col-lg-5">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Customer Sales</div>
                  <div className="section-subtitle">
                    {customerCount} customer{customerCount === 1 ? "" : "s"} in result.
                  </div>
                </div>
              </div>

              <div
                className="table-responsive"
                style={{ maxHeight: "360px", overflowY: "auto" }}
              >
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Branch</th>
                      <th className="text-center">Items Count</th>
                      <th className="text-end">Revenue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          {loading
                            ? "Loading customer sales..."
                            : "No customer data for this period."}
                        </td>
                      </tr>
                    ) : (
                      customers.map((c, idx) => {
                        const itemsCount = Array.isArray(c.itemsSold)
                          ? c.itemsSold.length
                          : 0;

                        return (
                          <tr key={`${c.customerId || "none"}_${idx}`}>
                            <td>
                              <div style={{ fontWeight: 600 }}>
                                {c.customerName || "Unknown"}
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: 500 }}>
                                {c.branchName || "Unknown"}
                              </div>
                            </td>

                            <td className="text-center">
                              {formatNumber(itemsCount)}
                            </td>

                            <td className="text-end">
                              {formatMoney(c.totalRevenue)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={2500} />
    </div>
  );
};

export default SalesDashboard;