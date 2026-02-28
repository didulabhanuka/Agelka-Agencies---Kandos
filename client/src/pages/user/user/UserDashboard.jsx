// src/pages/UserDashboard.jsx
import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

import { getUsers, deleteUser } from "../../../lib/api/users.api";
import { listBranches } from "../../../lib/api/settings.api";

import UserModal from "./UserModal";

import "react-toastify/dist/ReactToastify.css";

const UserDashboard = () => {
  // --------------------------------------------------
  // RBAC
  // --------------------------------------------------
  const { user } = useAuth();
  const actorType = user?.actorType;
  const role = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

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

    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (u) =>
          u.username.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s)
      );
    }

    if (roleFilter !== "All") {
      data = data.filter((u) => u.role === roleFilter);
    }

    if (branchFilter !== "All") {
      data = data.filter((u) => u.branch?._id === branchFilter);
    }

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
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">
      <style>{`
        .users-table-wrap {
          max-height: 72vh;
          overflow: auto;
          border-radius: 14px;
        }

        .users-table-wrap .modern-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #fff;
          box-shadow: inset 0 -1px 0 #eef0f3;
          white-space: nowrap;
        }

        .user-row {
          transition: background-color .15s ease, box-shadow .15s ease;
        }

        .user-row:hover {
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

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          background: #f0f0ff;
          color: #5c3e94;
          border: 1px solid #ddd6fe;
        }
      `}</style>

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
        <div className="filter-left">
          <input
            type="text"
            placeholder="Search user..."
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="dropdown-container">
            <select
              className="custom-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="DataEntry">Data Entry</option>
            </select>

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

        {/* Add User — hidden for Sales Reps */}
        {isAdminOrDataEntry && (
          <div className="filter-right">
            <button className="action-btn" onClick={() => handleOpenModal("create")}>
              + Add User
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------
        Users Table
      -------------------------------------------------- */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-person-fill" />
            {filteredUsers.length} User{filteredUsers.length === 1 ? "" : "s"}
          </span>
          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="users-table-wrap">
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
                  <tr key={u._id} className="user-row">
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

                    <td>
                      <span className="role-badge">
                        <i className="bi bi-shield-check" />
                        {u.role}
                      </span>
                    </td>

                    <td>
                      {u.branch
                        ? `${u.branch.branchCode} – ${u.branch.name}`
                        : "-"}
                    </td>

                    <td>
                      <span
                        className={`status-pill-ux ${
                          u.isActive === false ? "pill-danger" : "pill-success"
                        }`}
                      >
                        <i
                          className={`bi ${
                            u.isActive === false
                              ? "bi-x-circle-fill"
                              : "bi-check-circle-fill"
                          }`}
                        />
                        {u.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex align-items-center gap-1">
                        {/* Edit — hidden for Sales Reps */}
                        {isAdminOrDataEntry && (
                          <button
                            className="icon-btn-ux edit"
                            onClick={() => handleOpenModal("edit", u)}
                            title="Edit User"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}

                        {/* Delete — hidden for Sales Reps */}
                        {isAdminOrDataEntry && (
                          <button
                            className="icon-btn-ux delete"
                            onClick={() => handleDelete(u._id)}
                            title="Delete User"
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
                    {loading ? "Loading users..." : "No users found."}
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