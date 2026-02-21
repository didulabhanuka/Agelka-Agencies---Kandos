// src/pages/SaleRepsDashboard.jsx
import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getSalesReps, deleteSalesRep } from "../../../lib/api/users.api";

import SalesRepModal from "./SalesRepModal";

import "react-toastify/dist/ReactToastify.css";

const SaleRepsDashboard = () => {
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

    // Search
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.repCode?.toLowerCase().includes(s) ||
          r.name?.toLowerCase().includes(s) ||
          r.NIC?.toLowerCase().includes(s)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      data = data.filter((r) => (r.status || "active") === statusFilter);
    }

    // Route filter
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
            {/* Status */}
            <select
              className="custom-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Route */}
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

        <div className="filter-right">
          <button className="action-btn" onClick={() => handleOpenModal("create")}>
            + Add Sales Rep
          </button>
        </div>
      </div>

      {/* --------------------------------------------------
        Table
      -------------------------------------------------- */}
      <div className="table-container p-3">
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
                <tr key={r._id}>
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

                  {/* Status pill */}
                  <td>
                    <span
                      className={`status-pill ${
                        (r.status || "active") === "inactive"
                          ? "status-inactive"
                          : "status-active"
                      }`}
                    >
                      {(r.status || "active") === "inactive"
                        ? "Inactive"
                        : "Active"}
                    </span>
                  </td>

                  {/* Action buttons */}
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("view", r)}
                      >
                        <i className="bi bi-eye" />
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("edit", r)}
                      >
                        <i className="bi bi-pencil" />
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleDelete(r._id)}
                      >
                        <i className="bi bi-trash" />
                      </button>
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

      {/* Toasts */}
      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default SaleRepsDashboard;
