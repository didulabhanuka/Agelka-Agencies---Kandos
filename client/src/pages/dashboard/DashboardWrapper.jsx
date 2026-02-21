// // src/pages/reports/DashboardWrapper.jsx
// import React, { useState } from "react";

// // Import all dashboards
// import BusinessDashboard from "./BusinessDashboard";
// import SalesDashboard from "./SalesDashboard";
// import StockDashboard from "./StockDashboard";
// import PurchaseDashboard from "./PurchaseDashboard";

// import ItemMovementPivotPage from "./ItemMovementPivotPage"; 


// import "bootstrap-icons/font/bootstrap-icons.css";

// const DashboardWrapper = () => {
//   const [activeView, setActiveView] = useState("business");

//   return (
//     <div className="container-fluid py-4 px-5">
//     <style>{`
//             /* ================================
//    DASHBOARD SWITCHER BUTTONS
// ================================ */
// .dash-switcher {
//   display: flex;
//   gap: 0.5rem;
// }

// .dash-btn {
//   padding: 0.45rem 1rem;
//   border-radius: 30px;
//   border: 1px solid #d2d6dc;
//   font-size: 0.85rem;
//   background: #ffffff;
//   cursor: pointer;
//   display: flex;
//   align-items: center;
//   gap: 0.35rem;
//   transition: all 0.25s ease;
//   font-weight: 500;
//   color: #4b5563;
// }

// .dash-btn i {
//   font-size: 1rem;
// }

// .dash-btn:hover {
//   background: #f3f4f6;
//   border-color: #c4c7cc;
//   transform: translateY(-2px);
// }

// .dash-btn.active {
//   background: #5c3e94;
//   border-color: #5c3e94;
//   color: white;
//   box-shadow: 0 3px 10px rgba(92, 62, 148, 0.35);
// }

// .dash-btn.active:hover {
//   background: #4e3280;
// }
//     `
//     }</style>

//       {/* SWITCHER BUTTONS */}
//       <div className="d-flex justify-content-end mb-4">
//         <div className="dash-switcher">
//           <button
//             className={`dash-btn ${activeView === "business" ? "active" : ""}`}
//             onClick={() => setActiveView("business")}
//           >
//             <i className="bi bi-grid"></i> Business
//           </button>

//           <button
//             className={`dash-btn ${activeView === "sales" ? "active" : ""}`}
//             onClick={() => setActiveView("sales")}
//           >
//             <i className="bi bi-bar-chart-line"></i> Sales
//           </button>

//           <button
//             className={`dash-btn ${activeView === "purchases" ? "active" : ""}`}
//             onClick={() => setActiveView("purchases")}
//           >
//             <i className="bi bi-upc-scan"></i> Purchases
//           </button>

//           <button
//             className={`dash-btn ${activeView === "stock" ? "active" : ""}`}
//             onClick={() => setActiveView("stock")}
//           >
//             <i className="bi bi-box-seam"></i> Stock
//           </button>
//         </div>
//       </div>

//       {/* LOAD RELATED DASHBOARD */}
//       {activeView === "business" && <BusinessDashboard />}
//       {activeView === "sales" && <SalesDashboard />}
//       {activeView === "purchases" && <PurchaseDashboard />}
//       {activeView === "stock" && <StockDashboard setActiveView={setActiveView} />}
//       {activeView === "pivot" && (<ItemMovementPivotPage setActiveView={setActiveView} />)}
//     </div>
//   );
// };

// export default DashboardWrapper;

// src/pages/reports/DashboardWrapper.jsx
import React, { useState, useEffect } from "react";

import BusinessDashboard from "./BusinessDashboard";
import SalesDashboard from "./SalesDashboard";
import StockDashboard from "./StockDashboard";
import PurchaseDashboard from "./PurchaseDashboard";
import ItemMovementPivotPage from "./ItemMovementPivotPage"; 

import { useAuth } from "../../context/AuthContext";
import { getSalesReps } from "../../lib/api/users.api";

import "bootstrap-icons/font/bootstrap-icons.css";

const DashboardWrapper = () => {
  const [activeView, setActiveView] = useState("business");

  // 🔐 Auth
  const { user } = useAuth();
  const actorType = user?.actorType;
  const role = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  // 👤 Sales Rep filter (for Purchases + Stock)
  const [salesReps, setSalesReps] = useState([]);
  const [salesRepFilter, setSalesRepFilter] = useState("All");

  // Load sales reps only for Admin / DataEntry
  useEffect(() => {
    if (!isAdminOrDataEntry) return;

    const loadSalesReps = async () => {
      try {
        const res = await getSalesReps();
        setSalesReps(res?.data || res || []);
      } catch (err) {
        console.error("Failed to load sales reps", err);
      }
    };

    loadSalesReps();
  }, [isAdminOrDataEntry]);

  const salesRepFilterViews = ["business", "sales", "purchases", "stock"];

  const showSalesRepFilter =
    isAdminOrDataEntry && salesRepFilterViews.includes(activeView);

  return (
    <div className="container-fluid py-4 px-5">
      <style>{`
        .dash-switcher {
          display: flex;
          gap: 0.5rem;
        }

        .dash-btn {
          padding: 0.45rem 1rem;
          border-radius: 30px;
          border: 1px solid #d2d6dc;
          font-size: 0.85rem;
          background: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          transition: all 0.25s ease;
          font-weight: 500;
          color: #4b5563;
        }

        .dash-btn:hover {
          background: #f3f4f6;
          border-color: #c4c7cc;
          transform: translateY(-2px);
        }

        .dash-btn.active {
          background: #5c3e94;
          border-color: #5c3e94;
          color: white;
          box-shadow: 0 3px 10px rgba(92, 62, 148, 0.35);
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-label {
          font-size: 0.8rem;
          color: #6b7280;
          font-weight: 500;
        }

        .filter-date {
          border-radius: 20px;
          border: 1px solid #d2d6dc;
          padding: 0.35rem 0.75rem;
          font-size: 0.8rem;
          background: white;
          cursor: pointer;
        }
      `}</style>

      {/* HEADER BAR */}
      <div className="d-flex justify-content-between align-items-center mb-4">

        {/* Sales Rep Filter (Purchases + Stock) */}
        <div>
          {showSalesRepFilter && (
            <div className="filter-group">
              <span className="filter-label">Sales Rep</span>
              <select
                className="filter-date"
                value={salesRepFilter}
                onChange={(e) => setSalesRepFilter(e.target.value)}
              >
                <option value="All">All Sales Reps</option>
                {salesReps.map((sr) => (
                  <option key={sr._id} value={sr._id}>
                    {sr.repCode ? `${sr.repCode} - ${sr.name}` : sr.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* DASHBOARD SWITCHER */}
        <div className="dash-switcher">
          <button
            className={`dash-btn ${activeView === "business" ? "active" : ""}`}
            onClick={() => setActiveView("business")}
          >
            <i className="bi bi-grid"></i> Business
          </button>

          <button
            className={`dash-btn ${activeView === "sales" ? "active" : ""}`}
            onClick={() => setActiveView("sales")} 
          >
            <i className="bi bi-bar-chart-line"></i> Sales
          </button>

          <button
            className={`dash-btn ${activeView === "purchases" ? "active" : ""}`}
            onClick={() => setActiveView("purchases")}
          >
            <i className="bi bi-upc-scan"></i> Purchases
          </button>

          <button
            className={`dash-btn ${activeView === "stock" ? "active" : ""}`}
            onClick={() => setActiveView("stock")}
          >
            <i className="bi bi-box-seam"></i> Stock
          </button>
        </div>
      </div>

      {/* DASHBOARD CONTENT */}
      {activeView === "business" && (
        <BusinessDashboard salesRepId={salesRepFilter} />
      )}

      {activeView === "sales" && (
        <SalesDashboard salesRepId={salesRepFilter} />
      )}


      {activeView === "purchases" && (
        <PurchaseDashboard salesRepId={salesRepFilter} />
      )}

      {activeView === "stock" && (
        <StockDashboard
          setActiveView={setActiveView}
          salesRepId={salesRepFilter}
        />
      )}

      {activeView === "pivot" && (
        <ItemMovementPivotPage setActiveView={setActiveView} />
      )}
    </div>
  );
};

export default DashboardWrapper;
