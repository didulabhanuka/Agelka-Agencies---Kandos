import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";

import { getUsers, deleteUser } from "../../../lib/api/users.api";
import { listBranches } from "../../../lib/api/settings.api";

import UserModal from "./UserModal";

import "react-toastify/dist/ReactToastify.css";

const UserDashboard = () => {
  // --------------------------------------------------
  // Local State
  // --------------------------------------------------
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  const [branches, setBranches] = useState([]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedUser, setSelectedUser] = useState(null);

  // --------------------------------------------------
  // Initial Load
  // --------------------------------------------------
  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  // Apply filters on changes
  useEffect(() => {
    applyFilters();
  }, [users, search, roleFilter, statusFilter, branchFilter]);

  // --------------------------------------------------
  // Fetch Users
  // --------------------------------------------------
  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      console.error("❌ Failed to fetch users:", err);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Fetch Branches
  // --------------------------------------------------
  const fetchBranches = async () => {
    try {
      const res = await listBranches();
      setBranches(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch branches:", err);
      toast.error("Failed to fetch branches");
    }
  };

  // --------------------------------------------------
  // Filters
  // --------------------------------------------------
  const applyFilters = () => {
    let data = [...users];

    // Search filter (username or email)
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (u) =>
          u.username.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s)
      );
    }

    // Role filter
    if (roleFilter !== "All") {
      data = data.filter((u) => u.role === roleFilter);
    }

    // Branch filter
    if (branchFilter !== "All") {
      data = data.filter((u) => u.branch?._id === branchFilter);
    }

    // Status filter
    if (statusFilter !== "All") {
      const active = statusFilter === "Active";
      data = data.filter((u) => (u.isActive !== false) === active);
    }

    setFilteredUsers(data);
  };

  // --------------------------------------------------
  // Modal Handlers
  // --------------------------------------------------
  const handleOpenModal = (mode, user = null) => {
    setModalMode(mode);
    setSelectedUser(user);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedUser(null);
  };

  // --------------------------------------------------
  // Delete User
  // --------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await deleteUser(id);
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (err) {
      console.error("❌ Failed to delete user:", err);
      toast.error("Failed to delete user");
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">

      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">User Management</h2>
        <p className="page-subtitle">
          Manage and oversee all users across your warehouse operations.
        </p>
      </div>

      {/* --------------------------------------------------
          Filters + Search Bar
      -------------------------------------------------- */}
      <div className="filter-bar">

        {/* Left Filters */}
        <div className="filter-left">
          <input
            type="text"
            placeholder="Search user..."
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="dropdown-container">
            {/* Role Filter */}
            <select
              className="custom-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="DataEntry">Data Entry</option>
            </select>

            {/* Branch Filter */}
            <select
              className="custom-select"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.branchCode} – {b.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="custom-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Right side - Add Button */}
        <div className="filter-right">
          <button className="action-btn" onClick={() => handleOpenModal("create")}>
            + Add User
          </button>
        </div>

      </div>

      {/* --------------------------------------------------
          Users Table
      -------------------------------------------------- */}
      <div className="table-container p-3">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.length ? (
              filteredUsers.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="avatar-circle">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-semibold">{u.username}</div>
                        <div className="text-muted small">{u.number || "-"}</div>
                      </div>
                    </div>
                  </td>

                  <td>{u.email}</td>
                  <td>{u.role}</td>

                  <td>
                    {u.branch
                      ? `${u.branch.branchCode} – ${u.branch.name}`
                      : "-"}
                  </td>

                  <td>
                    <span
                      className={`status-pill ${
                        u.isActive === false ? "status-inactive" : "status-active"
                      }`}
                    >
                      {u.isActive === false ? "Inactive" : "Active"}
                    </span>
                  </td>

                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("edit", u)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleDelete(u._id)}
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
                  {loading ? "Loading users..." : "No users found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------------
          Modal Component
      -------------------------------------------------- */}
      <UserModal
        show={modalOpen}
        mode={modalMode}
        selectedUser={selectedUser}
        branches={branches}
        onClose={handleCloseModal}
        onSuccess={fetchUsers}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default UserDashboard;
