// src/pages/products/brands/BrandsDashboard.jsx
import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";

import {
  getBrands,
  deleteBrand,
  getProductGroups,
} from "../../../lib/api/settings.api";

import BrandModal from "./BrandModal";

import "react-toastify/dist/ReactToastify.css";

const BrandsDashboard = () => {
  // --------------------------------------------------
  // Local State
  // --------------------------------------------------
  const [loading, setLoading] = useState(true);

  const [brands, setBrands] = useState([]);
  const [filteredBrands, setFilteredBrands] = useState([]);

  const [groups, setGroups] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [groupFilter, setGroupFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | edit | view
  const [selectedBrand, setSelectedBrand] = useState(null);

  // --------------------------------------------------
  // Initial Load
  // --------------------------------------------------
  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [brands, search, statusFilter, groupFilter]);

  // --------------------------------------------------
  // Fetch Helpers
  // --------------------------------------------------
  const fetchAll = async () => {
    await Promise.all([fetchBrands(), fetchGroups()]);
  };

  const fetchBrands = async () => {
    try {
      const data = await getBrands();
      const list = Array.isArray(data) ? data : [];
      setBrands(list);
      setFilteredBrands(list);
    } catch (err) {
      console.error("❌ Failed fetching brands:", err);
      toast.error("Failed to fetch brands");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await getProductGroups();
      const list = Array.isArray(data) ? data : [];
      setGroups(list);
    } catch (err) {
      console.error("❌ Failed fetching groups:", err);
      toast.error("Failed to fetch product groups");
    }
  };

  // --------------------------------------------------
  // Utility Functions
  // --------------------------------------------------

  const getStatusClass = (status) =>
    (status || "active") === "inactive" ? "status-inactive" : "status-active";

  const getStatusLabel = (status) =>
    (status || "active") === "inactive" ? "Inactive" : "Active";

  const getBrandInitial = (brand) =>
    brand.name?.charAt(0).toUpperCase() ||
    brand.brandCode?.charAt(0).toUpperCase() ||
    "B";

  /** Resolve group label (code + name) */
  const getGroupLabel = (groupId) => {
    const g = groups.find((gr) => gr._id === groupId);
    if (!g) return "";
    if (g.groupCode && g.name) return `${g.groupCode} — ${g.name}`;
    return g.name || g.groupCode || "";
  };

  /** Expand brand.groups[] into readable list */
  const getBrandGroupNames = (brand) => {
    if (!Array.isArray(brand.groups)) return [];

    return brand.groups
      .map((g) => {
        if (typeof g === "string") return getGroupLabel(g);
        if (g && typeof g === "object") {
          if (g.groupCode || g.name) {
            return g.groupCode && g.name
              ? `${g.groupCode} — ${g.name}`
              : g.name || g.groupCode;
          }
          if (g._id) return getGroupLabel(g._id);
        }
        return "";
      })
      .filter((x) => x && x.trim() !== "");
  };

  /** Whether brand contains a specific product group */
  const brandHasGroup = (brand, groupId) => {
    if (!Array.isArray(brand.groups)) return false;

    return brand.groups.some((g) => {
      if (typeof g === "string") return g === groupId;
      if (g && typeof g === "object") return g._id === groupId;
      return false;
    });
  };

  // --------------------------------------------------
  // Filters
  // --------------------------------------------------
  const applyFilters = () => {
    let data = [...brands];

    // 🔍 Search
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (b) =>
          b.brandCode?.toLowerCase().includes(s) ||
          b.name?.toLowerCase().includes(s)
      );
    }

    // 🟢 Status
    if (statusFilter !== "All") {
      data = data.filter(
        (b) => (b.status || "active") === statusFilter
      );
    }

    // 🧩 Product Group
    if (groupFilter !== "All") {
      data = data.filter((b) => brandHasGroup(b, groupFilter));
    }

    setFilteredBrands(data);
  };

  // --------------------------------------------------
  // Modal Handling
  // --------------------------------------------------
  const handleOpenModal = (mode, brand = null) => {
    setModalMode(mode);
    setSelectedBrand(brand);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedBrand(null);
  };

  // --------------------------------------------------
  // Delete Handler
  // --------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this brand?")) return;

    try {
      await deleteBrand(id);
      toast.success("Brand deleted successfully");
      fetchBrands();
    } catch (err) {
      console.error("❌ Delete failed:", err);
      toast.error("Failed to delete brand");
    }
  };

  // --------------------------------------------------
  // Render UI
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">

      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Brands</h2>
        <p className="page-subtitle">
          Manage your product brands and their assigned product groups.
        </p>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <p>
          <strong>Important!</strong> Brands are the backbone of your
          product catalog — keeping them organized ensures clean reporting,
          supplier alignment, and customer trust.
        </p>
      </div>

      {/* --------------------------------------------------
        Filter Bar
      -------------------------------------------------- */}
      <div className="filter-bar">
        <div className="filter-left">
          {/* Search */}
          <input
            type="text"
            placeholder="Search brand..."
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Status + group filters */}
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
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="All">All Groups</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.groupCode && g.name
                    ? `${g.groupCode} — ${g.name}`
                    : g.name || g.groupCode}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Create Button */}
        <div className="filter-right">
          <button className="action-btn" onClick={() => handleOpenModal("create")}>
            + Add Brand
          </button>
        </div>
      </div>

      {/* --------------------------------------------------
        Brands Table
      -------------------------------------------------- */}
      <div className="table-container p-3">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Groups</th>
              <th>Status</th>
              <th style={{ width: "100px" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredBrands.length ? (
              filteredBrands.map((b) => {
                const groupNames = getBrandGroupNames(b);

                return (
                  <tr key={b._id}>
                    {/* Brand column */}
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle">
                          {getBrandInitial(b)}
                        </div>
                        <div>
                          <div className="fw-semibold">{b.name || "-"}</div>
                          <div className="text-muted small">{b.brandCode || "-"}</div>
                        </div>
                      </div>
                    </td>

                    {/* Groups */}
                    <td>
                      {groupNames.length ? (
                        groupNames.map((gName, idx) => (
                          <span key={idx} className="group-badge">
                            {gName}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted small">No groups</span>
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

                        <button
                          className="icon-btn"
                          onClick={() => handleDelete(b._id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  {loading ? "Loading brands..." : "No brands found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------------
        Modal
      -------------------------------------------------- */}
      <BrandModal
        show={modalOpen}
        mode={modalMode}
        selectedBrand={selectedBrand}
        onClose={handleCloseModal}
        onSuccess={fetchBrands}
        groups={groups}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default BrandsDashboard;
