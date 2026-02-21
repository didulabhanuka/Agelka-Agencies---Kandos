// src/pages/SuppliersDashboard.jsx
import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getSuppliers, deleteSupplier } from "../../../lib/api/users.api";
import SupplierModal from "./SupplierModal";

import "react-toastify/dist/ReactToastify.css";

const SuppliersDashboard = () => {
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
    console.log(data); // Log to see if `salesRep` is present
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
    (status || "active") === "inactive" ? "status-inactive" : "status-active";

  const getStatusLabel = (status) =>
    (status || "active") === "inactive" ? "Inactive" : "Active";

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">

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

        <button
          className="action-btn"
          onClick={() => handleOpenModal("create")}
        >
          + Add Supplier
        </button>
      </div>

      {/* --------------------------------------------------
        Supplier Table
      -------------------------------------------------- */}
      <div className="table-container p-3">
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
                <tr key={s._id}>
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
                  <td>{s.salesRep ? s.salesRep.name : "N/A"}</td> {/* Display SalesRep */}

                  <td>
                    <span className={`status-pill ${getStatusClass(s.status)}`}>
                      {getStatusLabel(s.status)}
                    </span>
                  </td>

                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("view", s)}
                      >
                        <i className="bi bi-eye"></i>
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("edit", s)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleDelete(s._id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
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
