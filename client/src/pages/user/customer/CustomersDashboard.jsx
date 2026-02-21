// src/pages/CustomersDashboard.jsx
import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";

import {
  getCustomers,
  deleteCustomer,
  getSalesReps,
  toggleCustomerCredit,
} from "../../../lib/api/users.api";

import CustomerModal from "./CustomerModal";
import CustomerSnapshot from "./CustomerSnapshot";

import "react-toastify/dist/ReactToastify.css";

const CustomersDashboard = () => {
  // --------------------------------------------------
  // State
  // --------------------------------------------------
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  const [salesReps, setSalesReps] = useState([]);
  const [cities, setCities] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [creditFilter, setCreditFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [repFilter, setRepFilter] = useState("All");

  // Modal handling
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | edit | view
  const [selectedCustomer, setSelectedCustomer] = useState(null);
const [snapshotCustomerId, setSnapshotCustomerId] = useState(null);
const [viewingSnapshot, setViewingSnapshot] = useState(false);


  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------
  useEffect(() => {
    fetchAll();
  }, []);

  // Re-apply filters whenever data or filters change
  useEffect(() => {
    applyFilters();
  }, [customers, search, statusFilter, cityFilter, repFilter]);

  // --------------------------------------------------
  // Fetch data
  // --------------------------------------------------
  const fetchAll = async () => {
    await Promise.all([fetchCustomers(), fetchSalesRepsList()]);
  };

  const fetchCustomers = async () => {
    try {
      const data = await getCustomers();
      const list = Array.isArray(data) ? data : [];

      setCustomers(list);
      setFilteredCustomers(list);

      const uniqueCities = [
        ...new Set(
          list
            .map((c) => c.city)
            .filter((c) => typeof c === "string" && c.trim() !== "")
        ),
      ];
      setCities(uniqueCities);
    } catch (err) {
      console.error("❌ Failed fetching customers:", err);
      toast.error("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesRepsList = async () => {
    try {
      const data = await getSalesReps();
      const list = Array.isArray(data) ? data : [];
      setSalesReps(list);
    } catch (err) {
      console.error("❌ Failed fetching sales reps:", err);
      toast.error("Failed to fetch sales representatives");
    }
  };

  // --------------------------------------------------
  // Filtering logic
  // --------------------------------------------------
  const applyFilters = () => {
    let data = [...customers];

    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.customerCode?.toLowerCase().includes(s) ||
          c.name?.toLowerCase().includes(s) ||
          c.owner?.toLowerCase().includes(s) ||
          c.contactNumber?.toLowerCase().includes(s)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      data = data.filter((c) => (c.status || "active") === statusFilter);
    }

    // credit filter
    if (creditFilter !== "All") {
      data = data.filter((c) => c.creditStatus === creditFilter);
    }

    // City filter
    if (cityFilter !== "All") {
      data = data.filter((c) => c.city === cityFilter);
    }

    // Sales Rep filter
    if (repFilter !== "All") {
      data = data.filter((c) => {
        if (!c.salesRep) return false;

        // Populated/embedded object
        if (typeof c.salesRep === "object" && c.salesRep !== null) {
          return c.salesRep._id === repFilter;
        }

        // ID
        return c.salesRep === repFilter;
      });
    }

    setFilteredCustomers(data);
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const getStatusClass = (status) =>
    (status || "active") === "suspended"
      ? "status-inactive"
      : "status-active";

  const getStatusLabel = (status) =>
    (status || "active") === "suspended" ? "Suspended" : "Active";

  const getCreditStatusClass = (status) => {
    switch (status) {
      case "good":
        return "pill-good";
      case "warning":
        return "pill-warning";
      case "overdue":
        return "pill-overdue";
      case "over-limit":
        return "pill-overlimit";
      case "blocked":
        return "pill-blocked";
      default:
        return "pill-good";
    }
  };

  // const getSalesRepLabel = (customer) => {
  //   if (!customer.salesRep) return "-";

  //   if (typeof customer.salesRep === "object" && customer.salesRep !== null) {
  //     const r = customer.salesRep;
  //     return (r.repCode || "") + (r.name ? " — " + r.name : "") || "-";
  //   }

  //   const rep = salesReps.find((r) => r._id === customer.salesRep);
  //   if (rep) {
  //     return `${rep.repCode} — ${rep.name}`;
  //     // return `${rep.repCode} — ${rep.name}`;
  //   }

  //   return "-";
  // };

  const getSalesRepLabel = (customer) => {
  if (!customer.salesRep) return "-";

  if (typeof customer.salesRep === "object" && customer.salesRep !== null) {
    const r = customer.salesRep;
    return r.name || "-";
  }

  const rep = salesReps.find((r) => r._id === customer.salesRep);
  if (rep) {
    return rep.name;
  }

  return "-";
};

  // --------------------------------------------------
  // Credit Toggle Handler
  // --------------------------------------------------
  const handleToggleCredit = async (id) => {
    try {
      const res = await toggleCustomerCredit(id);
      toast.success(res.message || "Credit status updated");
      fetchCustomers();
    } catch (err) {
      console.error("❌ Credit toggle failed:", err);
      toast.error("Failed to update credit status");
    }
  };

  // --------------------------------------------------
  // Modal Handling
  // --------------------------------------------------
  const handleOpenModal = (mode, customer = null) => {
    setModalMode(mode);
    setSelectedCustomer(customer);
    setModalOpen(true);
  };

  // replace handleOpenModal
const handleOpenSnapshot = (customer) => {
  setSnapshotCustomerId(customer._id);
  setViewingSnapshot(true);
};

const handleBackFromSnapshot = () => {
  setSnapshotCustomerId(null);
  setViewingSnapshot(false);
};


  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedCustomer(null);
  };

  // --------------------------------------------------
  // Delete Handler
  // --------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;

    try {
      await deleteCustomer(id);
      toast.success("Customer deleted successfully");
      fetchCustomers();
    } catch (err) {
      console.error("❌ Delete failed:", err);
      toast.error("Failed to delete customer");
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return  !viewingSnapshot ? (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">
      {/* Header */}
      <div className="pb-4">
        <h2 className="page-title">Customers</h2>
        <p className="page-subtitle">
          Manage your customer accounts, credit limits, and assigned sales reps.
        </p>
      </div>

      {/* --------------------------------------------------
        Filter Bar
      -------------------------------------------------- */}
      <div className="filter-bar">
        <div className="filter-left">
          <input
            type="text"
            placeholder="Search customer..."
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="dropdown-container">
            {/* Status */}
            {/* <select
              className="custom-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select> */}

            {/* Credit Status */}
            <select
              className="custom-select"
              value={creditFilter}
              onChange={(e) => setCreditFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="good">Good</option>
              <option value="warning">Warning</option>
              <option value="overdue">Overdue</option>
              <option value="over-limit">Over Limit</option>
              <option value="blocked">Blocked</option>
            </select>

            {/* City */}
            <select
              className="custom-select"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              <option value="All">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Sales Rep */}
            {/* <select
              className="custom-select"
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
            >
              <option value="All">All Sales Reps</option>
              {salesReps.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.repCode} — {r.name}
                </option>
              ))}
            </select> */}
          </div>
        </div>

        {/* Add Customer Button */}
        <div className="filter-right">
          <button
            className="action-btn"
            onClick={() => handleOpenModal("create")}
          >
            + Add Customer
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
              <th>Customer</th>
              <th>Owner</th>
              <th>Contact</th>
              <th>Sales Rep</th>
              <th>Credit</th>
              <th>Credit Status</th>
              {/* <th>Status</th> */}
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.length ? (
              filteredCustomers.map((c) => (
                <tr key={c._id}>
                  {/* Customer Info */}
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="avatar-circle">
                        {c.name?.charAt(0)?.toUpperCase() ||
                          c.customerCode?.charAt(0)?.toUpperCase() ||
                          "C"}
                      </div>

                      <div>
                        <div className="fw-semibold">{c.name || "-"}</div>
                        <div className="text-muted small">{c.customerCode || "-"}</div>
                        {c.city && (
                          <div className="text-muted small">{c.city}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td>{c.owner || "-"}</td>

                  {/* Contact */}
                  <td>{c.contactNumber || "-"}</td>

                  {/* Sales Rep */}
                  <td>{getSalesRepLabel(c)}</td>

                  {/* Credit Info */}
                  <td>
                    <div className="small">
                      <div>
                        Limit: <strong>{c.creditLimit ?? "-"}</strong>
                      </div>
                      <div>
                        Period:{" "}
                        <strong>
                          {c.creditPeriod != null ? `${c.creditPeriod} days` : "-"}
                        </strong>
                      </div>
                    </div>
                  </td>

                  {/* Credit Status */}
                  <td>
                    <span
                      className={`credit-pill ${getCreditStatusClass(
                        c.creditStatus
                      )}`}
                    >
                      {c.creditStatus}
                    </span>
                  </td>

                  {/* Active/Suspended */}
                  {/* <td>
                    <span
                      className={`status-pill ${getStatusClass(c.status)}`}
                    >
                      {getStatusLabel(c.status)}
                    </span>
                  </td> */}

                  {/* Actions */}
                  <td>
                    <div className="d-flex align-items-center gap-1">

                      {/* View */}
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenSnapshot(c)}
                        title="View Snapshot"
                      >
                        <i className="bi bi-eye"></i>
                      </button>


                      {/* Edit */}
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("edit", c)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>

                      {/* Toggle Credit */}
                      <button
                        className="icon-btn"
                        onClick={() => handleToggleCredit(c._id)}
                        title={c.creditStatus === "blocked" ? "Unblock Credit" : "Block Credit"}
                      >
                        <i
                          className={
                            c.creditStatus === "blocked"
                              ? "bi bi-unlock-fill text-success"
                              : "bi bi-lock-fill text-danger"
                          }
                        ></i>
                      </button>

                      {/* Delete */}
                      <button
                        className="icon-btn"
                        onClick={() => handleDelete(c._id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                      
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">
                  {loading ? "Loading customers..." : "No customers found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------------
        Customer Modal
      -------------------------------------------------- */}
      <CustomerModal
        show={modalOpen}
        mode={modalMode}
        selectedCustomer={selectedCustomer}
        onClose={handleCloseModal}
        onSuccess={fetchCustomers}
        salesReps={salesReps}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
) : (
  <div className="snapshot-page">
    <button
      className="action-btn mb-3"
      onClick={handleBackFromSnapshot}
      style={{marginLeft: "45px"}}
    >
      ← Back to Customers
    </button>

    <CustomerSnapshot customerId={snapshotCustomerId} />
  </div>
);
};

export default CustomersDashboard;
