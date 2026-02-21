// // src/pages/product/GroupsDashboard.jsx
// import React, { useState, useEffect } from "react";
// import { ToastContainer, toast } from "react-toastify";

// import {
//   getProductGroups,
//   deleteProductGroup,
// } from "../../../lib/api/settings.api";

// import GroupModal from "./GroupModal";

// import "react-toastify/dist/ReactToastify.css";

// const GroupsDashboard = () => {
//   // --------------------------------------------------
//   // Local State
//   // --------------------------------------------------
//   const [loading, setLoading] = useState(true);

//   const [groups, setGroups] = useState([]);
//   const [filteredGroups, setFilteredGroups] = useState([]);

//   const [search, setSearch] = useState("");
//   const [statusFilter, setStatusFilter] = useState("All");

//   const [modalOpen, setModalOpen] = useState(false);
//   const [modalMode, setModalMode] = useState("create"); // create | edit | view
//   const [selectedGroup, setSelectedGroup] = useState(null);

//   // --------------------------------------------------
//   // Initial Load
//   // --------------------------------------------------
//   useEffect(() => {
//     fetchGroups();
//   }, []);

//   // Apply filters when list/search/status changes
//   useEffect(() => {
//     applyFilters();
//   }, [groups, search, statusFilter]);

//   // --------------------------------------------------
//   // Fetch Product Groups
//   // --------------------------------------------------
//   const fetchGroups = async () => {
//     try {
//       const data = await getProductGroups();
//       const list = Array.isArray(data) ? data : [];

//       setGroups(list);
//       setFilteredGroups(list);
//     } catch (err) {
//       console.error("❌ Failed fetching product groups:", err);
//       toast.error("Failed to fetch product groups");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --------------------------------------------------
//   // Helpers
//   // --------------------------------------------------
//   const getStatusClass = (status = "active") =>
//     status === "inactive" ? "status-inactive" : "status-active";

//   const getStatusLabel = (status = "active") =>
//     status === "inactive" ? "Inactive" : "Active";

//   // --------------------------------------------------
//   // Apply Search + Status Filters
//   // --------------------------------------------------
//   const applyFilters = () => {
//     let data = [...groups];

//     // Search filter
//     if (search.trim()) {
//       const s = search.toLowerCase();

//       data = data.filter(
//         (g) =>
//           g.groupCode?.toLowerCase().includes(s) ||
//           g.name?.toLowerCase().includes(s)
//       );
//     }

//     // Status filter
//     if (statusFilter !== "All") {
//       data = data.filter((g) => (g.status || "active") === statusFilter);
//     }

//     setFilteredGroups(data);
//   };

//   // --------------------------------------------------
//   // Modal Controls
//   // --------------------------------------------------
//   const handleOpenModal = (mode, group = null) => {
//     setModalMode(mode);
//     setSelectedGroup(group);
//     setModalOpen(true);
//   };

//   const handleCloseModal = () => {
//     setModalOpen(false);
//     setSelectedGroup(null);
//   };

//   // --------------------------------------------------
//   // Delete Group
//   // --------------------------------------------------
//   const handleDelete = async (id) => {
//     if (!window.confirm("Are you sure you want to delete this product group?"))
//       return;

//     try {
//       await deleteProductGroup(id);
//       toast.success("Group deleted successfully");
//       fetchGroups();
//     } catch (err) {
//       console.error("❌ Error deleting group:", err);
//       toast.error("Failed to delete group");
//     }
//   };

//   // --------------------------------------------------
//   // Render UI
//   // --------------------------------------------------
//   return (
//     <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">
//       {/* ---------------- Header ---------------- */}
//       <div className="pb-4">
//         <h2 className="page-title">Product Groups</h2>
//         <p className="page-subtitle">
//           Manage your product groups and assign them to brands or items.
//         </p>
//       </div>

//       {/* ---------------- Info Box ---------------- */}
      // <div className="info-box">
      //   <p>
      //     <strong>Important!</strong> Product groups are the structural foundation
      //     of your catalog. They define how similar products are classified,
      //     compared, and reported — making it easier to manage stock, analyze
      //     trends, and maintain consistency across branches and suppliers.
      //   </p>
      // </div>

//       {/* ---------------- Filter Bar ---------------- */}
//       <div className="filter-bar">
//         <div className="filter-left">
//           <input
//             type="text"
//             placeholder="Search group..."
//             className="filter-input"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />

//           <select
//             className="custom-select"
//             value={statusFilter}
//             onChange={(e) => setStatusFilter(e.target.value)}
//           >
//             <option value="All">All Statuses</option>
//             <option value="active">Active</option>
//             <option value="inactive">Inactive</option>
//           </select>
//         </div>

//         <div className="filter-right">
//           <button
//             className="action-btn"
//             onClick={() => handleOpenModal("create")}
//           >
//             + Add Group
//           </button>
//         </div>
//       </div>

//       {/* ---------------- Groups Table ---------------- */}
//       <div className="table-container p-3">
//         <table className="modern-table">
//           <thead>
//             <tr>
//               <th>Group</th>
//               <th>Units</th>
//               <th>Status</th>
//               <th style={{ width: "120px" }}>Actions</th>
//             </tr>
//           </thead>

//           <tbody>
//             {filteredGroups.length > 0 ? (
//               filteredGroups.map((g) => (
//                 <tr key={g._id}>
//                   {/* Group Column */}
//                   <td>
//                     <div className="d-flex align-items-center gap-2">
//                       <div className="avatar-circle">
//                         {g.name?.charAt(0)?.toUpperCase() ||
//                           g.groupCode?.charAt(0)?.toUpperCase() ||
//                           "G"}
//                       </div>

//                       <div>
//                         <div className="fw-semibold">{g.name || "-"}</div>
//                         <div className="text-muted small">
//                           {g.groupCode || "-"}
//                         </div>
//                       </div>
//                     </div>
//                   </td>

//                   {/* Units */}
//                   <td>
//                     {Array.isArray(g.units) && g.units.length ? (
//                       g.units.map((unit, idx) => (
//                         <span key={idx} className="group-badge">
//                           {unit}
//                         </span>
//                       ))
//                     ) : (
//                       <span className="text-muted small">No units</span>
//                     )}
//                   </td>

//                   {/* Status */}
//                   <td>
//                     <span className={`status-pill ${getStatusClass(g.status)}`}>
//                       {getStatusLabel(g.status)}
//                     </span>
//                   </td>

//                   {/* Actions */}
//                   <td>
//                     <div className="d-flex align-items-center gap-1">
//                       <button
//                         className="icon-btn"
//                         onClick={() => handleOpenModal("view", g)}
//                       >
//                         <i className="bi bi-eye"></i>
//                       </button>

//                       <button
//                         className="icon-btn"
//                         onClick={() => handleOpenModal("edit", g)}
//                       >
//                         <i className="bi bi-pencil"></i>
//                       </button>

//                       <button
//                         className="icon-btn"
//                         onClick={() => handleDelete(g._id)}
//                       >
//                         <i className="bi bi-trash"></i>
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ))
//             ) : (
//               <tr>
//                 <td colSpan={6} className="text-center text-muted py-4">
//                   {loading ? "Loading product groups..." : "No product groups found."}
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {/* ---------------- Modal ---------------- */}
//       <GroupModal
//         show={modalOpen}
//         mode={modalMode}
//         selectedGroup={selectedGroup}
//         onClose={handleCloseModal}
//         onSuccess={fetchGroups}
//       />

//       {/* Toast Notifications */}
//       <ToastContainer position="top-right" autoClose={2000} />
//     </div>
//   );
// };

// export default GroupsDashboard;


import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getProductGroups, deleteProductGroup } from "../../../lib/api/settings.api";
import GroupModal from "./GroupModal";
import "react-toastify/dist/ReactToastify.css";

const GroupsDashboard = () => {
  // --------------------------------------------------
  // Local State
  // --------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [uomFilter, setUomFilter] = useState("All"); // Filter for UOM Type
  const [statusFilter, setStatusFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | edit | view
  const [selectedGroup, setSelectedGroup] = useState(null);

  // --------------------------------------------------
  // Initial Load
  // --------------------------------------------------
  useEffect(() => {
    fetchGroups();
  }, []);

  // Apply filters when list/status/UOM changes
  useEffect(() => {
    applyFilters();
  }, [groups, uomFilter, statusFilter]);

  // --------------------------------------------------
  // Fetch Product Groups
  // --------------------------------------------------
  const fetchGroups = async () => {
    try {
      const data = await getProductGroups();
      const list = Array.isArray(data) ? data : [];
      setGroups(list);
      setFilteredGroups(list);
    } catch (err) {
      console.error("❌ Failed fetching product groups:", err);
      toast.error("Failed to fetch product groups");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const getStatusClass = (status = "active") =>
    status === "inactive" ? "status-inactive" : "status-active";

  const getStatusLabel = (status = "active") =>
    status === "inactive" ? "Inactive" : "Active";

  // --------------------------------------------------
  // Apply Filters
  // --------------------------------------------------
  const applyFilters = () => {
    let data = [...groups];

    // UOM Type filter
    if (uomFilter !== "All") {
      data = data.filter((g) => g.uomType === uomFilter);
    }

    // Status filter
    if (statusFilter !== "All") {
      data = data.filter((g) => (g.status || "active") === statusFilter);
    }

    setFilteredGroups(data);
  };

  // --------------------------------------------------
  // Modal Controls
  // --------------------------------------------------
  const handleOpenModal = (mode, group = null) => {
    setModalMode(mode);
    setSelectedGroup(group);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedGroup(null);
  };

  // --------------------------------------------------
  // Delete Group
  // --------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product group?"))
      return;

    try {
      await deleteProductGroup(id);
      toast.success("Group deleted successfully");
      fetchGroups();
    } catch (err) {
      console.error("❌ Error deleting group:", err);
      toast.error("Failed to delete group");
    }
  };

  // --------------------------------------------------
  // Render UI
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5 flex-wrap justify-content-between">
      {/* ---------------- Header ---------------- */}
      <div className="pb-4">
        <h2 className="page-title">Product Groups</h2>
        <p className="page-subtitle">
          Manage your product groups and assign them to brands or items.
        </p>
      </div>

      {/* ---------------- Filter Bar ---------------- */}
      <div className="filter-bar">
        <div className="filter-left">
          {/* Filter for UOM Type */}
          <select
            className="custom-select"
            value={uomFilter}
            onChange={(e) => setUomFilter(e.target.value)}
          >
            <option value="All">All UOM Types</option>
            <option value="primary">Primary</option>
            <option value="base">Base</option>
          </select>

          {/* Status filter */}
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
          <button
            className="action-btn"
            onClick={() => handleOpenModal("create")}
          >
            + Add Group
          </button>
        </div>
      </div>

      {/* ---------------- Groups Table ---------------- */}
      <div className="table-container p-3">
        <table className="modern-table">
          <thead>
            <tr>
              <th>UOM Type</th>
              <th>Name & Code</th>
              <th>Status</th>
              <th style={{ width: "120px" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredGroups.length > 0 ? (
              filteredGroups.map((g) => (
                <tr key={g._id}>
                  {/* UOM Type Column */}
                  <td>{g.uomType === "primary" ? "Primary" : "Base"}</td>

                  {/* Name & Code Column */}
                  <td>
                    <div>
                      <strong>{g.name}</strong> ({g.code})
                    </div>
                  </td>

                  {/* Status Column */}
                  <td>
                    <span className={`status-pill ${getStatusClass(g.status)}`}>
                      {getStatusLabel(g.status)}
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("view", g)}
                      >
                        <i className="bi bi-eye"></i>
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleOpenModal("edit", g)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>

                      <button
                        className="icon-btn"
                        onClick={() => handleDelete(g._id)}
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
                  {loading ? "Loading product groups..." : "No product groups found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------- Modal ---------------- */}
      <GroupModal
        show={modalOpen}
        mode={modalMode}
        selectedGroup={selectedGroup}
        onClose={handleCloseModal}
        onSuccess={fetchGroups}
      />

      {/* Toast Notifications */}
      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default GroupsDashboard;
