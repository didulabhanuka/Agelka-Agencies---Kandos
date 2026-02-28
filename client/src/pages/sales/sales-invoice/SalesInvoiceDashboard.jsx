// src/pages/sales/SalesInvoiceDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

import {
  listSalesInvoices,
  getSalesInvoice,
  approveSalesInvoice,
  deleteSalesInvoice,
  getSalesReturn,
} from "../../../lib/api/sales.api";

import {
  getPaymentsForInvoice,
  getCustomerPayment,
} from "../../../lib/api/finance.api";

import { listBranches } from "../../../lib/api/settings.api";
import { getCustomers, getSalesReps } from "../../../lib/api/users.api";

import SalesInvoiceCreateModal from "./SalesInvoiceCreateModal";
import SalesInvoiceViewModal from "./SalesInvoiceViewModal";
import SalesReturnCreateModal from "../sales-return/SalesReturnCreateModal";
import PaymentCreateModal from "../../finance/PaymentCreateModal";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

const SalesInvoiceDashboard = () => {
  // RBAC flags
  const { user } = useAuth();
  const actorType = user?.actorType;
  const role = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  const isSalesRep = actorType === "SalesRep";

  const loggedInSalesRepId =
    user?.id ||
    user?._id ||
    user?.salesRep?._id ||
    user?.salesRepId ||
    user?.actorId ||
    "";

  // Local state
  const [loading, setLoading] = useState(false);

  const [invoices, setInvoices] = useState([]);

  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All");
  const [salesRepFilter, setSalesRepFilter] = useState("All");

  const [sortConfig, setSortConfig] = useState({
    key: "invoiceDate",
    direction: "desc",
  });

  // Create / edit modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");

  // View invoice modal
  const [invoiceViewOpen, setInvoiceViewOpen] = useState(false);
  const [invoiceForView, setInvoiceForView] = useState(null);

  // View return modal
  const [returnViewOpen, setReturnViewOpen] = useState(false);
  const [returnForView, setReturnForView] = useState(null);

  // Payment view modal — always opens in "view" mode from here
  const [paymentViewOpen, setPaymentViewOpen] = useState(false);
  const [paymentForView, setPaymentForView] = useState(null);

  // Initial load
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrDataEntry]);

  // Data fetch
  const fetchAll = async () => {
    setLoading(true);

    try {
      const requests = [listSalesInvoices(), listBranches(), getCustomers()];
      if (isAdminOrDataEntry) requests.push(getSalesReps());

      const results = await Promise.all(requests);

      const invRes = results[0];
      const branchRes = results[1];
      const custRes = results[2];
      const salesRepRes = isAdminOrDataEntry ? results[3] : null;

      const invoiceList = Array.isArray(invRes) ? invRes : invRes?.data || [];

      setInvoices(invoiceList);
      setBranches(branchRes?.data || branchRes || []);
      setCustomers(custRes || []);
      setSalesReps(salesRepRes?.data || salesRepRes || []);

      if (!isAdminOrDataEntry) setSalesRepFilter("All");
    } catch (err) {
      console.error("Failed loading invoices or master data:", err);
      toast.error("Failed to load sales invoices.");
    } finally {
      setLoading(false);
    }
  };

  // Helpers
  const formatCurrency = (value) => {
    const n = Number(value || 0);
    return `Rs. ${new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)}`;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const getCustomerCreditClass = (creditStatus) => {
    const value = String(creditStatus || "").toLowerCase();
    if (value.includes("cash")) return "mini-pill neutral";
    if (value.includes("credit")) return "mini-pill info";
    return "mini-pill neutral";
  };

  const getStatusMeta = (status) => {
    switch (status) {
      case "approved":
        return { label: "Approved", className: "pill-success", icon: "bi-check-circle-fill" };
      case "cancelled":
        return { label: "Cancelled", className: "pill-danger", icon: "bi-x-circle-fill" };
      case "draft":
        return { label: "Draft", className: "pill-muted", icon: "bi-file-earmark-text-fill" };
      case "waiting_for_approval":
      default:
        return {
          label: isSalesRep ? "Waiting for Admin Approval" : "Waiting for Approval",
          className: "pill-warning",
          icon: "bi-hourglass-split",
        };
    }
  };

  const getPaymentStatusMeta = (status) => {
    switch (status) {
      case "paid":
        return { label: "Paid", className: "pill-success", icon: "bi-cash-stack" };
      case "partially_paid":
        return { label: "Partially Paid", className: "pill-warning", icon: "bi-cash-coin" };
      case "unpaid":
      default:
        return { label: "Unpaid", className: "pill-danger", icon: "bi-exclamation-circle" };
    }
  };

  const getInvoiceTotals = (inv) => {
    const originalTotal = Number(inv.totalValue || 0);
    const returned = Number(inv.totalReturnedValue || 0);
    const netTotal = originalTotal - returned;
    const paid = Number(inv.paidAmount || 0);
    const balance = Math.max(0, netTotal - paid);
    const paidPct = netTotal > 0 ? Math.min(100, (paid / netTotal) * 100) : 0;
    return { originalTotal, returned, netTotal, paid, balance, paidPct };
  };

  const getSortValue = (inv, key) => {
    const totals = getInvoiceTotals(inv);
    switch (key) {
      case "invoiceNo":
        return String(inv.invoiceNo || "").toLowerCase();
      case "customer":
        return String(inv.customer?.name || "").toLowerCase();
      case "branch":
        return String(inv.branch?.name || "").toLowerCase();
      case "salesRep":
        return String(
          `${inv.salesRep?.repCode || ""} ${inv.salesRep?.name || inv.salesRep?.fullName || ""}`.trim()
        ).toLowerCase();
      case "invoiceDate":
        return new Date(inv.invoiceDate || 0).getTime() || 0;
      case "amount":
        return Number(totals.netTotal || 0);
      case "payment":
        return String(inv.paymentStatus || "unpaid").toLowerCase();
      case "status":
        return String(inv.status || "").toLowerCase();
      default:
        return "";
    }
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

  const filteredInvoices = useMemo(() => {
    let data = [...invoices];
    const s = search.trim().toLowerCase();

    if (isSalesRep && loggedInSalesRepId) {
      data = data.filter((inv) => {
        const invSalesRepId = inv.salesRep?._id || inv.salesRep || inv.salesRepId || "";
        return String(invSalesRepId) === String(loggedInSalesRepId);
      });
    }

    if (s) {
      data = data.filter((inv) => {
        const invoiceNo = inv.invoiceNo?.toLowerCase() || "";
        const customerName = inv.customer?.name?.toLowerCase() || "";
        const customerCode = inv.customer?.customerCode?.toLowerCase() || "";
        const branchName = inv.branch?.name?.toLowerCase() || "";
        const salesRepName = inv.salesRep?.name?.toLowerCase() || "";
        const salesRepCode = inv.salesRep?.repCode?.toLowerCase() || "";
        return (
          invoiceNo.includes(s) ||
          customerName.includes(s) ||
          customerCode.includes(s) ||
          branchName.includes(s) ||
          (isAdminOrDataEntry && (salesRepName.includes(s) || salesRepCode.includes(s)))
        );
      });
    }

    if (customerFilter !== "All") {
      data = data.filter((inv) => inv.customer?._id === customerFilter);
    }
    if (branchFilter !== "All") {
      data = data.filter((inv) => inv.branch?._id === branchFilter);
    }
    if (statusFilter !== "All") {
      data = data.filter((inv) => inv.status === statusFilter);
    }
    if (paymentStatusFilter !== "All") {
      data = data.filter((inv) => (inv.paymentStatus || "unpaid") === paymentStatusFilter);
    }
    if (isAdminOrDataEntry && salesRepFilter !== "All") {
      data = data.filter((inv) => {
        const invSalesRepId = inv.salesRep?._id || inv.salesRep || inv.salesRepId || "";
        return String(invSalesRepId) === String(salesRepFilter);
      });
    }

    data.sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [
    invoices, search, customerFilter, branchFilter, statusFilter,
    paymentStatusFilter, salesRepFilter, isAdminOrDataEntry,
    isSalesRep, loggedInSalesRepId, sortConfig,
  ]);

  // Actions
  const handleOpenCreate = () => {
    setSelectedInvoice(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleView = async (inv) => {
    try {
      setLoading(true);
      const full = await getSalesInvoice(inv._id);
      const paymentsRes = await getPaymentsForInvoice(inv._id);
      full.paymentAllocations = Array.isArray(paymentsRes?.payments) ? paymentsRes.payments : [];
      setInvoiceForView(full);
      setInvoiceViewOpen(true);
    } catch (err) {
      console.error("Failed to load invoice:", err);
      toast.error("Failed to load invoice details.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (inv) => {
    try {
      setLoading(true);
      const full = await getSalesInvoice(inv._id);
      setSelectedInvoice(full);
      setModalMode("edit");
      setModalOpen(true);
    } catch (err) {
      console.error("Failed to load invoice for editing:", err);
      toast.error("Failed to load invoice for editing.");
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (inv) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${inv.invoiceNo}?`)) return;
    try {
      setLoading(true);
      const res = await deleteSalesInvoice(inv._id);
      toast.success(res?.message || "Invoice deleted successfully.");
      await fetchAll();
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      toast.error(err?.response?.data?.message || "Failed to delete invoice.");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (inv) => {
    if (inv.status !== "waiting_for_approval") {
      toast.info("Only invoices waiting for approval can be approved.");
      return;
    }
    if (!window.confirm(`Approve invoice ${inv.invoiceNo}?`)) return;
    try {
      setLoading(true);
      const res = await approveSalesInvoice(inv._id);
      toast.success(res?.message || "Invoice approved successfully.");
      await fetchAll();
    } catch (err) {
      console.error("Failed to approve invoice:", err);
      toast.error(err?.response?.data?.message || "Failed to approve invoice.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewReturnFromInvoiceModal = async (returnId) => {
    if (!returnId) return;
    try {
      setLoading(true);
      const full = await getSalesReturn(returnId);
      setReturnForView(full);
      setReturnViewOpen(true);
    } catch (err) {
      console.error("Failed to load return:", err);
      toast.error("Failed to load sales return.");
    } finally {
      setLoading(false);
    }
  };

  // ── Payment viewer ─────────────────────────────────────────────────────────
  // Called from SalesInvoiceViewModal when user clicks a payment link.
  // The allocation entry passed up may be a thin object like:
  //   { paymentNo, amount, paymentId: "abc123" | { _id: "abc123", ... } }
  // We resolve the real payment ID, fetch the full payment, then open in VIEW mode.
  const handleOpenPaymentFromInvoice = async (allocationOrId) => {
    if (!allocationOrId) return;

    // Resolve the payment ID — could be a string ID, an allocation object,
    // or an object whose paymentId field holds the real ID.
    const paymentId =
      typeof allocationOrId === "string"
        ? allocationOrId
        : allocationOrId?.paymentId?._id ||
          allocationOrId?.paymentId ||
          allocationOrId?._id ||
          null;

    if (!paymentId) {
      toast.error("Could not resolve payment ID.");
      return;
    }

    try {
      setLoading(true);
      const res = await getCustomerPayment(paymentId);
      const fullPayment = res?.data || res;
      setPaymentForView(fullPayment);
      setPaymentViewOpen(true);
    } catch (err) {
      console.error("Failed to load payment:", err);
      toast.error("Failed to load payment details.");
    } finally {
      setLoading(false);
    }
  };

  const closePaymentViewer = () => {
    setPaymentForView(null);
    setPaymentViewOpen(false);
  };
  // ──────────────────────────────────────────────────────────────────────────

  const resetFilters = () => {
    setSearch("");
    setCustomerFilter("All");
    setBranchFilter("All");
    setStatusFilter("All");
    setPaymentStatusFilter("All");
    setSalesRepFilter("All");
    setSortConfig({ key: "invoiceDate", direction: "desc" });
  };

  const tableColSpan = isAdminOrDataEntry ? 9 : 8;

  const visibleCountLabel = useMemo(() => {
    const count = filteredInvoices.length;
    return `${count} invoice${count === 1 ? "" : "s"}`;
  }, [filteredInvoices.length]);

  return (
    <div className="container-fluid py-4 px-5">
      <style>
        {`
          .invoice-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }
          .invoice-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
          }
          .invoice-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }
          .invoice-row:hover {
            background: #fafbff;
            box-shadow: inset 3px 0 0 #5c3e94;
          }
          .col-invoice-main { min-width: 170px; }
          .invoice-no { font-weight: 700; color: #111827; letter-spacing: 0.01em; }
          .invoice-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
          .mini-pill {
            display: inline-flex; align-items: center; padding: 2px 8px;
            border-radius: 999px; font-size: 11px; font-weight: 600;
            margin-top: 4px; border: 1px solid transparent;
          }
          .mini-pill.neutral { background: #f3f4f6; color: #4b5563; border-color: #e5e7eb; }
          .mini-pill.info    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
          .status-pill-ux {
            display: inline-flex; align-items: center; gap: 6px;
            border-radius: 999px; font-size: 12px; font-weight: 700;
            padding: 4px 10px; border: 1px solid transparent; white-space: nowrap;
          }
          .status-pill-ux.pill-success { background: #ecfdf3; color: #027a48; border-color: #abefc6; }
          .status-pill-ux.pill-warning { background: #fffaeb; color: #b54708; border-color: #fedf89; }
          .status-pill-ux.pill-danger  { background: #fef3f2; color: #b42318; border-color: #fecdca; }
          .status-pill-ux.pill-muted   { background: #f2f4f7; color: #475467; border-color: #e4e7ec; }
          .amount-stack { line-height: 1.25; min-width: 170px; }
          .amount-main  { font-weight: 700; color: #111827; }
          .amount-sub   { font-size: 12px; color: #6b7280; margin-top: 2px; }
          .amount-sub.return { color: #b42318; }
          .amount-sub.net    { color: #027a48; font-weight: 600; }
          .payment-cell { min-width: 210px; }
          .payment-meta { margin-top: 6px; font-size: 12px; color: #6b7280; line-height: 1.25; }
          .payment-progress {
            height: 6px; border-radius: 999px; background: #eef0f3;
            overflow: hidden; margin-top: 6px;
          }
          .payment-progress > span {
            display: block; height: 100%;
            background: #5c3e94; border-radius: 999px;
          }
          .icon-btn-ux {
            width: 32px; height: 32px; border-radius: 8px;
            border: 1px solid #e5e7eb; background: #fff;
            display: inline-flex; align-items: center; justify-content: center;
            transition: all .15s ease;
          }
          .icon-btn-ux:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,.08); }
          .icon-btn-ux.view:hover   { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
          .icon-btn-ux.edit:hover   { color: #7c3aed; border-color: #ddd6fe; background: #f5f3ff; }
          .icon-btn-ux.approve      { border-color: #abefc6; background: #f6fef9; color: #027a48; }
          .icon-btn-ux.approve:hover{ background: #ecfdf3; box-shadow: 0 4px 12px rgba(2,122,72,.18); }
          .icon-btn-ux.delete:hover { color: #b42318; border-color: #fecdca; background: #fef3f2; }
          .filter-grid { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
          .filter-grid .filter-input  { min-width: 220px; }
          .filter-grid .custom-select { min-width: 160px; }
          .btn-soft {
            border: 1px solid #e5e7eb; background: #fff; color: #344054;
            border-radius: 10px; padding: 8px 12px; font-size: 13px;
            font-weight: 600; min-height: 42px; white-space: nowrap;
          }
          .btn-soft:hover { background: #f9fafb; border-color: #d0d5dd; }
          .result-badge {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 10px; border-radius: 999px; background: #f8fafc;
            border: 1px solid #e5e7eb; font-size: 12px; font-weight: 700; color: #475467;
          }
          .table-top-note {
            display: flex; justify-content: space-between; align-items: center;
            gap: 10px; margin-bottom: 10px; flex-wrap: wrap;
          }
          .sort-btn {
            border: none; background: transparent; padding: 0; font-weight: 600;
            display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: inherit;
          }
          .sort-btn:hover { color: #5c3e94; }
        `}
      </style>

      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Sales Invoices</h2>
        <p className="page-subtitle">
          Review, manage, and approve customer sales invoices across all branches.
        </p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search invoice / customer / branch..."
              className="filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="custom-select"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="All">All Customers</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.creditStatus ? `— ${c.creditStatus}` : ""}
                </option>
              ))}
            </select>
            <select
              className="custom-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Invoice Statuses</option>
              <option value="draft">Draft</option>
              <option value="waiting_for_approval">Waiting for Approval</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              className="custom-select"
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="All">All Payment Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>
            {isAdminOrDataEntry && (
              <select
                className="custom-select"
                value={salesRepFilter}
                onChange={(e) => setSalesRepFilter(e.target.value)}
              >
                <option value="All">All Sales Reps</option>
                {salesReps.map((sr) => (
                  <option key={sr._id} value={sr._id}>
                    {sr.repCode ? `${sr.repCode} — ` : ""}
                    {sr.name || sr.fullName || sr.email || "Sales Rep"}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="btn-soft"
              onClick={resetFilters}
              title="Reset all filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>
          </div>
        </div>
        <button className="action-btn" onClick={handleOpenCreate}>
          + Create Invoice
        </button>
      </div>

      {/* Table area */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-receipt-cutoff" />
            {visibleCountLabel}
          </span>
          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="invoice-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("invoiceNo")}>
                    Invoice <i className={`bi ${getSortIcon("invoiceNo")}`} />
                  </button>
                </th>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("customer")}>
                    Customer <i className={`bi ${getSortIcon("customer")}`} />
                  </button>
                </th>
                {isAdminOrDataEntry && (
                  <th>
                    <button className="sort-btn" onClick={() => handleSort("salesRep")}>
                      Sales Rep <i className={`bi ${getSortIcon("salesRep")}`} />
                    </button>
                  </th>
                )}
                <th>
                  <button className="sort-btn" onClick={() => handleSort("amount")}>
                    Amounts <i className={`bi ${getSortIcon("amount")}`} />
                  </button>
                </th>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("payment")}>
                    Payment <i className={`bi ${getSortIcon("payment")}`} />
                  </button>
                </th>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("status")}>
                    Status <i className={`bi ${getSortIcon("status")}`} />
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredInvoices.length ? (
                filteredInvoices.map((inv) => {
                  const statusMeta = getStatusMeta(inv.status);
                  const paymentMeta = getPaymentStatusMeta(inv.paymentStatus);
                  const { originalTotal, returned, netTotal, paid, balance, paidPct } =
                    getInvoiceTotals(inv);

                  return (
                    <tr key={inv._id} className="invoice-row">
                      <td className="col-invoice-main">
                        <div className="invoice-no">{inv.invoiceNo || "-"}</div>
                        <div className="invoice-sub">{formatDate(inv.invoiceDate)}</div>
                      </td>
                      <td>
                        <div className="fw-semibold">{inv.customer?.name || "-"}</div>
                        {inv.customer?.creditStatus ? (
                          <span className={getCustomerCreditClass(inv.customer.creditStatus)}>
                            {inv.customer.creditStatus}
                          </span>
                        ) : null}
                      </td>
                      {isAdminOrDataEntry && (
                        <td>
                          <div className="fw-semibold">
                            {inv.salesRep?.name || inv.salesRep?.fullName || "-"}
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="amount-stack">
                          <div className="amount-main">{formatCurrency(originalTotal)}</div>
                          {returned > 0 ? (
                            <>
                              <div className="amount-sub return">
                                Return: -{formatCurrency(returned)}
                              </div>
                              <div className="amount-sub net">
                                Net: {formatCurrency(netTotal)}
                              </div>
                            </>
                          ) : (
                            <div className="amount-sub">No returns</div>
                          )}
                        </div>
                      </td>
                      <td className="payment-cell">
                        <span className={`status-pill-ux ${paymentMeta.className}`}>
                          <i className={`bi ${paymentMeta.icon}`} />
                          {paymentMeta.label}
                        </span>
                        <div className="payment-meta">
                          <div>Paid: {formatCurrency(paid)}</div>
                          <div>Balance: {formatCurrency(balance)}</div>
                        </div>
                        <div className="payment-progress" title={`Paid ${paidPct.toFixed(0)}%`}>
                          <span style={{ width: `${paidPct}%` }} />
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill-ux ${statusMeta.className}`}>
                          <i className={`bi ${statusMeta.icon}`} />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            className="icon-btn-ux view"
                            title="View Invoice"
                            onClick={() => handleView(inv)}
                          >
                            <i className="bi bi-eye" />
                          </button>
                          {inv.status === "waiting_for_approval" && (
                            <>
                              <button
                                className="icon-btn-ux edit"
                                title="Edit Invoice"
                                onClick={() => handleEdit(inv)}
                              >
                                <i className="bi bi-pencil-square" />
                              </button>
                              <button
                                className="icon-btn-ux delete"
                                title="Delete Invoice"
                                onClick={() => deleteInvoice(inv)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                              {isAdminOrDataEntry && (
                                <button
                                  className="icon-btn-ux approve"
                                  title="Approve Invoice"
                                  onClick={() => approve(inv)}
                                >
                                  <i className="bi bi-check-circle" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={tableColSpan} className="text-center text-muted py-4">
                    {loading ? "Loading invoices..." : "No invoices found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <SalesInvoiceCreateModal
          show={modalOpen}
          mode={modalMode}
          selectedInvoice={selectedInvoice}
          onClose={() => {
            setModalOpen(false);
            setSelectedInvoice(null);
            setModalMode("create");
          }}
          onSuccess={fetchAll}
        />
      )}

      {/* View invoice modal */}
      {invoiceViewOpen && (
        <SalesInvoiceViewModal
          show={invoiceViewOpen}
          invoice={invoiceForView}
          onClose={() => setInvoiceViewOpen(false)}
          onViewReturn={handleViewReturnFromInvoiceModal}
          onOpenPayment={handleOpenPaymentFromInvoice}
        />
      )}

      {/* View payment modal — always view mode, full payment fetched before open */}
      {paymentViewOpen && (
        <PaymentCreateModal
          show={paymentViewOpen}
          mode="view"
          payment={paymentForView}
          onClose={closePaymentViewer}
          onSuccess={() => {}}
        />
      )}

      {/* View return modal */}
      {returnViewOpen && (
        <SalesReturnCreateModal
          show={returnViewOpen}
          mode="view"
          selectedReturn={returnForView}
          onClose={() => setReturnViewOpen(false)}
        />
      )}

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default SalesInvoiceDashboard;