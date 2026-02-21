// src/pages/finance/CustomerPaymentsDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";

import {
  listCustomerPayments,
  getCustomerPayment,
  deleteCustomerPayment,
} from "../../lib/api/finance.api";

import { getCustomers, getSalesReps } from "../../lib/api/users.api";

import PaymentCreateModal from "./PaymentCreateModal";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const CustomerPaymentsDashboard = () => {
  // --------------------------------------------------
  // RBAC
  // --------------------------------------------------
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

  // --------------------------------------------------
  // State
  // --------------------------------------------------
  const [loading, setLoading] = useState(true);

  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [repFilter, setRepFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");

  // Sort (new dashboard style)
  const [sortConfig, setSortConfig] = useState({
    key: "paymentDate",
    direction: "desc",
  });

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | view
  const [selectedPayment, setSelectedPayment] = useState(null);

  // --------------------------------------------------
  // Initial Load
  // --------------------------------------------------
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrDataEntry]);

  // --------------------------------------------------
  // Fetch Data
  // --------------------------------------------------
  const fetchAll = async () => {
    try {
      setLoading(true);

      const reqs = [listCustomerPayments(), getCustomers()];
      if (isAdminOrDataEntry) reqs.push(getSalesReps());

      const results = await Promise.all(reqs);

      const payList = results[0];
      const custList = results[1];
      const repList = isAdminOrDataEntry ? results[2] : [];

      const safePay = Array.isArray(payList) ? payList : payList?.data || [];
      const safeCustomers = Array.isArray(custList) ? custList : custList?.data || [];
      const safeReps = Array.isArray(repList) ? repList : repList?.data || [];

      setPayments(Array.isArray(safePay) ? safePay : []);
      setCustomers(Array.isArray(safeCustomers) ? safeCustomers : []);
      setSalesReps(Array.isArray(safeReps) ? safeReps : []);

      if (!isAdminOrDataEntry) setRepFilter("All");
    } catch (err) {
      console.error("❌ Failed to load payments:", err);
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const normalizeId = (v) => (typeof v === "object" && v !== null ? v._id : v);

  const findCustomer = (id) => customers.find((c) => c._id === normalizeId(id));
  const findRep = (id) => salesReps.find((r) => r._id === normalizeId(id));

  const getCustomerLabel = (customerId) => {
    const c = findCustomer(customerId);
    return c ? `${c.customerCode || ""}${c.customerCode ? " — " : ""}${c.name || "-"}` : "-";
  };

  const getRepLabel = (repId) => {
    if (!isAdminOrDataEntry) return "-";
    const r = findRep(repId);
    return r ? `${r.repCode || ""}${r.repCode ? " — " : ""}${r.name || "-"}` : "-";
  };

  const getMethodMeta = (method) => {
    switch (method) {
      case "cash":
        return { label: "Cash", icon: "bi-cash-stack", className: "pill-success" };
      case "cheque":
        return { label: "Cheque", icon: "bi-receipt", className: "pill-warning" };
      case "bank-transfer":
        return { label: "Bank Transfer", icon: "bi-bank", className: "pill-info" };
      case "other":
      default:
        return { label: "Other", icon: "bi-wallet2", className: "pill-muted" };
    }
  };

  const getCustomerCreditClass = (creditStatus) => {
    const value = String(creditStatus || "").toLowerCase();
    if (value.includes("cash")) return "mini-pill neutral";
    if (value.includes("credit")) return "mini-pill info";
    return "mini-pill neutral";
  };

  const formatAmount = (n) => {
    const num = Number(n || 0);
    return `Rs. ${new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)}`;
  };

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const getSortValue = (p, key) => {
    switch (key) {
      case "paymentNo":
        return String(p.paymentNo || "").toLowerCase();
      case "customer":
        return String(getCustomerLabel(p.customer) || "").toLowerCase();
      case "paymentDate":
        return new Date(p.paymentDate || 0).getTime() || 0;
      case "method":
        return String(p.method || "").toLowerCase();
      case "amount":
        return Number(p.amount || 0);
      case "collector":
        return String(getRepLabel(p.collectedBy) || "").toLowerCase();
      case "allocations":
        return Number(p.allocations?.length || 0);
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
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "bi-arrow-down-up";
    return sortConfig.direction === "asc" ? "bi-sort-down" : "bi-sort-up";
  };

  // --------------------------------------------------
  // Filter + Sort (new style with useMemo)
  // --------------------------------------------------
  const filteredPayments = useMemo(() => {
    let data = [...payments];

    // SalesRep only sees own collected payments
    if (isSalesRep && loggedInSalesRepId) {
      data = data.filter(
        (p) => String(normalizeId(p.collectedBy)) === String(loggedInSalesRepId)
      );
    }

    const s = search.trim().toLowerCase();
    if (s) {
      data = data.filter((p) => {
        const paymentNo = p.paymentNo?.toLowerCase() || "";
        const customerLabel = getCustomerLabel(p.customer).toLowerCase();
        const repLabel = isAdminOrDataEntry ? getRepLabel(p.collectedBy).toLowerCase() : "";
        const refNo = String(p.referenceNo || "").toLowerCase();

        return (
          paymentNo.includes(s) ||
          customerLabel.includes(s) ||
          refNo.includes(s) ||
          (isAdminOrDataEntry && repLabel.includes(s))
        );
      });
    }

    if (customerFilter !== "All") {
      data = data.filter((p) => String(normalizeId(p.customer)) === String(customerFilter));
    }

    if (isAdminOrDataEntry && repFilter !== "All") {
      data = data.filter((p) => String(normalizeId(p.collectedBy)) === String(repFilter));
    }

    if (methodFilter !== "All") {
      data = data.filter((p) => p.method === methodFilter);
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
    payments,
    search,
    customerFilter,
    repFilter,
    methodFilter,
    isAdminOrDataEntry,
    isSalesRep,
    loggedInSalesRepId,
    sortConfig,
    customers,
    salesReps,
  ]);

  const resetFilters = () => {
    setSearch("");
    setCustomerFilter("All");
    setRepFilter("All");
    setMethodFilter("All");
    setSortConfig({ key: "paymentDate", direction: "desc" });
  };

  const visibleCountLabel = useMemo(() => {
    const count = filteredPayments.length;
    return `${count} payment${count === 1 ? "" : "s"}`;
  }, [filteredPayments.length]);

  // --------------------------------------------------
  // Modal Handlers
  // --------------------------------------------------
  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedPayment(null);
    setModalOpen(true);
  };

  const handleView = async (payment) => {
    try {
      setLoading(true);
      const data = await getCustomerPayment(payment._id);
      setSelectedPayment(data?.data || data);
      setModalMode("view");
      setModalOpen(true);
    } catch (err) {
      console.error("❌ Failed loading payment:", err);
      toast.error("Failed to load payment details");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (payment) => {
    if (!isAdminOrDataEntry) return;
    if (!window.confirm("Delete this payment? This cannot be undone.")) return;

    try {
      setLoading(true);
      await deleteCustomerPayment(payment._id);
      toast.success("Payment deleted");
      await fetchAll();
    } catch (err) {
      console.error("❌ Delete failed:", err);
      toast.error("Failed to delete payment");
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPayment(null);
  };

  const colSpan = isAdminOrDataEntry ? 8 : 7;

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5">
      <style>
        {`
          .payments-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }

          .payments-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
          }

          .payment-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }

          .payment-row:hover {
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

          .sort-btn:hover {
            color: #5c3e94;
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
            min-width: 170px;
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

          .status-pill-ux.pill-info {
            background: #eff6ff;
            color: #1d4ed8;
            border-color: #bfdbfe;
          }

          .status-pill-ux.pill-muted {
            background: #f2f4f7;
            color: #475467;
            border-color: #e4e7ec;
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

          .icon-btn-ux.delete:hover {
            color: #b42318;
            border-color: #fecdca;
            background: #fef3f2;
          }

          .pay-no {
            font-weight: 700;
            color: #111827;
            letter-spacing: 0.01em;
          }

          .pay-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
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
        `}
      </style>

      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Customer Payments</h2>
        <p className="page-subtitle">
          Review, create, and manage customer payments & invoice allocations.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search payment / customer / collector..."
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
                  {c.customerCode} — {c.name}
                </option>
              ))}
            </select>

            {isAdminOrDataEntry && (
              <select
                className="custom-select"
                value={repFilter}
                onChange={(e) => setRepFilter(e.target.value)}
              >
                <option value="All">All Collectors</option>
                {salesReps.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.repCode} — {r.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="custom-select"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="All">All Methods</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="bank-transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>

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

        <button className="action-btn" onClick={handleOpenCreate}>
          + Record Payment
        </button>
      </div>

      {/* Table */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-cash-coin" />
            {visibleCountLabel}
          </span>

          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="payments-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("paymentNo")}>
                    Payment <i className={`bi ${getSortIcon("paymentNo")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("customer")}>
                    Customer <i className={`bi ${getSortIcon("customer")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("method")}>
                    Method <i className={`bi ${getSortIcon("method")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("amount")}>
                    Amount <i className={`bi ${getSortIcon("amount")}`} />
                  </button>
                </th>

                {isAdminOrDataEntry && (
                  <th>
                    <button className="sort-btn" onClick={() => handleSort("collector")}>
                      Collected By <i className={`bi ${getSortIcon("collector")}`} />
                    </button>
                  </th>
                )}

                <th>
                  <button className="sort-btn" onClick={() => handleSort("allocations")}>
                    Allocations <i className={`bi ${getSortIcon("allocations")}`} />
                  </button>
                </th>

                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.length ? (
                filteredPayments.map((p) => {
                  const cust = findCustomer(p.customer);
                  const methodMeta = getMethodMeta(p.method);
                  const allocationsCount = p.allocations?.length || 0;

                  return (
                    <tr key={p._id} className="payment-row">
                      {/* Payment */}
                      <td>
                        <div className="pay-no">{p.paymentNo || "-"}</div>
                        <div className="pay-sub">{formatDate(p.paymentDate)}</div>
                      </td>

                      {/* Customer */}
                      <td>
                        <div className="fw-semibold">{getCustomerLabel(p.customer)}</div>
                        {cust?.creditStatus ? (
                          <span className={getCustomerCreditClass(cust.creditStatus)}>
                            {cust.creditStatus}
                          </span>
                        ) : null}
                      </td>

                      {/* Method */}
                      <td>
                        <span className={`status-pill-ux ${methodMeta.className}`}>
                          <i className={`bi ${methodMeta.icon}`} />
                          {methodMeta.label}
                        </span>
                      </td>

                      {/* Amount */}
                      <td>
                        <div className="amount-main">{formatAmount(p.amount)}</div>
                        {p.referenceNo ? (
                          <div className="amount-sub">Ref: {p.referenceNo}</div>
                        ) : (
                          <div className="amount-sub">No reference</div>
                        )}
                      </td>

                      {/* Collector */}
                      {isAdminOrDataEntry && (
                        <td>
                          <div className="fw-semibold">{getRepLabel(p.collectedBy)}</div>
                        </td>
                      )}

                      {/* Allocations */}
                      <td>
                        <div className="fw-semibold">{allocationsCount} invoice(s)</div>
                        <div className="amount-sub">
                          {allocationsCount > 0 ? "Allocated" : "Unallocated"}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            className="icon-btn-ux view"
                            title="View Payment"
                            onClick={() => handleView(p)}
                          >
                            <i className="bi bi-eye" />
                          </button>

                          {isAdminOrDataEntry && (
                            <button
                              className="icon-btn-ux delete"
                              title="Delete Payment"
                              onClick={() => handleDelete(p)}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={colSpan} className="text-center text-muted py-4">
                    {loading ? "Loading payments..." : "No payments found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <PaymentCreateModal
        show={modalOpen}
        mode={modalMode}
        payment={selectedPayment}
        onClose={closeModal}
        onSuccess={fetchAll}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default CustomerPaymentsDashboard;