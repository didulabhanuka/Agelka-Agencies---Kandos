// src/pages/finance/RemainingCollectionReport.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useReactToPrint } from "react-to-print";

import { getReceivablesReport } from "../../lib/api/finance.api";
import { getCustomers, getSalesReps } from "../../lib/api/users.api";
import ReceivablesDrilldownPrintTemplate from "../../components/print/ReceivablesDrilldownPrintTemplate";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const RemainingCollectionReport = () => {
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState([]);
  const [byCustomer, setByCustomer] = useState([]);
  const [bySalesRep, setBySalesRep] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalRows: 0,
    totalPages: 1,
    count: 0,
  });

  const [customerPage, setCustomerPage] = useState(1);
  const [salesRepPage, setSalesRepPage] = useState(1);
  const GROUP_PAGE_SIZE = 5;

  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [salesRepFilter, setSalesRepFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickRange, setQuickRange] = useState("all"); // all | today | 7d | 30d | month | custom

  const [sortConfig, setSortConfig] = useState({
    key: "date", // date | customer | salesRep | balance
    direction: "asc",
  });

  // Print refs (three hidden templates)
  const printRefSalesRep = useRef(null);
  const printRefCustomer = useRef(null);
  const printRefBoth = useRef(null);

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    setCustomerPage(1);
    setSalesRepPage(1);
    fetchReport(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerFilter, salesRepFilter, dateFrom, dateTo, sortConfig]);

  const fetchMasters = async () => {
    try {
      const [cusRes, repsRes] = await Promise.all([
        getCustomers?.() ?? Promise.resolve([]),
        getSalesReps?.() ?? Promise.resolve([]),
      ]);

      setCustomers(Array.isArray(cusRes) ? cusRes : []);
      setSalesReps(Array.isArray(repsRes) ? repsRes : []);
    } catch (err) {
      console.error("Failed to load filter masters:", err);
    }
  };

  const fetchReport = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      };

      if (customerFilter !== "All") params.customerId = customerFilter;
      if (salesRepFilter !== "All") params.salesRepId = salesRepFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await getReceivablesReport(params);

      setRows(Array.isArray(res?.rows) ? res.rows : []);
      setByCustomer(Array.isArray(res?.byCustomer) ? res.byCustomer : []);
      setBySalesRep(Array.isArray(res?.bySalesRep) ? res.bySalesRep : []);
      setSummary(
        res?.summary || {
          totalOutstanding: 0,
          totalInvoiceValue: 0,
          totalPaidValue: 0,
          invoiceCount: 0,
          customerCount: 0,
          salesRepCount: 0,
          aging: { "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 },
        }
      );
      setPagination((prev) => ({
        ...prev,
        ...(res?.pagination || {}),
      }));
    } catch (err) {
      console.error("Failed to load remaining collection report:", err);
      toast.error("Failed to load remaining collection report");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB");
  };

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const resolveInvoiceAmount = (row) => {
    const direct =
      row?.invoiceValue ??
      row?.totalInvoiceValue ??
      row?.grandTotal ??
      row?.totalAmount ??
      row?.invoiceTotal;

    if (Number.isFinite(Number(direct))) return Number(direct);

    const paid = Number(row?.paidAmount ?? row?.totalPaidValue ?? 0);
    const bal = Number(row?.balance ?? row?.remainingAmount ?? row?.outstanding ?? 0);
    const sum = paid + bal;
    return Number.isFinite(sum) ? sum : 0;
  };

  const resolvePaidAmount = (row) => {
    const v = row?.paidAmount ?? row?.totalPaidValue ?? row?.collectedAmount ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };

  const resolveBalanceAmount = (row) => {
    const v =
      row?.balance ??
      row?.remainingAmount ??
      row?.outstanding ??
      row?.totalBalanceValue ??
      0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };

  const pagedByCustomer = useMemo(() => {
    const start = (customerPage - 1) * GROUP_PAGE_SIZE;
    return byCustomer.slice(start, start + GROUP_PAGE_SIZE);
  }, [byCustomer, customerPage]);

  const customerTotalPages = useMemo(
    () => Math.max(1, Math.ceil((byCustomer?.length || 0) / GROUP_PAGE_SIZE)),
    [byCustomer]
  );

  const pagedBySalesRep = useMemo(() => {
    const start = (salesRepPage - 1) * GROUP_PAGE_SIZE;
    return bySalesRep.slice(start, start + GROUP_PAGE_SIZE);
  }, [bySalesRep, salesRepPage]);

  const salesRepTotalPages = useMemo(
    () => Math.max(1, Math.ceil((bySalesRep?.length || 0) / GROUP_PAGE_SIZE)),
    [bySalesRep]
  );

  const periodLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
    if (dateFrom) return `From ${formatDate(dateFrom)}`;
    if (dateTo) return `Up to ${formatDate(dateTo)}`;
    return "All Dates";
  }, [dateFrom, dateTo]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const invoiceNo = r?.invoiceNo?.toLowerCase?.() || "";
      const customerName = r?.customer?.name?.toLowerCase?.() || "";
      const repName = r?.salesRep?.name?.toLowerCase?.() || "";
      const status = r?.paymentStatus?.toLowerCase?.() || "";
      return (
        invoiceNo.includes(s) ||
        customerName.includes(s) ||
        repName.includes(s) ||
        status.includes(s)
      );
    });
  }, [rows, search]);

  // normalized rows for print
  const printInvoiceRows = useMemo(() => {
    return (filteredRows || []).map((row) => ({
      ...row,
      invoiceValue: resolveInvoiceAmount(row),
      paidAmount: resolvePaidAmount(row),
      balance: resolveBalanceAmount(row),

      customerName: row?.customer?.name || row?.customerName || "Unknown Customer",
      salesRepName: row?.salesRep?.name || row?.salesRepName || "Unassigned",

      invoiceNo: row?.invoiceNo || row?.invoiceNumber || "-",
      invoiceDate: row?.invoiceDate || row?.date || row?.createdAt || null,
    }));
  }, [filteredRows]);

  const selectedCustomerLabel = useMemo(() => {
    if (customerFilter === "All") return "";
    const c = (customers || []).find((x) => x._id === customerFilter);
    return c?.name || "";
  }, [customerFilter, customers]);

  const selectedSalesRepLabel = useMemo(() => {
    if (salesRepFilter === "All") return "";
    const r = (salesReps || []).find((x) => x._id === salesRepFilter);
    return r?.name || "";
  }, [salesRepFilter, salesReps]);

  const salesRepPrintEntity = useMemo(() => {
    const selectedRow =
      (salesRepFilter !== "All" &&
        bySalesRep.find(
          (r) =>
            String(r?._id || "") === String(salesRepFilter) ||
            String(r?.salesRepId || "") === String(salesRepFilter)
        )) ||
      null;

    return {
      name: selectedSalesRepLabel || selectedRow?.repName || "Selected Sales Rep",
      totalOutstanding: toNum(selectedRow?.totalOutstanding ?? summary?.totalOutstanding),
      totalInvoiceValue: toNum(selectedRow?.totalInvoiceValue ?? summary?.totalInvoiceValue),
      totalPaidValue: toNum(selectedRow?.totalPaidValue ?? summary?.totalPaidValue),
      invoiceCount: toNum(selectedRow?.invoiceCount ?? summary?.invoiceCount),
      customerCount: toNum(selectedRow?.customerCount ?? summary?.customerCount),
      salesRepCount: 0,
    };
  }, [salesRepFilter, bySalesRep, selectedSalesRepLabel, summary]);

  const customerPrintEntity = useMemo(() => {
    const selectedRow =
      (customerFilter !== "All" &&
        byCustomer.find(
          (r) =>
            String(r?._id || "") === String(customerFilter) ||
            String(r?.customerId || "") === String(customerFilter)
        )) ||
      null;

    return {
      name: selectedCustomerLabel || selectedRow?.customerName || "Selected Customer",
      totalOutstanding: toNum(selectedRow?.totalOutstanding ?? summary?.totalOutstanding),
      totalInvoiceValue: toNum(summary?.totalInvoiceValue),
      totalPaidValue: toNum(summary?.totalPaidValue),
      invoiceCount: toNum(selectedRow?.invoiceCount ?? summary?.invoiceCount),
      customerCount: 0,
      salesRepCount: toNum(summary?.salesRepCount),
    };
  }, [customerFilter, byCustomer, selectedCustomerLabel, summary]);

  const bothPrintEntity = useMemo(() => {
    return {
      name:
        selectedCustomerLabel && selectedSalesRepLabel
          ? `${selectedCustomerLabel} / ${selectedSalesRepLabel}`
          : "Customer + Sales Rep",
      totalOutstanding: toNum(summary?.totalOutstanding),
      totalInvoiceValue: toNum(summary?.totalInvoiceValue),
      totalPaidValue: toNum(summary?.totalPaidValue),
      invoiceCount: toNum(summary?.invoiceCount),
      customerCount: 0,
      salesRepCount: 0,
    };
  }, [selectedCustomerLabel, selectedSalesRepLabel, summary]);

  const handlePrintSalesRepView = useReactToPrint({
    contentRef: printRefSalesRep,
    documentTitle: `RemainingCollectionReport_salesRep_${new Date()
      .toISOString()
      .slice(0, 10)}`,
  });

  const handlePrintCustomerView = useReactToPrint({
    contentRef: printRefCustomer,
    documentTitle: `RemainingCollectionReport_customer_${new Date()
      .toISOString()
      .slice(0, 10)}`,
  });

  const handlePrintBothView = useReactToPrint({
    contentRef: printRefBoth,
    documentTitle: `RemainingCollectionReport_both_${new Date()
      .toISOString()
      .slice(0, 10)}`,
  });

  const handleSmartPrint = () => {
    const hasCustomer = customerFilter !== "All";
    const hasSalesRep = salesRepFilter !== "All";

    if (!printInvoiceRows.length) {
      toast.info("No rows to print");
      return;
    }

    if (hasCustomer && hasSalesRep) {
      handlePrintBothView?.();
      return;
    }

    if (hasCustomer) {
      handlePrintCustomerView?.();
      return;
    }

    if (hasSalesRep) {
      handlePrintSalesRepView?.();
      return;
    }

    handlePrintSalesRepView?.();
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "bi-arrow-down-up";
    return sortConfig.direction === "asc" ? "bi-sort-down" : "bi-sort-up";
  };

  const resetFilters = () => {
    setSearch("");
    setCustomerFilter("All");
    setSalesRepFilter("All");
    setDateFrom("");
    setDateTo("");
    setQuickRange("all");
    setSortConfig({ key: "date", direction: "asc" });
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1) return;
    if (nextPage > (pagination.totalPages || 1)) return;
    fetchReport(nextPage);
  };

  const applyQuickDateRange = (type) => {
    const today = new Date();
    const toISO = (d) => {
      const y = d.getFullYear();
      const m = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (type === "all") {
      setDateFrom("");
      setDateTo("");
      setQuickRange("all");
      return;
    }

    const end = new Date(today);
    let start = new Date(today);

    if (type === "today") {
      // same day
    } else if (type === "7d") {
      start.setDate(today.getDate() - 6);
    } else if (type === "30d") {
      start.setDate(today.getDate() - 29);
    } else if (type === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    setDateFrom(toISO(start));
    setDateTo(toISO(end));
    setQuickRange(type);
  };

  const handleDateFromChange = (val) => {
    setDateFrom(val);
    setQuickRange("custom");
  };

  const handleDateToChange = (val) => {
    setDateTo(val);
    setQuickRange("custom");
  };

  return (
    <div className="container-fluid py-4 px-5">
      <style>{`
        /* ---------- Modern Filter Card ---------- */
        .filters-card {
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
          margin-bottom: 14px;
        }

        .filters-top {
          display: grid;
          grid-template-columns: minmax(260px, 1.35fr) repeat(2, minmax(200px, 0.9fr)) auto;
          gap: 10px;
          align-items: stretch;
        }

        .filter-control {
          position: relative;
          display: flex;
          align-items: center;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          min-height: 42px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .filter-control:focus-within {
          border-color: #c7d2fe;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }

        .filter-control .leading-icon {
          width: 36px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          flex-shrink: 0;
        }

        .filter-control input,
        .filter-control select {
          border: none;
          outline: none;
          background: transparent;
          width: 100%;
          min-width: 0;
          padding: 9px 10px 9px 0;
          font-size: 13px;
          color: #111827;
        }

        .filter-control select {
          padding-right: 6px;
          appearance: none;
          cursor: pointer;
        }

        .filter-control .select-caret {
          color: #98a2b3;
          padding-right: 10px;
          font-size: 12px;
          pointer-events: none;
        }

        .filter-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-soft {
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #344054;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          min-height: 42px;
          white-space: nowrap;
        }

        .btn-soft:hover {
          background: #f9fafb;
          border-color: #d0d5dd;
        }

        .btn-soft-primary {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #5c3e94;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          min-height: 42px;
          white-space: nowrap;
        }

        .btn-soft-primary:hover {
          background: #dbeafe;
          border-color: #bfdbfe;
        }

        .filters-bottom {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .date-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          color: #344054;
        }

        .date-pill input {
          border: none;
          outline: none;
          background: transparent;
          font-size: 12px;
          color: #111827;
        }

        .quick-chip {
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #344054;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          line-height: 1;
        }

        .quick-chip:hover {
          border-color: #c7d2fe;
          color: #4338ca;
          background: #f8faff;
        }

        .quick-chip.active {
          border-color: #c7d2fe;
          background: #eef2ff;
          color: #4338ca;
        }

        .filters-meta {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .meta-badge {
          font-size: 12px;
          font-weight: 600;
          color: #475467;
          background: #f9fafb;
          border: 1px solid #eaecf0;
          border-radius: 999px;
          padding: 6px 10px;
        }

        .table-top-note {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .summary-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .summary-chip {
          font-size: 12px;
          font-weight: 700;
          border-radius: 999px;
          padding: 6px 10px;
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #344054;
        }

        .stock-table-wrap {
          max-height: 62vh;
          overflow: auto;
          border-radius: 14px;
        }

        .stock-table-wrap .modern-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #fff;
          box-shadow: inset 0 -1px 0 #eef0f3;
          white-space: nowrap;
        }

        .stock-row {
          transition: background-color .15s ease, box-shadow .15s ease;
        }

        .stock-row:hover {
          background: #fafbff;
          box-shadow: inset 3px 0 0 #5c3e94;
        }

        .sort-btn {
          border: none;
          background: transparent;
          padding: 0;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          color: inherit;
        }

        .sort-btn:hover { color: #5c3e94; }

        .avatar-circle {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #374151;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          border: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .main-text { font-weight: 700; color: #111827; }
        .sub-text { font-size: 12px; color: #6b7280; margin-top: 2px; }

        .status-pill-ux {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border: 1px solid transparent;
          white-space: nowrap;
          text-transform: capitalize;
        }

        .status-pill-ux.unpaid { background: #fef3f2; color: #b42318; border-color: #fecdca; }
        .status-pill-ux.partially_paid { background: #fffaeb; color: #b54708; border-color: #fedf89; }
        .status-pill-ux.paid { background: #ecfdf3; color: #027a48; border-color: #abefc6; }

        .pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .amount-stack {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1.25;
        }

        .amount-stack .top {
          font-weight: 700;
          color: #111827;
        }

        .amount-stack .bottom {
          font-size: 12px;
          color: #6b7280;
        }

        @media (max-width: 1200px) {
          .filters-top {
            grid-template-columns: 1fr 1fr;
          }

          .filter-actions {
            grid-column: span 2;
            justify-content: flex-end;
          }
        }

        @media (max-width: 768px) {
          .filters-top {
            grid-template-columns: 1fr;
          }

          .filter-actions {
            grid-column: span 1;
            justify-content: stretch;
            flex-wrap: wrap;
          }

          .filter-actions button {
            flex: 1;
          }

          .filters-meta {
            margin-left: 0;
            width: 100%;
          }

          .date-pill {
            width: 100%;
            justify-content: space-between;
          }

          .date-pill input {
            min-width: 130px;
          }
        }
      `}</style>

      <div className="pb-3">
        <h2 className="page-title">Remaining Collection Report</h2>
        <p className="page-subtitle">
          Track pending customer collections with invoice-level balances, grouped customer totals,
          and sales rep totals.
        </p>
      </div>

      {/* Filters */}
      <div className="filters-card">
        <div className="filters-top">
          {/* Search */}
          <div className="filter-control">
            <span className="leading-icon">
              <i className="bi bi-search" />
            </span>
            <input
              type="text"
              placeholder="Search invoice, customer, sales rep..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Customer */}
          <div className="filter-control">
            <span className="leading-icon">
              <i className="bi bi-person" />
            </span>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              aria-label="Filter by customer"
            >
              <option value="All">All Customers</option>
              {(customers || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name || "Unnamed Customer"}
                </option>
              ))}
            </select>
            <span className="select-caret">
              <i className="bi bi-chevron-down" />
            </span>
          </div>

          {/* Sales Rep */}
          <div className="filter-control">
            <span className="leading-icon">
              <i className="bi bi-person-badge" />
            </span>
            <select
              value={salesRepFilter}
              onChange={(e) => setSalesRepFilter(e.target.value)}
              aria-label="Filter by sales rep"
            >
              <option value="All">All Sales Reps</option>
              {(salesReps || [])
                .filter((r) => (r.status || "active") === "active")
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name || "Unnamed Sales Rep"}
                  </option>
                ))}
            </select>
            <span className="select-caret">
              <i className="bi bi-chevron-down" />
            </span>
          </div>

          {/* Actions */}
          <div className="filter-actions">
            <button
              type="button"
              className="btn-soft"
              onClick={resetFilters}
              disabled={loading}
              title="Reset all filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>
          </div>
        </div>

        <div className="filters-bottom">
          <div className="date-pill">
            <i className="bi bi-calendar-event text-muted" />
            <span className="text-muted">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              aria-label="From date"
            />
          </div>

          <div className="date-pill">
            <i className="bi bi-calendar-check text-muted" />
            <span className="text-muted">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              aria-label="To date"
            />
          </div>

          <button
            type="button"
            className={`quick-chip ${quickRange === "today" ? "active" : ""}`}
            onClick={() => applyQuickDateRange("today")}
            disabled={loading}
          >
            Today
          </button>

          <button
            type="button"
            className={`quick-chip ${quickRange === "7d" ? "active" : ""}`}
            onClick={() => applyQuickDateRange("7d")}
            disabled={loading}
          >
            7D
          </button>

          <button
            type="button"
            className={`quick-chip ${quickRange === "30d" ? "active" : ""}`}
            onClick={() => applyQuickDateRange("30d")}
            disabled={loading}
          >
            30D
          </button>

          <button
            type="button"
            className={`quick-chip ${quickRange === "month" ? "active" : ""}`}
            onClick={() => applyQuickDateRange("month")}
            disabled={loading}
          >
            This Month
          </button>

          <button
            type="button"
            className={`quick-chip ${quickRange === "all" ? "active" : ""}`}
            onClick={() => applyQuickDateRange("all")}
            disabled={loading}
          >
            Clear Dates
          </button>

          <div className="filters-meta">
            <span className="meta-badge">
              <i className="bi bi-funnel me-1" />
              {periodLabel}
            </span>

            {(customerFilter !== "All" || salesRepFilter !== "All") && (
              <span className="meta-badge">
                <i className="bi bi-check2-circle me-1" />
                {customerFilter !== "All" ? "Customer" : ""}
                {customerFilter !== "All" && salesRepFilter !== "All" ? " + " : ""}
                {salesRepFilter !== "All" ? "Sales Rep" : ""} filter applied
              </span>
            )}

            {loading && (
              <span className="meta-badge">
                <i className="bi bi-arrow-repeat me-1" />
                Loading...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top cards */}
      <div className="summary-grid mb-3">
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Outstanding</span>
            <i className="bi bi-cash-stack summary-icon" />
          </div>
          <div className="summary-value">{formatCurrency(summary?.totalOutstanding)}</div>
          <div className="summary-sub">Remaining amount still to be collected.</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Invoice Value</span>
            <i className="bi bi-receipt summary-icon" />
          </div>
          <div className="summary-value">{formatCurrency(summary?.totalInvoiceValue)}</div>
          <div className="summary-sub">Total approved invoice value in filtered results.</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Collected</span>
            <i className="bi bi-wallet2 summary-icon" />
          </div>
          <div className="summary-value">{formatCurrency(summary?.totalPaidValue)}</div>
          <div className="summary-sub">Paid amount already collected against these invoices.</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Coverage</span>
            <i className="bi bi-people summary-icon" />
          </div>
          <div className="summary-value">
            {toNum(summary?.customerCount)} / {toNum(summary?.salesRepCount)}
          </div>
          <div className="summary-sub">Customers / Sales reps with remaining collections.</div>
          <div className="summary-period">Invoices: {toNum(summary?.invoiceCount)}</div>
        </div>
      </div>

      {/* Group summaries */}
      <div className="row g-2 mb-3">
        <div className="col-lg-5">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Customer Outstanding</div>
                  <div className="section-subtitle">
                    {toNum(summary?.customerCount)} customer
                    {toNum(summary?.customerCount) === 1 ? "" : "s"} in result.
                  </div>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: "380px", overflowY: "auto" }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="text-end">Invoices</th>
                      <th className="text-end">Max Age</th>
                      <th className="text-end">Outstanding</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedByCustomer.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          {loading
                            ? "Loading customer outstanding..."
                            : "No customer data for this period."}
                        </td>
                      </tr>
                    ) : (
                      pagedByCustomer.map((c) => (
                        <tr key={c._id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.customerName || "Unknown"}</div>
                          </td>
                          <td className="text-end">{toNum(c.invoiceCount)}</td>
                          <td className="text-end">{toNum(c.maxAgeDays)}d</td>
                          <td className="text-end">{formatCurrency(c.totalOutstanding)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-2">
                <div className="small text-muted">
                  Page {customerPage} of {customerTotalPages}
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                    disabled={loading || customerPage <= 1}
                  >
                    <i className="bi bi-chevron-left me-1" />
                    Prev
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setCustomerPage((p) => Math.min(customerTotalPages, p + 1))}
                    disabled={loading || customerPage >= customerTotalPages}
                  >
                    Next
                    <i className="bi bi-chevron-right ms-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Sales Rep Outstanding</div>
                  <div className="section-subtitle">
                    {toNum(summary?.salesRepCount)} sales rep
                    {toNum(summary?.salesRepCount) === 1 ? "" : "s"} in result.
                  </div>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: "380px", overflowY: "auto" }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Sales Rep</th>
                      <th className="text-end">Customers</th>
                      <th className="text-end">Invoices</th>
                      <th className="text-end">Invoice Value</th>
                      <th className="text-end">Paid</th>
                      <th className="text-end">Outstanding</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedBySalesRep.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-3">
                          {loading
                            ? "Loading sales rep outstanding..."
                            : "No sales rep data for this period."}
                        </td>
                      </tr>
                    ) : (
                      pagedBySalesRep.map((r, idx) => (
                        <tr key={`${r._id || "unassigned"}_${idx}`}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.repName || "Unassigned"}</div>
                          </td>
                          <td className="text-end">{toNum(r.customerCount)}</td>
                          <td className="text-end">{toNum(r.invoiceCount)}</td>
                          <td className="text-end">{formatCurrency(r.totalInvoiceValue)}</td>
                          <td className="text-end">{formatCurrency(r.totalPaidValue)}</td>
                          <td className="text-end">{formatCurrency(r.totalOutstanding)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-2">
                <div className="small text-muted">
                  Page {salesRepPage} of {salesRepTotalPages}
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setSalesRepPage((p) => Math.max(1, p - 1))}
                    disabled={loading || salesRepPage <= 1}
                  >
                    <i className="bi bi-chevron-left me-1" />
                    Prev
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setSalesRepPage((p) => Math.min(salesRepTotalPages, p + 1))}
                    disabled={loading || salesRepPage >= salesRepTotalPages}
                  >
                    Next
                    <i className="bi bi-chevron-right ms-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice-level table */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <div className="summary-chips">
            <span className="summary-chip">
              <i className="bi bi-list-ul me-1" />
              Showing: {filteredRows.length}
            </span>
            <span className="summary-chip">
              <i className="bi bi-database me-1" />
              Total Rows: {toNum(pagination.totalRows)}
            </span>
            <span className="summary-chip">
              <i className="bi bi-person-lines-fill me-1" />
              Sales Reps: {toNum(summary?.salesRepCount)}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {loading && (
              <span className="small text-muted">
                <i className="bi bi-arrow-repeat me-1" />
                Loading...
              </span>
            )}
          </div>

            <button
              type="button"
              className="btn-soft-primary"
              onClick={handleSmartPrint}
              disabled={loading || !filteredRows.length}
              title="Print filtered report"
            >
              <i className="bi bi-printer me-1" />
              Print
            </button>
        </div>

        <div className="stock-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("date")}>
                    Invoice
                    <i className={`bi ${getSortIcon("date")}`} />
                  </button>
                </th>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("customer")}>
                    Customer
                    <i className={`bi ${getSortIcon("customer")}`} />
                  </button>
                </th>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("salesRep")}>
                    Sales Rep
                    <i className={`bi ${getSortIcon("salesRep")}`} />
                  </button>
                </th>
                <th>Status</th>
                <th className="text-end">Invoice / Paid</th>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("balance")}>
                    Balance
                    <i className={`bi ${getSortIcon("balance")}`} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={row._id} className="stock-row">
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle">
                          {(row.invoiceNo || "I").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="main-text">{row.invoiceNo || "-"}</div>
                          <div className="sub-text">{formatDate(row.invoiceDate)}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="main-text">{row?.customer?.name || "-"}</div>
                    </td>

                    <td>
                      <div className="main-text">{row?.salesRep?.name || "Unassigned"}</div>
                    </td>

                    <td>
                      <span className={`status-pill-ux ${row.paymentStatus || "unpaid"}`}>
                        <i
                          className={`bi ${
                            row.paymentStatus === "paid"
                              ? "bi-check-circle-fill"
                              : row.paymentStatus === "partially_paid"
                              ? "bi-hourglass-split"
                              : "bi-exclamation-circle-fill"
                          }`}
                        />
                        {(row.paymentStatus || "unpaid").replaceAll("_", " ")}
                      </span>
                    </td>

                    <td className="text-end">
                      <div className="amount-stack">
                        <span className="top">{formatCurrency(resolveInvoiceAmount(row))}</span>
                        <span className="bottom">
                          Paid: {formatCurrency(resolvePaidAmount(row))}
                        </span>
                      </div>
                    </td>

                    <td className="fw-bold text-end">
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <span>{formatCurrency(resolveBalanceAmount(row))}</span>
                        <span className="sub-text">{row.agingBucket || "-"}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    {loading ? "Loading remaining collection rows..." : "No rows found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <div className="small text-muted">
            Page {toNum(pagination.page)} of {Math.max(1, toNum(pagination.totalPages))}
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-light border"
              onClick={() => handlePageChange(toNum(pagination.page) - 1)}
              disabled={loading || toNum(pagination.page) <= 1}
            >
              <i className="bi bi-chevron-left me-1" />
              Prev
            </button>

            <button
              type="button"
              className="btn btn-sm btn-light border"
              onClick={() => handlePageChange(toNum(pagination.page) + 1)}
              disabled={
                loading || toNum(pagination.page) >= Math.max(1, toNum(pagination.totalPages))
              }
            >
              Next
              <i className="bi bi-chevron-right ms-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden print template - Sales Rep mode */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
        <ReceivablesDrilldownPrintTemplate
          ref={printRefSalesRep}
          mode="salesRep"
          dateFrom={dateFrom}
          dateTo={dateTo}
          salesRepFilterLabel={selectedSalesRepLabel}
          customerFilterLabel={selectedCustomerLabel}
          selectedEntity={salesRepPrintEntity}
          summaryRows={byCustomer}
          invoiceRows={printInvoiceRows}
          generatedBy="System User"
          company={{
            name: "Agelka Agencies",
            address: "41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka",
            phone: "+94 55 720 0446",
          }}
        />
      </div>

      {/* Hidden print template - Customer mode */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
        <ReceivablesDrilldownPrintTemplate
          ref={printRefCustomer}
          mode="customer"
          dateFrom={dateFrom}
          dateTo={dateTo}
          salesRepFilterLabel={selectedSalesRepLabel}
          customerFilterLabel={selectedCustomerLabel}
          selectedEntity={customerPrintEntity}
          summaryRows={bySalesRep}
          invoiceRows={printInvoiceRows}
          generatedBy="System User"
          company={{
            name: "Agelka Agencies",
            address: "41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka",
            phone: "+94 55 720 0446",
          }}
        />
      </div>

      {/* Hidden print template - Both filters mode */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
        <ReceivablesDrilldownPrintTemplate
          ref={printRefBoth}
          mode="both"
          dateFrom={dateFrom}
          dateTo={dateTo}
          salesRepFilterLabel={selectedSalesRepLabel}
          customerFilterLabel={selectedCustomerLabel}
          selectedEntity={bothPrintEntity}
          summaryRows={[]}
          invoiceRows={printInvoiceRows}
          generatedBy="System User"
          company={{
            name: "Agelka Agencies",
            address: "41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka",
            phone: "+94 55 720 0446",
          }}
        />
      </div>

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default RemainingCollectionReport;