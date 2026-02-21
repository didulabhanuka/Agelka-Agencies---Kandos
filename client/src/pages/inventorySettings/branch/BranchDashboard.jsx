import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { listBranches, deleteBranch } from "../../../lib/api/settings.api";
import BranchModal from "./BranchModal";

import "react-toastify/dist/ReactToastify.css";

const BranchDashboard = () => {
  // --------------------------------------------------
  // Local State
  // --------------------------------------------------
  const [branches, setBranches] = useState([]);
  const [filteredBranches, setFilteredBranches] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | edit | view
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [loading, setLoading] = useState(false);

  // --------------------------------------------------
  // Effects
  // --------------------------------------------------
  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [branches, search, statusFilter]);

  // --------------------------------------------------
  // Fetch Branches
  // --------------------------------------------------
  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await listBranches();

      const data = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      setBranches(data);
      setFilteredBranches(data);
    } catch (err) {
      console.error("❌ Failed to fetch branches:", err);
      toast.error("Failed to load branches.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  /** Return CSS class for branch status */
  const getStatusClass = (status) =>
    (status || "active") === "inactive"
      ? "status-inactive"
      : "status-active";

  /** Convert API status name into readable label */
  const getStatusLabel = (status) =>
    (status || "active") === "inactive" ? "Inactive" : "Active";

  /** First character for avatar circle */
  const getInitial = (b) =>
    b.name?.charAt(0).toUpperCase() ||
    b.branchCode?.charAt(0).toUpperCase() ||
    "B";

  // --------------------------------------------------
  // Apply Search + Filter
  // --------------------------------------------------
  const applyFilters = () => {
    let data = [...branches];

    // Search
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (b) =>
          b.branchCode?.toLowerCase().includes(s) ||
          b.name?.toLowerCase().includes(s) ||
          b.address?.toLowerCase().includes(s) ||
          b.phone?.toLowerCase().includes(s) ||
          b.email?.toLowerCase().includes(s)
      );
    }

    // Status Filter
    if (statusFilter !== "All") {
      data = data.filter((b) => (b.status || "active") === statusFilter);
    }

    setFilteredBranches(data);
  };

  // --------------------------------------------------
  // Modal Handlers
  // --------------------------------------------------
  const handleOpenModal = (mode, branch = null) => {
    setModalMode(mode);
    setSelectedBranch(branch);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedBranch(null);
  };

  // --------------------------------------------------
  // Delete Branch
  // --------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this branch?")) return;

    try {
      await deleteBranch(id);
      toast.success("Branch deleted");
      fetchBranches();
    } catch (err) {
      console.error("❌ Failed deleting branch:", err);
      toast.error("Failed to delete branch.");
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">
      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Branches</h2>
        <p className="page-subtitle">
          Manage your branches and their contact information.
        </p>
      </div>

      {/* --------------------------------------------------
        Filter Bar
      -------------------------------------------------- */}
      <div className="filter-bar">
        <div className="filter-left">
          <input
            type="text"
            placeholder="Search branch..."
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
        </div>

        <div className="filter-right">
          <button className="action-btn" onClick={() => handleOpenModal("create")}>
            + Add Branch
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
              <th>Branch</th>
              <th>Address</th>
              <th>Contact</th>
              <th>Status</th>
              <th style={{ width: "120px" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-4">
                  Loading branches...
                </td>
              </tr>
            ) : filteredBranches.length ? (
              filteredBranches.map((b) => (
                <tr key={b._id}>
                  {/* Branch + Avatar */}
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="avatar-circle">{getInitial(b)}</div>
                      <div>
                        <div className="fw-semibold">{b.name || "-"}</div>
                        <div className="text-muted small">{b.branchCode || "-"}</div>
                      </div>
                    </div>
                  </td>

                  {/* Address */}
                  <td>
                      {b.address || <span className="text-muted">No address</span>}
                  </td>

                  {/* Contact */}
                  <td>
                      {b.phone && <div>{b.phone}</div>}
                      {b.email && <div>{b.email}</div>}
                      {!b.phone && !b.email && (
                        <span className="text-muted">No contact info</span>
                      )}
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`status-pill ${getStatusClass(b.status)}`}>
                      {getStatusLabel(b.status)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("view", b)}
                      >
                        <i className="bi bi-eye"></i>
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("edit", b)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>

                      <button className="icon-btn" onClick={() => handleDelete(b._id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  No branches found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------------
        Modal
      -------------------------------------------------- */}
      <BranchModal
        show={modalOpen}
        mode={modalMode}
        selectedBranch={selectedBranch}
        onClose={handleCloseModal}
        onSuccess={fetchBranches}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default BranchDashboard;
