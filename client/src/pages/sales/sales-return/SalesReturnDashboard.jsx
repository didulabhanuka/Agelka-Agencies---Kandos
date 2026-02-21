// src/pages/sales/SalesReturnDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

import {
  listSalesReturns,
  getSalesReturn,
  approveSalesReturn,
  getSalesInvoice,
} from "../../../lib/api/sales.api";

import { listBranches } from "../../../lib/api/settings.api";
import { getCustomers, getSalesReps } from "../../../lib/api/users.api";

import SalesReturnCreateModal from "./SalesReturnCreateModal";
import SalesInvoiceViewModal from "../sales-invoice/SalesInvoiceViewModal";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

const SalesReturnDashboard = () => {
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

  const [returns, setReturns] = useState([]);

  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [salesRepFilter, setSalesRepFilter] = useState("All");

  // ✅ Column sorting (GRN-style)
  const [sortConfig, setSortConfig] = useState({
    key: "returnDate",
    direction: "desc",
  });

  // Modals
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | view

  // Invoice View Modal
  const [invoiceViewOpen, setInvoiceViewOpen] = useState(false);
  const [invoiceForView, setInvoiceForView] = useState(null);

  // Initial load
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrDataEntry]);

  // Fetch all
  const fetchAll = async () => {
    setLoading(true);
    try {
      const requests = [listSalesReturns(), listBranches(), getCustomers()];
      if (isAdminOrDataEntry) requests.push(getSalesReps());

      const results = await Promise.all(requests);

      const retRes = results[0];
      const branchRes = results[1];
      const custRes = results[2];
      const srRes = isAdminOrDataEntry ? results[3] : null;

      const rows = Array.isArray(retRes) ? retRes : retRes?.data || [];

      setReturns(rows);

      setBranches(branchRes?.data || branchRes || []);
      setCustomers(custRes || []);
      setSalesReps(isAdminOrDataEntry ? srRes?.data || srRes || [] : []);

      if (!isAdminOrDataEntry) setSalesRepFilter("All");
    } catch (err) {
      console.error("Failed loading sales return dashboard:", err);
      toast.error("Failed to load sales returns.");
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

  const getReturnSalesRepId = (ret) =>
    ret?.salesRep?._id ||
    ret?.salesRep ||
    ret?.originalInvoice?.salesRep?._id ||
    ret?.originalInvoice?.salesRep ||
    ret?.salesRepId ||
    "";

  const getReturnSalesRepName = (ret) =>
    ret?.salesRep?.name ||
    ret?.salesRep?.fullName ||
    ret?.originalInvoice?.salesRep?.name ||
    ret?.originalInvoice?.salesRep?.fullName ||
    ret?.originalInvoice?.salesRep?.email ||
    ret?.salesRep?.email ||
    "-";

  const getReturnSalesRepCode = (ret) =>
    ret?.salesRep?.repCode || ret?.originalInvoice?.salesRep?.repCode || "";

  const getCustomerCreditClass = (creditStatus) => {
    const value = String(creditStatus || "").toLowerCase();

    if (value.includes("cash")) return "mini-pill neutral";
    if (value.includes("credit")) return "mini-pill info";
    return "mini-pill neutral";
  };

  const getStatusMeta = (status) => {
    switch (status) {
      case "approved":
        return {
          label: "Approved",
          className: "pill-success",
          icon: "bi-check-circle-fill",
        };
      case "cancelled":
        return {
          label: "Cancelled",
          className: "pill-danger",
          icon: "bi-x-circle-fill",
        };
      case "draft":
        return {
          label: "Draft",
          className: "pill-muted",
          icon: "bi-file-earmark-text-fill",
        };
      case "waiting_for_approval":
      default:
        return {
          label: isSalesRep ? "Waiting for Admin Approval" : "Waiting for Approval",
          className: "pill-warning",
          icon: "bi-hourglass-split",
        };
    }
  };

  const getReturnTotal = (ret) =>
    Number(ret?.totalReturnValue || ret?.totalValue || 0);

  // ✅ Sort helpers
  const getSortValue = (ret, key) => {
    switch (key) {
      case "returnNo":
        return String(ret.returnNo || "").toLowerCase();
      case "customer":
        return String(ret.customer?.name || "").toLowerCase();
      case "branch":
        return String(ret.branch?.name || "").toLowerCase();
      case "salesRep":
        return String(
          `${getReturnSalesRepCode(ret)} ${getReturnSalesRepName(ret)}`.trim()
        ).toLowerCase();
      case "invoiceNo":
        return String(ret.originalInvoice?.invoiceNo || "").toLowerCase();
      case "amount":
        return Number(getReturnTotal(ret) || 0);
      case "status":
        return String(ret.status || "").toLowerCase();
      case "returnDate":
        return new Date(ret.returnDate || 0).getTime() || 0;
      default:
        return "";
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key,
        direction: "asc",
      };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "bi-arrow-down-up";
    return sortConfig.direction === "asc" ? "bi-sort-down" : "bi-sort-up";
  };

  // ✅ Filters + sorting via useMemo
  const filteredReturns = useMemo(() => {
    let data = [...returns];
    const s = search.trim().toLowerCase();

    // SalesRep sees own returns only
    if (isSalesRep && loggedInSalesRepId) {
      data = data.filter((ret) => {
        const srId = getReturnSalesRepId(ret);
        return String(srId) === String(loggedInSalesRepId);
      });
    }

    // Search
    if (s) {
      data = data.filter((ret) => {
        const returnNo = ret.returnNo?.toLowerCase() || "";
        const customerName = ret.customer?.name?.toLowerCase() || "";
        const customerCode = ret.customer?.customerCode?.toLowerCase() || "";
        const branchName = ret.branch?.name?.toLowerCase() || "";
        const invoiceNo = ret.originalInvoice?.invoiceNo?.toLowerCase() || "";
        const srName = getReturnSalesRepName(ret).toLowerCase();
        const srCode = getReturnSalesRepCode(ret).toLowerCase();

        return (
          returnNo.includes(s) ||
          customerName.includes(s) ||
          customerCode.includes(s) ||
          branchName.includes(s) ||
          invoiceNo.includes(s) ||
          (isAdminOrDataEntry && (srName.includes(s) || srCode.includes(s)))
        );
      });
    }

    // Customer filter
    if (customerFilter !== "All") {
      data = data.filter((ret) => ret.customer?._id === customerFilter);
    }

    // Branch filter
    if (branchFilter !== "All") {
      data = data.filter((ret) => ret.branch?._id === branchFilter);
    }

    // Status filter
    if (statusFilter !== "All") {
      data = data.filter((ret) => ret.status === statusFilter);
    }

    // Sales rep filter (admin/dataentry only)
    if (isAdminOrDataEntry && salesRepFilter !== "All") {
      data = data.filter((ret) => String(getReturnSalesRepId(ret)) === String(salesRepFilter));
    }

    // Sort
    data.sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [
    returns,
    search,
    customerFilter,
    branchFilter,
    statusFilter,
    salesRepFilter,
    isAdminOrDataEntry,
    isSalesRep,
    loggedInSalesRepId,
    sortConfig,
  ]);

  // Actions
  const openCreateModal = () => {
    setSelectedReturn(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedReturn(null);
    setModalMode("create");
  };

  const handleSuccess = async () => {
    closeModal();
    await fetchAll();
  };

  const handleView = async (ret) => {
    try {
      setLoading(true);
      const full = await getSalesReturn(ret._id);
      setSelectedReturn(full);
      setModalMode("view");
      setModalOpen(true);
    } catch (err) {
      console.error("Failed to load return details:", err);
      toast.error("Failed to load sales return details.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (ret) => {
    if (ret.status !== "waiting_for_approval") {
      toast.info("Only returns waiting for approval can be approved.");
      return;
    }

    if (!window.confirm(`Approve sales return ${ret.returnNo}?`)) return;

    try {
      setLoading(true);
      const res = await approveSalesReturn(ret._id);
      toast.success(res?.message || "Sales return approved successfully.");
      await fetchAll();
    } catch (err) {
      console.error("Failed approving sales return:", err);
      toast.error(err?.response?.data?.message || "Failed to approve sales return.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoiceFromReturnModal = async (invoiceId) => {
    if (!invoiceId) return;

    try {
      setLoading(true);
      const full = await getSalesInvoice(invoiceId);
      setInvoiceForView(full);
      setInvoiceViewOpen(true);
    } catch (err) {
      console.error("Failed loading invoice:", err);
      toast.error("Failed to load original invoice.");
    } finally {
      setLoading(false);
    }
  };

  const closeInvoiceViewModal = () => {
    setInvoiceViewOpen(false);
    setInvoiceForView(null);
  };

  const resetFilters = () => {
    setSearch("");
    setCustomerFilter("All");
    setBranchFilter("All");
    setStatusFilter("All");
    setSalesRepFilter("All");
    setSortConfig({ key: "returnDate", direction: "desc" });
  };

  const tableColSpan = isAdminOrDataEntry ? 9 : 8;

  const visibleCountLabel = useMemo(() => {
    const count = filteredReturns.length;
    return `${count} return${count === 1 ? "" : "s"}`;
  }, [filteredReturns.length]);

  return (
    <div className="container-fluid py-4 px-5">
      {/* Local dashboard styles */}
      <style>
        {`
          .return-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }

          .return-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
          }

          .return-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }

          .return-row:hover {
            background: #fafbff;
            box-shadow: inset 3px 0 0 #5c3e94;
          }

          .col-return-main {
            min-width: 170px;
          }

          .return-no {
            font-weight: 700;
            color: #111827;
            letter-spacing: 0.01em;
          }

          .return-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .mini-pill {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            margin-top: 4px;
            border: 1px solid transparent;
          }

          .mini-pill.neutral {
            background: #f3f4f6;
            color: #4b5563;
            border-color: #e5e7eb;
          }

          .mini-pill.info {
            background: #eff6ff;
            color: #1d4ed8;
            border-color: #bfdbfe;
          }

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
          }

          .status-pill-ux.pill-success {
            background: #ecfdf3;
            color: #027a48;
            border-color: #abefc6;
          }

          .status-pill-ux.pill-warning {
            background: #fffaeb;
            color: #b54708;
            border-color: #fedf89;
          }

          .status-pill-ux.pill-danger {
            background: #fef3f2;
            color: #b42318;
            border-color: #fecdca;
          }

          .status-pill-ux.pill-muted {
            background: #f2f4f7;
            color: #475467;
            border-color: #e4e7ec;
          }

          .amount-stack {
            line-height: 1.25;
            min-width: 160px;
          }

          .amount-main {
            font-weight: 700;
            color: #111827;
          }

          .amount-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .amount-sub.invoice {
            color: #1d4ed8;
          }

          .icon-btn-ux {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            background: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all .15s ease;
          }

          .icon-btn-ux:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(0,0,0,.08);
          }

          .icon-btn-ux.view:hover {
            color: #1d4ed8;
            border-color: #bfdbfe;
            background: #eff6ff;
          }

          .icon-btn-ux.approve {
            border-color: #abefc6;
            background: #f6fef9;
            color: #027a48;
          }

          .icon-btn-ux.approve:hover {
            background: #ecfdf3;
            box-shadow: 0 4px 12px rgba(2,122,72,.18);
          }

          .filter-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
          }

          .filter-grid .filter-input {
            min-width: 220px;
          }

          .filter-grid .custom-select {
            min-width: 160px;
          }

          .result-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            font-size: 12px;
            font-weight: 700;
            color: #475467;
          }

          .table-top-note {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
          }

          /* ✅ Sortable header button */
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

          .sort-btn:hover {
            color: #5c3e94;
          }
        `}
      </style>

      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Sales Returns</h2>
        <p className="page-subtitle">
          Review, manage, and approve customer sales returns across all branches.
        </p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search return / invoice / customer / branch..."
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
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              className="custom-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Return Statuses</option>
              <option value="waiting_for_approval">Waiting for Approval</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
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
              className="btn btn-light border"
              onClick={resetFilters}
              title="Reset all filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>
          </div>
        </div>

        <button className="action-btn" onClick={openCreateModal}>
          + Create Sales Return
        </button>
      </div>

      {/* Table area */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-arrow-return-left" />
            {visibleCountLabel}
          </span>

          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="return-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("returnNo")}>
                    Return <i className={`bi ${getSortIcon("returnNo")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("customer")}>
                    Customer <i className={`bi ${getSortIcon("customer")}`} />
                  </button>
                </th>

                {/* <th>
                  <button className="sort-btn" onClick={() => handleSort("branch")}>
                    Branch <i className={`bi ${getSortIcon("branch")}`} />
                  </button>
                </th> */}

                {isAdminOrDataEntry && (
                  <th>
                    <button className="sort-btn" onClick={() => handleSort("salesRep")}>
                      Sales Rep <i className={`bi ${getSortIcon("salesRep")}`} />
                    </button>
                  </th>
                )}

                <th>
                  <button className="sort-btn" onClick={() => handleSort("invoiceNo")}>
                    Invoice <i className={`bi ${getSortIcon("invoiceNo")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("amount")}>
                    Amount <i className={`bi ${getSortIcon("amount")}`} />
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
              {filteredReturns.length ? (
                filteredReturns.map((ret) => {
                  const statusMeta = getStatusMeta(ret.status);
                  const total = getReturnTotal(ret);

                  return (
                    <tr key={ret._id} className="return-row">
                      {/* Return column */}
                      <td className="col-return-main">
                        <div className="return-no">{ret.returnNo || "-"}</div>
                        <div className="return-sub">{formatDate(ret.returnDate)}</div>
                      </td>

                      {/* Customer */}
                      <td>{ret.customer?.name || "-"}</td>

                      {/* Branch
                      <td>{ret.branch?.name || "-"}</td> */}

                      {/* Sales Rep */}
                      {isAdminOrDataEntry && (
                        <td>{getReturnSalesRepName(ret)}</td>
                      )}

                      {/* Original Invoice */}
                      <td>
                        <div className="fw-semibold">
                          {ret.originalInvoice?.invoiceNo || "-"}
                        </div>
                        <div className="amount-sub invoice">Original Invoice</div>
                      </td>

                      {/* Amount */}
                      <td>{formatCurrency(total)}</td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill-ux ${statusMeta.className}`}>
                          <i className={`bi ${statusMeta.icon}`} />
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            className="icon-btn-ux view"
                            onClick={() => handleView(ret)}
                            title="View Sales Return"
                          >
                            <i className="bi bi-eye" />
                          </button>

                          {isAdminOrDataEntry && ret.status === "waiting_for_approval" && (
                            <button
                              className="icon-btn-ux approve"
                              onClick={() => handleApprove(ret)}
                              title="Approve Sales Return"
                            >
                              <i className="bi bi-check-circle" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={tableColSpan} className="text-center text-muted py-4">
                    {loading ? "Loading sales returns..." : "No sales returns found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return modal */}
      {modalOpen && (
        <SalesReturnCreateModal
          show={modalOpen}
          mode={modalMode}
          selectedReturn={selectedReturn}
          onClose={closeModal}
          onSuccess={handleSuccess}
          onViewInvoice={handleViewInvoiceFromReturnModal}
        />
      )}

      {/* Invoice view modal */}
      {invoiceViewOpen && (
        <SalesInvoiceViewModal
          show={invoiceViewOpen}
          invoice={invoiceForView}
          onClose={closeInvoiceViewModal}
        />
      )}

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default SalesReturnDashboard;