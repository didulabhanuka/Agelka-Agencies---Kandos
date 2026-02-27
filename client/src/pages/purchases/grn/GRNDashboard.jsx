import React, { useEffect, useMemo, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

import {
  listGRN,
  approveGRN,
  getGRN,
  deleteGRN,
} from "../../../lib/api/purchases.api";

import { getSuppliers, getSalesReps } from "../../../lib/api/users.api";
import { listBranches } from "../../../lib/api/settings.api";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

import GRNCreateModal from "./GRNCreateModal";

const GRNDashboard = () => {
  // RBAC
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

  // State
  const [loading, setLoading] = useState(true);

  const [grns, setGRNs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [salesRepFilter, setSalesRepFilter] = useState("All");

  const [sortConfig, setSortConfig] = useState({
    key: "receivedDate",
    direction: "desc",
  });

  const [modalMode, setModalMode] = useState("create");
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrDataEntry]);

  const fetchAll = async () => {
    try {
      setLoading(true);

      const requests = [listGRN(), getSuppliers(), listBranches()];
      if (isAdminOrDataEntry) requests.push(getSalesReps());

      const results = await Promise.all(requests);

      const grnRes = results[0];
      const supRes = results[1];
      const brRes = results[2];
      const srRes = isAdminOrDataEntry ? results[3] : null;

      const grnList = grnRes?.data || grnRes || [];
      setGRNs(grnList);

      setSuppliers((supRes || []).filter((s) => s.status === "active"));
      setBranches(brRes?.data || brRes || []);
      setSalesReps(srRes?.data || srRes || []);

      if (!isAdminOrDataEntry) setSalesRepFilter("All");
    } catch (err) {
      console.error("Failed loading GRNs:", err);
      toast.error("Failed to load GRNs / suppliers / branches.");
    } finally {
      setLoading(false);
    }
  };

  // Status visuals (SalesInvoiceDashboard style)
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
      case "waiting_for_approval":
      default:
        return {
          label: isSalesRep ? "Waiting for Admin Approval" : "Waiting for Approval",
          className: "pill-warning",
          icon: "bi-hourglass-split",
        };
    }
  };

  // Helpers
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

  const getSortValue = (g, key) => {
    switch (key) {
      case "grnNo":
        return String(g.grnNo || "").toLowerCase();
      case "supplier":
        return String(g.supplier?.name || "").toLowerCase();
      case "branch":
        return String(g.branch?.name || "").toLowerCase();
      case "salesRep":
        return String(
          `${g.salesRep?.repCode || ""} ${g.salesRep?.name || ""}`.trim()
        ).toLowerCase();
      case "receivedDate":
        return new Date(g.receivedDate || 0).getTime() || 0;
      case "totalValue":
        return Number(g.totalValue || 0);
      case "status":
        return String(g.status || "").toLowerCase();
      default:
        return "";
    }
  };

  // Filter + sort
  const filteredGRNs = useMemo(() => {
    let data = [...grns];
    const s = search.trim().toLowerCase();

    if (isSalesRep && loggedInSalesRepId) {
      data = data.filter((g) => {
        const grnSalesRepId = g.salesRep?._id || g.salesRep || g.salesRepId || "";
        return String(grnSalesRepId) === String(loggedInSalesRepId);
      });
    }

    if (s) {
      data = data.filter((g) => {
        const grnNo = g.grnNo?.toLowerCase() || "";
        const supplierName = g.supplier?.name?.toLowerCase() || "";
        const branchName = g.branch?.name?.toLowerCase() || "";
        const salesRepName = g.salesRep?.name?.toLowerCase() || "";
        const salesRepCode = g.salesRep?.repCode?.toLowerCase() || "";

        return (
          grnNo.includes(s) ||
          supplierName.includes(s) ||
          branchName.includes(s) ||
          (isAdminOrDataEntry && (salesRepName.includes(s) || salesRepCode.includes(s)))
        );
      });
    }

    if (supplierFilter !== "All") {
      data = data.filter((g) => g.supplier?._id === supplierFilter);
    }

    if (branchFilter !== "All") {
      data = data.filter((g) => g.branch?._id === branchFilter);
    }

    if (statusFilter !== "All") {
      data = data.filter((g) => g.status === statusFilter);
    }

    if (isAdminOrDataEntry && salesRepFilter !== "All") {
      data = data.filter((g) => {
        const grnSalesRepId = g.salesRep?._id || g.salesRep || g.salesRepId || "";
        return String(grnSalesRepId) === String(salesRepFilter);
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
    grns,
    search,
    supplierFilter,
    branchFilter,
    statusFilter,
    salesRepFilter,
    isAdminOrDataEntry,
    isSalesRep,
    loggedInSalesRepId,
    sortConfig,
  ]);

  // Actions
  const handleApproveGRN = async (grn) => {
    if (grn.status !== "waiting_for_approval") {
      toast.info("Only GRNs waiting for approval can be approved.");
      return;
    }

    if (!window.confirm(`Approve GRN ${grn.grnNo}?`)) return;

    try {
      setLoading(true);
      await approveGRN(grn._id);
      await fetchAll();
      toast.success(`GRN ${grn.grnNo} approved successfully.`);
    } catch (err) {
      console.error("Approval failed:", err);
      toast.error(err?.response?.data?.message || "Failed to approve GRN.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGRN = async (grn) => {
    if (grn.status !== "waiting_for_approval") {
      toast.info("Only GRNs waiting for approval can be deleted.");
      return;
    }

    if (!window.confirm(`Delete GRN ${grn.grnNo}?`)) return;

    try {
      setLoading(true);
      await deleteGRN(grn._id);
      await fetchAll();
      toast.success(`GRN ${grn.grnNo} deleted successfully.`);
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error(err?.response?.data?.message || "Failed to delete GRN.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (mode, grn = null) => {
    setModalMode(mode);
    setLoading(true);

    try {
      if (grn?._id && (mode === "view" || mode === "edit")) {
        const response = await getGRN(grn._id);
        const latest = response?.data || response;
        setSelectedGRN(latest);
      } else {
        setSelectedGRN(null);
      }

      setModalOpen(true);
    } catch (err) {
      console.error("Failed loading GRN details:", err);
      toast.error("Failed to load GRN details.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedGRN(null);
  };

  // Sorting UI
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

  const resetFilters = () => {
    setSearch("");
    setSupplierFilter("All");
    setBranchFilter("All");
    setStatusFilter("All");
    setSalesRepFilter("All");
    setSortConfig({ key: "receivedDate", direction: "desc" });
  };

  const tableColSpan = isAdminOrDataEntry ? 6 : 5;

  const visibleCountLabel = useMemo(() => {
    const count = filteredGRNs.length;
    return `${count} GRN${count === 1 ? "" : "s"}`;
  }, [filteredGRNs.length]);

  return (
    <div className="container-fluid py-4 px-5">
      {/* Local dashboard styles (same vibe as SalesInvoiceDashboard) */}
      <style>
        {`
          .grn-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }

          .grn-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
          }

          .grn-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }

          .grn-row:hover {
            background: #fafbff;
            box-shadow: inset 3px 0 0 #5c3e94;
          }

          .grn-no {
            font-weight: 700;
            color: #111827;
            letter-spacing: 0.01em;
          }

          .grn-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .supplier-cell .supplier-name {
            font-weight: 600;
            color: #111827;
          }

          .supplier-cell .supplier-sub {
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
            min-width: 240px;
          }

          .filter-grid .custom-select {
            min-width: 160px;
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

      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Goods Received Notes (GRNs)</h2>
        <p className="page-subtitle">Review, approve, and manage all received goods.</p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search GRN / supplier / branch..."
              className="filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="custom-select"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="All">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
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
              <option value="All">All Statuses</option>
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
              className="btn-soft"
              onClick={resetFilters}
              title="Reset all filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>
          </div>
        </div>

        <button className="action-btn" onClick={() => handleOpenModal("create")}>
          + Create GRN
        </button>
      </div>

      {/* Table area */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-box-seam" />
            {visibleCountLabel}
          </span>

          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="grn-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("grnNo")}>
                    GRN <i className={`bi ${getSortIcon("grnNo")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("supplier")}>
                    Supplier <i className={`bi ${getSortIcon("supplier")}`} />
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
              {filteredGRNs.length ? (
                filteredGRNs.map((g) => {
                  const statusMeta = getStatusMeta(g.status);

                  return (
                    <tr key={g._id} className="grn-row">
                      <td>
                        <div className="grn-no">{g.grnNo || "-"}</div>
                        <div className="grn-sub">{formatDate(g.receivedDate)}</div>
                      </td>

                      <td>
                        <div className="supplier-cell">
                          <div className="supplier-name">{g.supplier?.name || "-"}</div>
                          {g.branch?.name ? (
                            <div className="supplier-sub">{g.branch.name}</div>
                          ) : null}
                        </div>
                      </td>

                      {isAdminOrDataEntry && (
                        <td>
                          <div className="fw-semibold">
                            {g.salesRep?.name || g.salesRep?.fullName || "-"}
                          </div>
                        </td>
                      )}

                      <td>
                        <div className="amount-main">{formatCurrency(g.totalValue)}</div>
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
                            title="View GRN"
                            onClick={() => handleOpenModal("view", g)}
                          >
                            <i className="bi bi-eye" />
                          </button>

                          {g.status === "waiting_for_approval" && (
                            <>
                              <button
                                className="icon-btn-ux edit"
                                title="Edit GRN"
                                onClick={() => handleOpenModal("edit", g)}
                              >
                                <i className="bi bi-pencil-square" />
                              </button>

                              <button
                                className="icon-btn-ux delete"
                                title="Delete GRN"
                                onClick={() => handleDeleteGRN(g)}
                              >
                                <i className="bi bi-trash" />
                              </button>

                              {isAdminOrDataEntry && (
                                <button
                                  className="icon-btn-ux approve"
                                  title="Approve GRN"
                                  onClick={() => handleApproveGRN(g)}
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
                    {loading ? "Loading GRNs..." : "No GRNs found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GRNCreateModal
        show={modalOpen}
        mode={modalMode}
        selectedGRN={selectedGRN}
        onClose={handleCloseModal}
        onSuccess={fetchAll}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default GRNDashboard;