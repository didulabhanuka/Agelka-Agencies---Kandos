// src/pages/SaleRepsDashboard.jsx
import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { getSalesReps, deleteSalesRep } from "../../../lib/api/users.api";

import SalesRepModal from "./SalesRepModal";

import "react-toastify/dist/ReactToastify.css";

const SaleRepsDashboard = () => {
  // --------------------------------------------------
  // RBAC
  // --------------------------------------------------
  const { user } = useAuth();
  const actorType = user?.actorType;
  const role = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  // --------------------------------------------------
  // Local state
  // --------------------------------------------------
  const [loading, setLoading] = useState(true);

  const [salesReps, setSalesReps] = useState([]);
  const [filteredReps, setFilteredReps] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [routeFilter, setRouteFilter] = useState("All");

  const [routes, setRoutes] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | edit | view
  const [selectedRep, setSelectedRep] = useState(null);

  // --------------------------------------------------
  // Fetch sales reps
  // --------------------------------------------------
  useEffect(() => {
    fetchSalesReps();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [salesReps, search, statusFilter, routeFilter]);

  const fetchSalesReps = async () => {
    try {
      setLoading(true);

      const data = await getSalesReps();
      const list = Array.isArray(data) ? data : [];

      setSalesReps(list);
      setFilteredReps(list);

      // Extract unique routes
      const uniqueRoutes = [
        ...new Set(
          list
            .map((r) => r.route)
            .filter((r) => typeof r === "string" && r.trim() !== "")
        ),
      ];
      setRoutes(uniqueRoutes);
    } catch (err) {
      console.error("❌ Failed to fetch sales representatives:", err);
      toast.error("Failed to fetch sales representatives");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Filters
  // --------------------------------------------------
  const applyFilters = () => {
    let data = [...salesReps];

    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.repCode?.toLowerCase().includes(s) ||
          r.name?.toLowerCase().includes(s) ||
          r.NIC?.toLowerCase().includes(s)
      );
    }

    if (statusFilter !== "All") {
      data = data.filter((r) => (r.status || "active") === statusFilter);
    }

    if (routeFilter !== "All") {
      data = data.filter((r) => r.route === routeFilter);
    }

    setFilteredReps(data);
  };

  // --------------------------------------------------
  // Modal handlers
  // --------------------------------------------------
  const handleOpenModal = (mode, rep = null) => {
    setModalMode(mode);
    setSelectedRep(rep);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedRep(null);
    setModalOpen(false);
  };

  // --------------------------------------------------
  // Delete handler
  // --------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this sales rep?")) return;

    try {
      await deleteSalesRep(id);
      toast.success("Sales Representative deleted successfully");
      fetchSalesReps();
    } catch (err) {
      console.error("❌ Failed to delete sales representative:", err);
      toast.error("Failed to delete sales representative");
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">
      <style>{`
        .reps-table-wrap {
          max-height: 72vh;
          overflow: auto;
          border-radius: 14px;
        }

        .reps-table-wrap .modern-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #fff;
          box-shadow: inset 0 -1px 0 #eef0f3;
          white-space: nowrap;
        }

        .rep-row {
          transition: background-color .15s ease, box-shadow .15s ease;
        }

        .rep-row:hover {
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
        <h2 className="page-title">Sales Representatives</h2>
        <p className="page-subtitle">
          Manage and oversee your field sales reps, their routes, and contact details.
        </p>
      </div>

      {/* --------------------------------------------------
        Filter Bar
      -------------------------------------------------- */}
      <div className="filter-bar">
        <div className="filter-left">
          <input
            type="text"
            placeholder="Search sales rep..."
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="dropdown-container">
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
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
            >
              <option value="All">All Routes</option>
              {routes.map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Sales Rep — hidden for Sales Reps */}
        {isAdminOrDataEntry && (
          <div className="filter-right">
            <button className="action-btn" onClick={() => handleOpenModal("create")}>
              + Add Sales Rep
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------
        Table
      -------------------------------------------------- */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-person-badge" />
            {filteredReps.length} Rep{filteredReps.length === 1 ? "" : "s"}
          </span>
          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="reps-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Rep</th>
                <th>Contact</th>
                <th>Route</th>
                <th>NIC</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredReps.length ? (
                filteredReps.map((r) => (
                  <tr key={r._id} className="rep-row">
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle">
                          {r.name?.charAt(0).toUpperCase() ||
                            r.repCode?.charAt(0).toUpperCase() ||
                            "R"}
                        </div>
                        <div>
                          <div className="fw-semibold">{r.name || "-"}</div>
                          <div className="text-muted small">{r.repCode || "-"}</div>
                        </div>
                      </div>
                    </td>

                    <td>{r.contactNumber || "-"}</td>
                    <td>{r.route || "-"}</td>
                    <td>{r.NIC || "-"}</td>

                    <td>
                      <span
                        className={`status-pill-ux ${
                          (r.status || "active") === "inactive"
                            ? "pill-danger"
                            : "pill-success"
                        }`}
                      >
                        <i
                          className={`bi ${
                            (r.status || "active") === "inactive"
                              ? "bi-x-circle-fill"
                              : "bi-check-circle-fill"
                          }`}
                        />
                        {(r.status || "active") === "inactive" ? "Inactive" : "Active"}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex align-items-center gap-1">
                        {/* View — always visible */}
                        <button
                          className="icon-btn-ux view"
                          onClick={() => handleOpenModal("view", r)}
                          title="View Rep"
                        >
                          <i className="bi bi-eye" />
                        </button>

                        {/* Edit — hidden for Sales Reps */}
                        {isAdminOrDataEntry && (
                          <button
                            className="icon-btn-ux edit"
                            onClick={() => handleOpenModal("edit", r)}
                            title="Edit Rep"
                          >
                            <i className="bi bi-pencil" />
                          </button>
                        )}

                        {/* Delete — hidden for Sales Reps */}
                        {isAdminOrDataEntry && (
                          <button
                            className="icon-btn-ux delete"
                            onClick={() => handleDelete(r._id)}
                            title="Delete Rep"
                          >
                            <i className="bi bi-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    {loading ? "Loading sales representatives..." : "No sales representatives found."}
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
      <SalesRepModal
        show={modalOpen}
        mode={modalMode}
        selectedRep={selectedRep}
        onClose={handleCloseModal}
        onSuccess={fetchSalesReps}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default SaleRepsDashboard;