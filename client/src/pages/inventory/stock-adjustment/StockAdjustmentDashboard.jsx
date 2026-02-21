// src/pages/inventory/StockAdjustmentDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext"; // same as SalesInvoiceDashboard

import {
  listAdjustments,
  getAdjustment,
  approveAdjustment,
  deleteAdjustment,
} from "../../../lib/api/inventory.api";

import { listBranches } from "../../../lib/api/settings.api";
import { getSalesReps } from "../../../lib/api/users.api"; // Admin/DataEntry only

import StockAdjustmentCreateModal from "./StockAdjustmentCreateModal";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const StockAdjustmentDashboard = () => {
  // --------------------------------------------------
  // RBAC (Role-based conditional UI)
  // --------------------------------------------------
  const { user } = useAuth();
  const actorType = user?.actorType; // "User" | "SalesRep"
  const role = user?.role; // "Admin" | "DataEntry" | "SalesRep"

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  const isSalesRep = actorType === "SalesRep";

  const salesRepId =
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

  const [adjustments, setAdjustments] = useState([]);
  const [branches, setBranches] = useState([]);

  // Admin/DataEntry only
  const [salesReps, setSalesReps] = useState([]);
  const [salesRepFilter, setSalesRepFilter] = useState("All");

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // ✅ Column sorting
  const [sortConfig, setSortConfig] = useState({
    key: "adjustmentDate",
    direction: "desc",
  });

  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | view | edit

  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrDataEntry]);

  // --------------------------------------------------
  // Fetch data
  // --------------------------------------------------
  const fetchAll = async () => {
    try {
      setLoading(true);

      const reqs = [listAdjustments(), listBranches()];
      if (isAdminOrDataEntry) reqs.push(getSalesReps());

      const res = await Promise.all(reqs);

      const adjRes = res[0];
      const branchRes = res[1];
      const repsRes = isAdminOrDataEntry ? res[2] : null;

      const adjList = adjRes?.data || adjRes || [];
      setAdjustments(Array.isArray(adjList) ? adjList : []);

      const branchList = branchRes?.data || branchRes || [];
      setBranches(Array.isArray(branchList) ? branchList : []);

      if (isAdminOrDataEntry) {
        const list = repsRes?.data || repsRes || [];
        setSalesReps(Array.isArray(list) ? list : []);
      } else {
        setSalesReps([]);
        setSalesRepFilter("All");
      }
    } catch (err) {
      console.error("❌ Failed to load stock adjustments:", err);
      toast.error("Failed to load stock adjustments.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const getStatusMeta = (status) => {
    switch (status) {
      case "approved":
        return {
          label: "Approved",
          icon: "bi-check-circle-fill",
          className: "pill-success",
        };
      case "waiting_for_approval":
        return {
          label: isSalesRep ? "Waiting for Admin Approval" : "Waiting for Approval",
          icon: "bi-hourglass-split",
          className: "pill-warning",
        };
      case "cancelled":
        return {
          label: "Cancelled",
          icon: "bi-x-circle-fill",
          className: "pill-danger",
        };
      default:
        return {
          label: status || "-",
          icon: "bi-question-circle-fill",
          className: "pill-muted",
        };
    }
  };

  const getTypeLabel = (type) => {
    if (!type) return "-";
    return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getTypeMeta = (type) => {
    const t = String(type || "").toLowerCase();
    const isIn =
      t.includes("receive") ||
      t.includes("return") ||
      t.includes("add") ||
      t.includes("increase");

    return {
      icon: isIn ? "bi-arrow-down-left-circle" : "bi-arrow-up-right-circle",
      className: isIn ? "type-pill in" : "type-pill out",
      label: getTypeLabel(type),
    };
  };

  const formatSalesRep = (sr) => {
    if (!sr) return "-";
    return `${sr.name || sr.fullName || sr.email || "-"}`;
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

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    return `Rs. ${new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)}`;
  };

  // ✅ Sort helpers
  const getSortValue = (a, key) => {
    switch (key) {
      case "adjustmentNo":
        return String(a.adjustmentNo || "").toLowerCase();
      case "branch":
        return String(a.branch?.name || "").toLowerCase();
      case "salesRep":
        return String(
          `${a.salesRep?.repCode || ""} ${a.salesRep?.name || a.salesRep?.fullName || ""}`.trim()
        ).toLowerCase();
      case "adjustmentDate":
        return new Date(a.adjustmentDate || 0).getTime() || 0;
      case "type":
        return String(a.type || "").toLowerCase();
      case "totalValue":
        return Number(a.totalValue || 0);
      case "status":
        return String(a.status || "").toLowerCase();
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

  // --------------------------------------------------
  // Filters + sorting (RBAC + UI filters)
  // --------------------------------------------------
  const filteredAdjustments = useMemo(() => {
    let data = [...adjustments];
    const q = search.trim().toLowerCase();

    // ✅ SalesRep only sees own adjustments
    if (isSalesRep && salesRepId) {
      data = data.filter((a) => {
        const sr = a.salesRep?._id || a.salesRep || a.salesRepId || "";
        return String(sr) === String(salesRepId);
      });
    }

    // Search
    if (q) {
      data = data.filter((a) => {
        const adjNo = a.adjustmentNo?.toLowerCase() || "";
        const branchName = a.branch?.name?.toLowerCase() || "";
        const remarks = a.remarks?.toLowerCase() || "";

        const srName = isAdminOrDataEntry ? a.salesRep?.name?.toLowerCase() || "" : "";
        const srCode = isAdminOrDataEntry ? a.salesRep?.repCode?.toLowerCase() || "" : "";

        return (
          adjNo.includes(q) ||
          branchName.includes(q) ||
          remarks.includes(q) ||
          (isAdminOrDataEntry && (srName.includes(q) || srCode.includes(q)))
        );
      });
    }

    if (branchFilter !== "All") {
      data = data.filter((a) => a.branch?._id === branchFilter);
    }

    if (statusFilter !== "All") {
      data = data.filter((a) => a.status === statusFilter);
    }

    // ✅ Admin/DataEntry only: SalesRep filter
    if (isAdminOrDataEntry && salesRepFilter !== "All") {
      data = data.filter((a) => {
        const sr = a.salesRep?._id || a.salesRep || a.salesRepId || "";
        return String(sr) === String(salesRepFilter);
      });
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
    adjustments,
    search,
    branchFilter,
    statusFilter,
    salesRepFilter,
    isAdminOrDataEntry,
    isSalesRep,
    salesRepId,
    sortConfig,
  ]);

  // --------------------------------------------------
  // Actions
  // --------------------------------------------------
  const handleView = async (adj) => {
    try {
      setLoading(true);
      const res = await getAdjustment(adj._id);
      setSelectedAdjustment(res?.data || res);
      setModalMode("view");
      setModalOpen(true);
    } catch (err) {
      console.error("❌ Failed to load adjustment:", err);
      toast.error("Failed to load adjustment details.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (adj) => {
    try {
      setLoading(true);
      const res = await getAdjustment(adj._id);
      setSelectedAdjustment(res?.data || res);
      setModalMode("edit");
      setModalOpen(true);
    } catch (err) {
      console.error("❌ Failed to load adjustment for editing:", err);
      toast.error("Failed to load adjustment for editing.");
    } finally {
      setLoading(false);
    }
  };

  // Approve (Admin/DataEntry only)
  const handleApprove = async (adj) => {
    if (!isAdminOrDataEntry) return;

    if (adj.status !== "waiting_for_approval") {
      toast.info("Only adjustments waiting for approval can be approved.");
      return;
    }

    if (!window.confirm(`Approve adjustment ${adj.adjustmentNo}?`)) return;

    try {
      setLoading(true);
      const res = await approveAdjustment(adj._id);
      const updated = res?.data || res;
      toast.success(`Adjustment ${updated?.adjustmentNo || ""} approved ✅`);
      await fetchAll();
    } catch (err) {
      console.error("❌ Approval failed:", err);
      toast.error(err?.response?.data?.message || "Approval failed.");
    } finally {
      setLoading(false);
    }
  };

  // Delete (only when waiting_for_approval)
  const handleDelete = async (adj) => {
    if (adj.status !== "waiting_for_approval") {
      toast.info("Only adjustments waiting for approval can be deleted.");
      return;
    }
    if (!window.confirm(`Delete adjustment ${adj.adjustmentNo}?`)) return;

    try {
      setLoading(true);
      await deleteAdjustment(adj._id);
      toast.success(`Adjustment ${adj.adjustmentNo} deleted.`);
      await fetchAll();
    } catch (err) {
      console.error("❌ Failed to delete adjustment:", err);
      toast.error(err?.response?.data?.message || "Failed to delete adjustment.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Modal helpers
  // --------------------------------------------------
  const openCreateModal = () => {
    setSelectedAdjustment(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedAdjustment(null);
  };

  const handleSuccess = async () => {
    closeModal();
    await fetchAll();
  };

  const resetFilters = () => {
    setSearch("");
    setBranchFilter("All");
    setStatusFilter("All");
    setSalesRepFilter("All");
    setSortConfig({ key: "adjustmentDate", direction: "desc" });
  };

  const visibleCountLabel = useMemo(() => {
    const count = filteredAdjustments.length;
    return `${count} adjustment${count === 1 ? "" : "s"}`;
  }, [filteredAdjustments.length]);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  const colSpan = isAdminOrDataEntry ? 7 : 6;

  return (
    <div className="container-fluid py-4 px-5">
      {/* Local UI polish styles (SalesInvoiceDashboard style) */}
      <style>
        {`
          .adjustment-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }

          .adjustment-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
          }

          .adjustment-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }

          .adjustment-row:hover {
            background: #fafbff;
            box-shadow: inset 3px 0 0 #5c3e94;
          }

          .adj-no {
            font-weight: 700;
            color: #111827;
            letter-spacing: 0.01em;
          }

          .adj-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .branch-cell .branch-name {
            font-weight: 600;
            color: #111827;
          }

          .branch-cell .branch-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
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

          .type-pill {
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

          .type-pill.in {
            background: #ecfdf3;
            color: #027a48;
            border-color: #abefc6;
          }

          .type-pill.out {
            background: #eef2ff;
            color: #4338ca;
            border-color: #c7d2fe;
          }

          .amount-main {
            font-weight: 700;
            color: #111827;
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

          .icon-btn-ux.edit:hover {
            color: #7c3aed;
            border-color: #ddd6fe;
            background: #f5f3ff;
          }

          .icon-btn-ux.delete:hover {
            color: #b42318;
            border-color: #fecdca;
            background: #fef3f2;
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

      <div className="pb-4">
        <h2 className="page-title">Stock Adjustments</h2>
        <p className="page-subtitle">
          Review, approve, and manage stock adjustment entries across branches.
        </p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search adjustment..."
              className="filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

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
              <option value="All">All Statuses</option>
              <option value="waiting_for_approval">Waiting for Approval</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* ✅ Admin/DataEntry only: Sales Rep filter */}
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
          + Create Adjustment
        </button>
      </div>

      {/* Table */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-sliders" />
            {visibleCountLabel}
          </span>

          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="adjustment-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("adjustmentNo")}>
                    Adj No <i className={`bi ${getSortIcon("adjustmentNo")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("branch")}>
                    Branch <i className={`bi ${getSortIcon("branch")}`} />
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
                  <button className="sort-btn" onClick={() => handleSort("type")}>
                    Type <i className={`bi ${getSortIcon("type")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("totalValue")}>
                    Total Value <i className={`bi ${getSortIcon("totalValue")}`} />
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
              {filteredAdjustments.length ? (
                filteredAdjustments.map((adj) => {
                  const typeMeta = getTypeMeta(adj.type);
                  const statusMeta = getStatusMeta(adj.status);

                  return (
                    <tr key={adj._id} className="adjustment-row">
                      {/* Adj No */}
                      <td>
                        <div className="adj-no">{adj.adjustmentNo || "-"}</div>
                        <div className="adj-sub">{formatDate(adj.adjustmentDate)}</div>
                      </td>

                      {/* Branch */}
                      <td>
                        <div className="branch-cell">
                          <div className="branch-name">{adj.branch?.name || "-"}</div>
                        </div>
                      </td>

                      {/* Admin/DataEntry only */}
                      {isAdminOrDataEntry && (
                        <td>
                          <div className="fw-semibold">{formatSalesRep(adj.salesRep)}</div>
                        </td>
                      )}

                      {/* Type */}
                      <td>
                        <span className={typeMeta.className}>
                          <i className={`bi ${typeMeta.icon}`} />
                          {typeMeta.label}
                        </span>
                      </td>

                      {/* Total Value */}
                      <td>
                        <div className="amount-main">{formatCurrency(adj.totalValue)}</div>
                      </td>

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
                            title="View"
                            onClick={() => handleView(adj)}
                          >
                            <i className="bi bi-eye" />
                          </button>

                          {adj.status === "waiting_for_approval" && (
                            <>
                              <button
                                className="icon-btn-ux edit"
                                title="Edit"
                                onClick={() => handleEdit(adj)}
                              >
                                <i className="bi bi-pencil-square" />
                              </button>

                              {isAdminOrDataEntry && (
                                <button
                                  className="icon-btn-ux approve"
                                  title="Approve"
                                  onClick={() => handleApprove(adj)}
                                >
                                  <i className="bi bi-check-circle" />
                                </button>
                              )}

                              <button
                                className="icon-btn-ux delete"
                                title="Delete"
                                onClick={() => handleDelete(adj)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={colSpan} className="text-center text-muted py-4">
                    {loading ? "Loading stock adjustments..." : "No stock adjustments found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <StockAdjustmentCreateModal
          show={modalOpen}
          mode={modalMode}
          selectedAdjustment={selectedAdjustment}
          onClose={closeModal}
          onSuccess={handleSuccess}
          actorType={actorType}
          salesRepId={isSalesRep ? salesRepId : null}
        />
      )}

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default StockAdjustmentDashboard;