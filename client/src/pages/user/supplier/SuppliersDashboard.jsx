// src/pages/SuppliersDashboard.jsx
import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { getSuppliers, deleteSupplier } from "../../../lib/api/users.api";
import SupplierModal from "./SupplierModal";

import "react-toastify/dist/ReactToastify.css";

const SuppliersDashboard = () => {
  // --------------------------------------------------
  // RBAC
  // --------------------------------------------------
  const { user } = useAuth();
  const actorType = user?.actorType;
  const role = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  const isSalesRep = actorType === "SalesRep";

  // --------------------------------------------------
  // Local state
  // --------------------------------------------------
  const [loading, setLoading] = useState(true);

  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [owners, setOwners] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | edit | view
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // --------------------------------------------------
  // Initial Load
  // --------------------------------------------------
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Re-filter when filters or data change
  useEffect(() => {
    applyFilters();
  }, [suppliers, search, statusFilter, ownerFilter]);

  // --------------------------------------------------
  // API: Fetch All Suppliers
  // --------------------------------------------------
  const fetchSuppliers = async () => {
    try {
      const data = await getSuppliers();
      const list = Array.isArray(data) ? data : [];

      setSuppliers(list);
      setFilteredSuppliers(list);

      // Unique owner list
      const uniqueOwners = [
        ...new Set(
          list
            .map((s) => s.owner)
            .filter((o) => typeof o === "string" && o.trim() !== "")
        ),
      ];
      setOwners(uniqueOwners);
    } catch (err) {
      console.error("❌ Failed fetch suppliers:", err);
      toast.error("Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Apply Search + Status + Owner Filters
  // --------------------------------------------------
  const applyFilters = () => {
    let data = [...suppliers];

    // Search
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.supplierCode?.toLowerCase().includes(s) ||
          r.name?.toLowerCase().includes(s) ||
          r.owner?.toLowerCase().includes(s)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      data = data.filter((r) => (r.status || "active") === statusFilter);
    }

    // Owner filter
    if (ownerFilter !== "All") {
      data = data.filter((r) => r.owner === ownerFilter);
    }

    setFilteredSuppliers(data);
  };

  // --------------------------------------------------
  // Modal Controls
  // --------------------------------------------------
  const handleOpenModal = (mode, supplier = null) => {
    setModalMode(mode);
    setSelectedSupplier(supplier);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedSupplier(null);
  };

  // --------------------------------------------------
  // Delete Supplier
  // --------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;

    try {
      await deleteSupplier(id);
      toast.success("Supplier deleted successfully");
      fetchSuppliers();
    } catch (err) {
      console.error("❌ Delete supplier failed:", err);
      toast.error("Failed to delete supplier");
    }
  };

  // --------------------------------------------------
  // Helper: Status Formatting
  // --------------------------------------------------
  const getStatusClass = (status) =>
    (status || "active") === "inactive" ? "pill-danger" : "pill-success";

  const getStatusLabel = (status) =>
    (status || "active") === "inactive" ? "Inactive" : "Active";

  const getStatusIcon = (status) =>
    (status || "active") === "inactive"
      ? "bi-x-circle-fill"
      : "bi-check-circle-fill";

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">
      <style>{`
        .suppliers-table-wrap {
          max-height: 72vh;
          overflow: auto;
          border-radius: 14px;
        }

        .suppliers-table-wrap .modern-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #fff;
          box-shadow: inset 0 -1px 0 #eef0f3;
          white-space: nowrap;
        }

        .supplier-row {
          transition: background-color .15s ease, box-shadow .15s ease;
        }

        .supplier-row:hover {
          background: #fafbff;
          box-shadow: inset 3px 0 0 #5c3e94;
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
          cursor: pointer;
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

        .status-pill-ux.pill-danger {
          background: #fef3f2;
          color: #b42318;
          border-color: #fecdca;
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
      `}</style>

      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Suppliers</h2>
        <p className="page-subtitle">
          Manage your suppliers, contact details, and statuses in one place.
        </p>
      </div>

      {/* --------------------------------------------------
        Filters
      -------------------------------------------------- */}
      <div className="filter-bar">
        <div className="filter-left">
          <input
            type="text"
            placeholder="Search supplier..."
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="custom-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            className="custom-select"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="All">All Owners</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        {/* Add Supplier Button — hidden for Sales Reps */}
        {isAdminOrDataEntry && (
          <button
            className="action-btn"
            onClick={() => handleOpenModal("create")}
          >
            + Add Supplier
          </button>
        )}
      </div>

      {/* --------------------------------------------------
        Supplier Table
      -------------------------------------------------- */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-truck" />
            {filteredSuppliers.length} Supplier{filteredSuppliers.length === 1 ? "" : "s"}
          </span>
          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="suppliers-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>Sales Rep</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredSuppliers.length ? (
                filteredSuppliers.map((s) => (
                  <tr key={s._id} className="supplier-row">
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle">
                          {s.name?.charAt(0).toUpperCase() ||
                            s.supplierCode?.charAt(0).toUpperCase() ||
                            "S"}
                        </div>

                        <div>
                          <div className="fw-semibold">{s.name || "-"}</div>
                          <div className="text-muted small">{s.supplierCode || "-"}</div>
                        </div>
                      </div>
                    </td>

                    <td>{s.owner || "-"}</td>
                    <td>{s.contactNumber || "-"}</td>
                    <td>{s.salesRep ? s.salesRep.name : "-"}</td>

                    <td>
                      <span className={`status-pill-ux ${getStatusClass(s.status)}`}>
                        <i className={`bi ${getStatusIcon(s.status)}`} />
                        {getStatusLabel(s.status)}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex align-items-center gap-1">
                        {/* View — always visible */}
                        <button
                          className="icon-btn-ux view"
                          onClick={() => handleOpenModal("view", s)}
                          title="View Supplier"
                        >
                          <i className="bi bi-eye"></i>
                        </button>

                        {/* Edit — hidden for Sales Reps */}
                        {isAdminOrDataEntry && (
                          <button
                            className="icon-btn-ux edit"
                            onClick={() => handleOpenModal("edit", s)}
                            title="Edit Supplier"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}

                        {/* Delete — hidden for Sales Reps */}
                        {isAdminOrDataEntry && (
                          <button
                            className="icon-btn-ux delete"
                            onClick={() => handleDelete(s._id)}
                            title="Delete Supplier"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    {loading ? "Loading suppliers..." : "No suppliers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --------------------------------------------------
        Modal
      -------------------------------------------------- */}
      <SupplierModal
        show={modalOpen}
        mode={modalMode}
        selectedSupplier={selectedSupplier}
        onClose={handleCloseModal}
        onSuccess={fetchSuppliers}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default SuppliersDashboard;