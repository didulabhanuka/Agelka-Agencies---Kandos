// // src/pages/reports/SalesDashboard.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { ToastContainer, toast } from "react-toastify";
// import { getSalesSnapshot } from "../../lib/api/ledger.api";

// import "react-toastify/dist/ReactToastify.css";
// import "bootstrap-icons/font/bootstrap-icons.css";

// const SalesDashboard = () => {
//   // --------------------------------------------------
//   // Local state
//   // --------------------------------------------------
//   const [loading, setLoading] = useState(false);

//   const [summary, setSummary] = useState({
//     generatedAt: null,
//     totalNetRevenue: 0,
//     totalGrossRevenue: 0,
//     totalNetQty: 0,
//     invoiceCount: 0,
//     customerCount: 0,
//     branchCount: 0,

//     // return analysis
//     salesReturnRevenue: 0,
//     saleReversalRevenue: 0,
//     salesReturnReversalRevenue: 0,
//     returnImpactRevenue: 0,

//     invoiceStatus: {},
//   });

//   const [items, setItems] = useState([]);
//   const [customers, setCustomers] = useState([]);

//   const [filters, setFilters] = useState({ from: "", to: "" });
//   const [periodLabel, setPeriodLabel] = useState("");

//   // --------------------------------------------------
//   // Helpers
//   // --------------------------------------------------
//   const formatMoney = (Val) =>
//     Val == null
//       ? "—"
//       : "LKR " +
//         Number(Val).toLocaleString("en-LK", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         });

//   const formatNumber = (val) =>
//     (val || 0).toLocaleString(undefined, {
//       maximumFractionDigits: 0,
//     });

//   const formatPercent = (val) =>
//     `${(val || 0).toLocaleString(undefined, {
//       minimumFractionDigits: 1,
//       maximumFractionDigits: 1,
//     })}%`;

//   const formattedGeneratedAt = useMemo(() => {
//     if (!summary.generatedAt) return "-";
//     try {
//       const d = new Date(summary.generatedAt);
//       return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
//     } catch {
//       return summary.generatedAt;
//     }
//   }, [summary.generatedAt]);

//   const isToday = (dateStr) => {
//     if (!dateStr) return false;
//     const d = new Date(dateStr);
//     const t = new Date();
//     return (
//       d.getFullYear() === t.getFullYear() &&
//       d.getMonth() === t.getMonth() &&
//       d.getDate() === t.getDate()
//     );
//   };

//   const buildPeriodLabel = (fromStr, toStr) => {
//     if (!fromStr && !toStr) return "No period selected";

//     try {
//       const from = fromStr ? new Date(fromStr) : null;
//       const to = toStr ? new Date(toStr) : null;

//       const fmt = (d) =>
//         d.toLocaleDateString(undefined, {
//           month: "short",
//           day: "numeric",
//           year: "numeric",
//         });

//       if (from && to) {
//         return `${fmt(from)} – ${isToday(toStr) ? "Present" : fmt(to)}`;
//       }

//       if (from && !to) return `From ${fmt(from)}`;
//       if (!from && to) return `Until ${fmt(to)}`;
//       return "Custom period";
//     } catch {
//       return `${fromStr || ""} – ${toStr || ""}`;
//     }
//   };

//   // --------------------------------------------------
//   // Derived Insights
//   // --------------------------------------------------
//   const topItems = useMemo(() => {
//     return [...(items || [])]
//       .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
//       .slice(0, 5);
//   }, [items]);

//   const topCustomers = useMemo(() => {
//     return [...(customers || [])]
//       .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
//       .slice(0, 5);
//   }, [customers]);

//   const negativeRevenueItems = useMemo(
//     () => items.filter((it) => (it.totalRevenue || 0) < 0),
//     [items]
//   );

//   const totalItemRevenue = useMemo(
//     () => items.reduce((acc, it) => acc + (it.totalRevenue || 0), 0),
//     [items]
//   );

//   const totalCustomerRevenue = useMemo(
//     () => customers.reduce((acc, c) => acc + (c.totalRevenue || 0), 0),
//     [customers]
//   );

//   const highReturnRate = useMemo(() => {
//     if (!summary.totalGrossRevenue) return 0;
//     return (
//       (Math.abs(summary.returnImpactRevenue || 0) /
//         (summary.totalGrossRevenue || 1)) *
//       100
//     );
//   }, [summary.returnImpactRevenue, summary.totalGrossRevenue]);

//   // --------------------------------------------------
//   // Loader
//   // --------------------------------------------------
//   const loadSnapshot = async (from, to) => {
//     try {
//       setLoading(true);

//       const params = {};
//       if (from) params.from = from;
//       if (to) params.to = to;

//       const data = await getSalesSnapshot(params);

//       const {
//         generatedAt,
//         totalNetRevenue,
//         totalGrossRevenue,
//         totalNetQty,
//         invoiceCount,
//         customerCount,
//         branchCount,
//         returnImpact = {},
//         invoiceStatus = {},
//         items: itemsArr = [],
//         customers: customersArr = [],
//       } = data || {};

//       const {
//         salesReturnRevenue = 0,
//         saleReversalRevenue = 0,
//         salesReturnReversalRevenue = 0,
//         returnImpactRevenue = 0,
//       } = returnImpact;

//       setSummary({
//         generatedAt,
//         totalNetRevenue: totalNetRevenue || 0,
//         totalGrossRevenue: totalGrossRevenue || 0,
//         totalNetQty: totalNetQty || 0,
//         invoiceCount: invoiceCount || 0,
//         customerCount: customerCount || 0,
//         branchCount: branchCount || 0,

//         salesReturnRevenue,
//         saleReversalRevenue,
//         salesReturnReversalRevenue,
//         returnImpactRevenue,

//         invoiceStatus,
//       });

//       setItems(Array.isArray(itemsArr) ? itemsArr : []);
//       setCustomers(Array.isArray(customersArr) ? customersArr : []);
//       setPeriodLabel(buildPeriodLabel(from, to));
//     } catch (err) {
//       console.error("❌ Error loading sales snapshot:", err);
//       toast.error(
//         err?.response?.data?.message || "Failed to load sales snapshot."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --------------------------------------------------
//   // Init – load current month
//   // --------------------------------------------------
//   useEffect(() => {
//     const today = new Date();
//     const first = new Date(today.getFullYear(), today.getMonth(), 1);

//     const from = first.toISOString().slice(0, 10);
//     const to = today.toISOString().slice(0, 10);

//     setFilters({ from, to });
//     loadSnapshot(from, to);
//   }, []);

//   // --------------------------------------------------
//   // Filter handlers
//   // --------------------------------------------------
//   const handleFilterChange = (e) => {
//     const { name, value } = e.target;
//     setFilters((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleApplyFilters = () => {
//     if (!filters.from && !filters.to) {
//       toast.warn("Please select at least a From or To date.");
//       return;
//     }
//     loadSnapshot(filters.from, filters.to);
//   };

//   const handlePreset = (preset) => {
//     const now = new Date();

//     if (preset === "thisMonth") {
//       const first = new Date(now.getFullYear(), now.getMonth(), 1);
//       const from = first.toISOString().slice(0, 10);
//       const to = now.toISOString().slice(0, 10);
//       setFilters({ from, to });
//       loadSnapshot(from, to);
//       return;
//     }

//     if (preset === "last30") {
//       const past = new Date();
//       past.setDate(past.getDate() - 29);
//       const from = past.toISOString().slice(0, 10);
//       const to = now.toISOString().slice(0, 10);
//       setFilters({ from, to });
//       loadSnapshot(from, to);
//     }
//   };

//   // --------------------------------------------------
//   // Summary extraction
//   // --------------------------------------------------
//   const {
//     totalNetRevenue,
//     totalGrossRevenue,
//     totalNetQty,
//     invoiceCount,
//     customerCount,
//     branchCount,
//     salesReturnRevenue,
//     saleReversalRevenue,
//     salesReturnReversalRevenue,
//     returnImpactRevenue,
//   } = summary;

//   // --------------------------------------------------
//   // Render
//   // --------------------------------------------------
//   return (
//     <div className="container-fluid py-4 px-5">

//       {/* --------------------------------------------------
//         Header + Filters
//       -------------------------------------------------- */}
//       <div
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "flex-end",
//           gap: "2rem",
//           flexWrap: "wrap",
//           marginBottom: "1rem",
//         }}
//       >
//         {/* Header */}
//         <div className="pb-2" style={{ flex: 1 }}>
//           <h2 className="page-title">Sales Snapshot</h2>
//           <p className="page-subtitle">
//             Overview of net sales, gross sales, return impact & performance.
//           </p>

//           <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
//             Generated at: {formattedGeneratedAt}
//             <span style={{ marginLeft: "0.5rem" }}>
//               • Period: {periodLabel || "—"}
//             </span>
//           </small>
//         </div>

//         {/* Filters */}
//         <div
//           className="filter-bar"
//           style={{
//             flex: 1,
//             display: "flex",
//             justifyContent: "flex-end",
//             alignItems: "center",
//             flexWrap: "wrap",
//           }}
//         >
//           {/* Date range */}
//           <div className="filter-group" style={{ marginRight: "1rem" }}>
//             <span className="filter-label">Date Range</span>

//             <input
//               type="date"
//               name="from"
//               className="filter-date"
//               value={filters.from}
//               onChange={handleFilterChange}
//             />

//             <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>to</span>

//             <input
//               type="date"
//               name="to"
//               className="filter-date"
//               value={filters.to}
//               onChange={handleFilterChange}
//             />

//             <button
//               className="filter-apply-btn"
//               onClick={handleApplyFilters}
//               disabled={loading}
//             >
//               {loading ? (
//                 <>
//                   <span className="spinner-border spinner-border-sm"></span>
//                   <span> Loading...</span>
//                 </>
//               ) : (
//                 <>
//                   <i className="bi bi-arrow-repeat" /> Apply
//                 </>
//               )}
//             </button>
//           </div>

//           {/* Quick Presets */}
//           <div className="filter-group">
//             <span className="filter-label">Quick</span>

//             <button className="filter-chip" onClick={() => handlePreset("thisMonth")}>
//               This Month
//             </button>

//             <button className="filter-chip" onClick={() => handlePreset("last30")}>
//               Last 30 Days
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* --------------------------------------------------
//         Summary Cards
//       -------------------------------------------------- */}
//       <div className="summary-grid">

//         {/* Net Sales */}
//         <div className="summary-card orange">
//           <div className="summary-header">
//             <span className="summary-label orange">Net Sales</span>
//             <i className="bi bi-cash-stack summary-icon orange" />
//           </div>

//           <div className="summary-value">{formatMoney(totalNetRevenue)}</div>
//           <div className="summary-sub">Sales after reversals & returns.</div>
//           <div className="summary-period">Period: {periodLabel || "—"}</div>
//         </div>

//         {/* Gross Sales */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Gross Sales</span>
//             <i className="bi bi-bar-chart summary-icon" />
//           </div>

//           <div className="summary-value">{formatMoney(totalGrossRevenue)}</div>
//           <div className="summary-sub">Sales before return effects.</div>
//           <div className="summary-period">Period: {periodLabel || "—"}</div>
//         </div>

//         {/* Net Qty */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Net Qty Sold</span>
//             <i className="bi bi-box-seam summary-icon" />
//           </div>

//           <div className="summary-value">{formatNumber(totalNetQty)}</div>
//           <div className="summary-sub">Qty after reversals & returns.</div>
//           <div className="summary-period">Period: {periodLabel || "—"}</div>
//         </div>

//         {/* Invoice + Customer Stats */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Activity</span>
//             <i className="bi bi-receipt summary-icon" />
//           </div>

//           <div className="summary-value">
//             {formatNumber(invoiceCount)}{" "}
//             <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
//               invoices
//             </span>
//           </div>

//           <div className="summary-sub">
//             {formatNumber(customerCount)} customers •{" "}
//             {formatNumber(branchCount)} branches
//           </div>

//           {/* Invoice status */}
//           <div
//             style={{
//               marginTop: "0.4rem",
//               fontSize: "0.78rem",
//               display: "flex",
//               flexDirection: "column",
//               gap: "0.25rem",
//             }}
//           >
//             <div>
//               Approved:
//               <span className="badge-pill" style={{ background: "#e0e7ff", color: "#4338ca", marginLeft: 6 }}>
//                 {formatNumber(summary.invoiceStatus?.approved || 0)}
//               </span>
//             </div>

//             <div>
//               Waiting:
//               <span className="badge-pill" style={{ background: "#fef3c7", color: "#b45309", marginLeft: 6 }}>
//                 {formatNumber(summary.invoiceStatus?.waiting_for_approval || 0)}
//               </span>
//             </div>

//             <div>
//               Cancelled:
//               <span className="badge-pill" style={{ background: "#fee2e2", color: "#b91c1c", marginLeft: 6 }}>
//                 {formatNumber(summary.invoiceStatus?.cancelled || 0)}
//               </span>
//             </div>
//           </div>

//           <div className="summary-period">Period: {periodLabel || "—"}</div>
//         </div>

//         {/* Return Impact */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Return Impact</span>
//             <i className="bi bi-arrow-counterclockwise summary-icon" />
//           </div>

//           <div className="summary-value">{formatMoney(returnImpactRevenue)}</div>
//           <div className="summary-sub">
//             Net revenue effect of returns & reversals.
//           </div>
//           <div className="summary-period">
//             Return rate: {formatPercent(highReturnRate)}
//           </div>
//         </div>

//       </div>

//       {/* --------------------------------------------------
//         Insights + Alerts
//       -------------------------------------------------- */}
//       <div className="row g-2 mb-2">

//         {/* Sales Insights */}
//         <div className="col-lg-6">
//           <div className="section-card">
//             <div className="section-title">Sales Insights</div>
//             <div className="section-subtitle">
//               Highlights from items & customers.
//             </div>

//             <ul className="insights-list">
//               <li>
//                 Top item:{" "}
//                 {topItems[0] ? (
//                   <>
//                     <strong>{topItems[0].itemName}</strong>
//                     <span className="badge-pill">
//                       {formatMoney(topItems[0].totalRevenue)} sales
//                     </span>
//                   </>
//                 ) : (
//                   "No item data."
//                 )}
//               </li>

//               <li>
//                 Top customer:{" "}
//                 {topCustomers[0] ? (
//                   <>
//                     <strong>{topCustomers[0].customerName}</strong>
//                     <span className="badge-pill">
//                       {formatMoney(topCustomers[0].totalRevenue)} sales
//                     </span>
//                   </>
//                 ) : (
//                   "No customer data."
//                 )}
//               </li>

//               <li>
//                 Items in period: <strong>{items.length}</strong>
//                 <span className="badge-pill orange">
//                   Total item sales {formatMoney(totalItemRevenue)}
//                 </span>
//               </li>

//               <li>
//                 Customers in period: <strong>{customerCount}</strong>
//                 <span className="badge-pill orange">
//                   Total customer sales {formatMoney(totalCustomerRevenue)}
//                 </span>
//               </li>

//               {topItems.length > 1 && (
//                 <li>
//                   Top 5 items contribute{" "}
//                   <span className="badge-pill orange">
//                     {(() => {
//                       if (!totalItemRevenue) return "0% of sales";
//                       const sum = topItems.reduce(
//                         (acc, it) => acc + (it.totalRevenue || 0),
//                         0
//                       );
//                       return `${((sum / totalItemRevenue) * 100).toFixed(1)}% of item sales`;
//                     })()}
//                   </span>
//                 </li>
//               )}
//             </ul>
//           </div>
//         </div>

//         {/* Alerts / Risks */}
//         <div className="col-lg-6">
//           <div className="section-card">
//             <div className="section-title">Risk & Alerts</div>
//             <div className="section-subtitle">
//               Sales patterns that may require attention.
//             </div>

//             <ul className="insights-list">
//               <li>
//                 Items with negative sales:{" "}
//                 <strong>{negativeRevenueItems.length}</strong>
//                 {negativeRevenueItems.length > 0 && (
//                   <span className="badge-pill red">Check returns / pricing</span>
//                 )}
//               </li>

//               <li>
//                 High return impact:{" "}
//                 <span
//                   className={
//                     "badge-pill " +
//                     (highReturnRate > 10
//                       ? "red"
//                       : highReturnRate > 3
//                       ? "orange"
//                       : "")
//                   }
//                 >
//                   {formatPercent(highReturnRate)} of gross sales
//                 </span>
//               </li>

//               <li>
//                 Sales reversals:
//                 <span className="badge-pill red">
//                   {formatMoney(saleReversalRevenue)}
//                 </span>
//               </li>

//               <li>
//                 Sales returns:
//                 <span className="badge-pill red">
//                   {formatMoney(salesReturnRevenue)}
//                 </span>
//               </li>

//               <li>
//                 Return reversals adding back:
//                 <span className="badge-pill">
//                   {formatMoney(salesReturnReversalRevenue)}
//                 </span>
//               </li>
//             </ul>
//           </div>
//         </div>

//       </div>

//       {/* --------------------------------------------------
//         Item + Customer Tables
//       -------------------------------------------------- */}
//       <div className="row g-2">

//         {/* Item Table */}
//         <div className="col-lg-7">
//           <div className="table-container">
//             <div className="table-block">

//               <div className="d-flex justify-content-between align-items-center mb-2">
//                 <div>
//                   <div className="section-title">Item Sales</div>
//                   <div className="section-subtitle">
//                     {items.length} item{items.length === 1 ? "" : "s"} in result.
//                   </div>
//                 </div>
//               </div>

//               <div className="table-responsive" style={{ maxHeight: "360px", overflowY: "auto" }}>
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Item</th>
//                       <th>Branch</th>
//                       <th className="text-end">Qty Sold</th>
//                       <th className="text-end">Revenue</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {items.length === 0 ? (
//                       <tr>
//                         <td colSpan={4} className="text-center text-muted py-3">
//                           {loading ? "Loading item sales..." : "No item data for this period."}
//                         </td>
//                       </tr>
//                     ) : (
//                       items.map((it) => (
//                         <tr key={`${it.itemId}_${it.branchId}`}>
//                           <td>
//                             <div style={{ fontWeight: 600 }}>{it.itemName || "Unknown"}</div>
//                             <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
//                               {it.itemCode || ""}
//                             </div>
//                           </td>

//                           <td>
//                             <div style={{ fontWeight: 500 }}>{it.branchName || "Unknown"}</div>
//                           </td>

//                           <td className="text-end">
//                             {it.qtySold?.toLocaleString() ?? 0}
//                           </td>

//                           <td className="text-end">{formatMoney(it.totalRevenue)}</td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>

//             </div>
//           </div>
//         </div>

//         {/* Customer Table */}
//         <div className="col-lg-5">
//           <div className="table-container">
//             <div className="table-block">

//               <div className="d-flex justify-content-between align-items-center mb-2">
//                 <div>
//                   <div className="section-title">Customer Sales</div>
//                   <div className="section-subtitle">
//                     {customerCount} customer{customerCount === 1 ? "" : "s"} in result.
//                   </div>
//                 </div>
//               </div>

//               <div className="table-responsive" style={{ maxHeight: "360px", overflowY: "auto" }}>
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Customer</th>
//                       <th>Branch</th>
//                       <th className="text-end">Qty</th>
//                       <th className="text-end">Revenue</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {customers.length === 0 ? (
//                       <tr>
//                         <td colSpan={4} className="text-center text-muted py-3">
//                           {loading
//                             ? "Loading customer sales..."
//                             : "No customer data for this period."}
//                         </td>
//                       </tr>
//                     ) : (
//                       customers.map((c, idx) => (
//                         <tr key={`${c.customerId || "none"}_${idx}`}>
//                           <td>
//                             <div style={{ fontWeight: 600 }}>{c.customerName || "Unknown"}</div>
//                           </td>

//                           <td>
//                             <div style={{ fontWeight: 500 }}>{c.branchName || "Unknown"}</div>
//                           </td>

//                           <td className="text-end">
//                             {c.qtySold?.toLocaleString() ?? 0}
//                           </td>

//                           <td className="text-end">{formatMoney(c.totalRevenue)}</td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>

//             </div>
//           </div>
//         </div>

//       </div>

//       <ToastContainer position="top-right" autoClose={2500} />

//     </div>
//   );
// };

// export default SalesDashboard;






// src/pages/reports/SalesDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getSalesSnapshot } from "../../lib/api/ledger.api";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const SalesDashboard = () => {
  // --------------------------------------------------
  // Local state
  // --------------------------------------------------
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState({
    generatedAt: null,
    totalNetRevenue: 0,
    totalGrossRevenue: 0,
    totalNetQty: {
      primaryQty: 0,
      baseQty: 0,
    },
    invoiceCount: 0,
    customerCount: 0,
    branchCount: 0,

    // return analysis
    salesReturnRevenue: 0,
    saleReversalRevenue: 0,
    salesReturnReversalRevenue: 0,
    returnImpactRevenue: 0,

    invoiceStatus: {},
  });

  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [filters, setFilters] = useState({ from: "", to: "" });
  const [periodLabel, setPeriodLabel] = useState("");

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const formatMoney = (Val) =>
    Val == null
      ? "—"
      : "LKR " +
        Number(Val).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const formatNumber = (val) =>
    (val || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });

  const formatPercent = (val) =>
    `${(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;

  const formattedGeneratedAt = useMemo(() => {
    if (!summary.generatedAt) return "-";
    try {
      const d = new Date(summary.generatedAt);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch {
      return summary.generatedAt;
    }
  }, [summary.generatedAt]);

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const t = new Date();
    return (
      d.getFullYear() === t.getFullYear() &&
      d.getMonth() === t.getMonth() &&
      d.getDate() === t.getDate()
    );
  };

  const buildPeriodLabel = (fromStr, toStr) => {
    if (!fromStr && !toStr) return "No period selected";

    try {
      const from = fromStr ? new Date(fromStr) : null;
      const to = toStr ? new Date(toStr) : null;

      const fmt = (d) =>
        d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

      if (from && to) {
        return `${fmt(from)} – ${isToday(toStr) ? "Present" : fmt(to)}`;
      }

      if (from && !to) return `From ${fmt(from)}`;
      if (!from && to) return `Until ${fmt(to)}`;
      return "Custom period";
    } catch {
      return `${fromStr || ""} – ${toStr || ""}`;
    }
  };

  // --------------------------------------------------
  // Derived Insights
  // --------------------------------------------------
  const topItems = useMemo(() => {
    return [...(items || [])]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 5);
  }, [items]);

  const topCustomers = useMemo(() => {
    return [...(customers || [])]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 5);
  }, [customers]);

  const negativeRevenueItems = useMemo(
    () => items.filter((it) => (it.totalRevenue || 0) < 0),
    [items]
  );

  const totalItemRevenue = useMemo(
    () => items.reduce((acc, it) => acc + (it.totalRevenue || 0), 0),
    [items]
  );

  const totalCustomerRevenue = useMemo(
    () => customers.reduce((acc, c) => acc + (c.totalRevenue || 0), 0),
    [customers]
  );

  const highReturnRate = useMemo(() => {
    if (!summary.totalGrossRevenue) return 0;
    return (
      (Math.abs(summary.returnImpactRevenue || 0) /
        (summary.totalGrossRevenue || 1)) *
      100
    );
  }, [summary.returnImpactRevenue, summary.totalGrossRevenue]);

  // --------------------------------------------------
  // Loader
  // --------------------------------------------------
  const loadSnapshot = async (from, to) => {
    try {
      setLoading(true);

      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const data = await getSalesSnapshot(params);

      const {
        generatedAt,
        totalNetRevenue,
        totalGrossRevenue,
        totalNetQty: totalNetQtyRaw,
        invoiceCount,
        customerCount,
        branchCount,
        returnImpact = {},
        invoiceStatus = {},
        items: itemsArr = [],
        customers: customersArr = [],
      } = data || {};

      const {
        salesReturnRevenue = 0,
        saleReversalRevenue = 0,
        salesReturnReversalRevenue = 0,
        returnImpactRevenue = 0,
      } = returnImpact;

      // Safely normalize totalNetQty into { primaryQty, baseQty }
      const totalNetQtySafe = {
        primaryQty: totalNetQtyRaw?.primaryQty || 0,
        baseQty: totalNetQtyRaw?.baseQty || 0,
      };

      setSummary({
        generatedAt,
        totalNetRevenue: totalNetRevenue || 0,
        totalGrossRevenue: totalGrossRevenue || 0,
        totalNetQty: totalNetQtySafe,
        invoiceCount: invoiceCount || 0,
        customerCount: customerCount || 0,
        branchCount: branchCount || 0,

        salesReturnRevenue,
        saleReversalRevenue,
        salesReturnReversalRevenue,
        returnImpactRevenue,

        invoiceStatus,
      });

      setItems(Array.isArray(itemsArr) ? itemsArr : []);
      setCustomers(Array.isArray(customersArr) ? customersArr : []);
      setPeriodLabel(buildPeriodLabel(from, to));
    } catch (err) {
      console.error("❌ Error loading sales snapshot:", err);
      toast.error(
        err?.response?.data?.message || "Failed to load sales snapshot."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Init – load current month
  // --------------------------------------------------
  useEffect(() => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);

    const from = first.toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);

    setFilters({ from, to });
    loadSnapshot(from, to);
  }, []);

  // --------------------------------------------------
  // Filter handlers
  // --------------------------------------------------
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    if (!filters.from && !filters.to) {
      toast.warn("Please select at least a From or To date.");
      return;
    }
    loadSnapshot(filters.from, filters.to);
  };

  const handlePreset = (preset) => {
    const now = new Date();

    if (preset === "thisMonth") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const from = first.toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      setFilters({ from, to });
      loadSnapshot(from, to);
      return;
    }

    if (preset === "last30") {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      const from = past.toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      setFilters({ from, to });
      loadSnapshot(from, to);
    }
  };

  // --------------------------------------------------
  // Summary extraction
  // --------------------------------------------------
  const {
    totalNetRevenue,
    totalGrossRevenue,
    totalNetQty,
    invoiceCount,
    customerCount,
    branchCount,
    salesReturnRevenue,
    saleReversalRevenue,
    salesReturnReversalRevenue,
    returnImpactRevenue,
  } = summary;

  const totalNetQtyPrimary = totalNetQty?.primaryQty || 0;
  const totalNetQtyBase = totalNetQty?.baseQty || 0;

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5">
      {/* --------------------------------------------------
        Header + Filters
      -------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "2rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        {/* Header */}
        <div className="pb-2" style={{ flex: 1 }}>
          <h2 className="page-title">Sales Snapshot</h2>
          <p className="page-subtitle">
            Overview of net sales, gross sales, return impact & performance.
          </p>

          <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
            Generated at: {formattedGeneratedAt}
            <span style={{ marginLeft: "0.5rem" }}>
              • Period: {periodLabel || "—"}
            </span>
          </small>
        </div>

        {/* Filters */}
        <div
          className="filter-bar"
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Date range */}
          <div className="filter-group" style={{ marginRight: "1rem" }}>
            <span className="filter-label">Date Range</span>

            <input
              type="date"
              name="from"
              className="filter-date"
              value={filters.from}
              onChange={handleFilterChange}
            />

            <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>to</span>

            <input
              type="date"
              name="to"
              className="filter-date"
              value={filters.to}
              onChange={handleFilterChange}
            />

            <button
              className="filter-apply-btn"
              onClick={handleApplyFilters}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm"></span>
                  <span> Loading...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat" /> Apply
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="filter-group">
            <span className="filter-label">Quick</span>

            <button
              className="filter-chip"
              onClick={() => handlePreset("thisMonth")}
            >
              This Month
            </button>

            <button
              className="filter-chip"
              onClick={() => handlePreset("last30")}
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        Summary Cards
      -------------------------------------------------- */}
      <div className="summary-grid">
        {/* Net Sales */}
        <div className="summary-card orange">
          <div className="summary-header">
            <span className="summary-label orange">Net Sales</span>
            <i className="bi bi-cash-stack summary-icon orange" />
          </div>

          <div className="summary-value">
            {formatMoney(totalNetRevenue)}
          </div>
          <div className="summary-sub">Sales after reversals & returns.</div>
          <div className="summary-period">Period: {periodLabel || "—"}</div>
        </div>

        {/* Gross Sales */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Gross Sales</span>
            <i className="bi bi-bar-chart summary-icon" />
          </div>

          <div className="summary-value">
            {formatMoney(totalGrossRevenue)}
          </div>
          <div className="summary-sub">Sales before return effects.</div>
          <div className="summary-period">Period: {periodLabel || "—"}</div>
        </div>

        {/* Net Qty (Primary + Base) */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Net Qty Sold</span>
            <i className="bi bi-box-seam summary-icon" />
          </div>

          <div className="summary-value" style={{ lineHeight: 1.2 }}>
            <div>{formatNumber(totalNetQtyPrimary)} Primary</div>
            <div
              style={{
                fontSize: "0.9rem",
                color: "#6b7280",
                marginTop: "0.1rem",
              }}
            >
              {formatNumber(totalNetQtyBase)} Base
            </div>
          </div>

          <div className="summary-sub">
            Qty after reversals & returns (aggregated across all items).
          </div>
          <div className="summary-period">Period: {periodLabel || "—"}</div>
        </div>

        {/* Invoice + Customer Stats */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Activity</span>
            <i className="bi bi-receipt summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(invoiceCount)}{" "}
            <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              invoices
            </span>
          </div>

          <div className="summary-sub">
            {formatNumber(customerCount)} customers •{" "}
            {formatNumber(branchCount)} branches
          </div>

          {/* Invoice status */}
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.78rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <div>
              Approved:
              <span
                className="badge-pill"
                style={{
                  background: "#e0e7ff",
                  color: "#4338ca",
                  marginLeft: 6,
                }}
              >
                {formatNumber(summary.invoiceStatus?.approved || 0)}
              </span>
            </div>

            <div>
              Waiting:
              <span
                className="badge-pill"
                style={{
                  background: "#fef3c7",
                  color: "#b45309",
                  marginLeft: 6,
                }}
              >
                {formatNumber(
                  summary.invoiceStatus?.waiting_for_approval || 0
                )}
              </span>
            </div>

            <div>
              Cancelled:
              <span
                className="badge-pill"
                style={{
                  background: "#fee2e2",
                  color: "#b91c1c",
                  marginLeft: 6,
                }}
              >
                {formatNumber(summary.invoiceStatus?.cancelled || 0)}
              </span>
            </div>
          </div>

          <div className="summary-period">Period: {periodLabel || "—"}</div>
        </div>

        {/* Return Impact */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Return Impact</span>
            <i className="bi bi-arrow-counterclockwise summary-icon" />
          </div>

          <div className="summary-value">
            {formatMoney(returnImpactRevenue)}
          </div>
          <div className="summary-sub">
            Net revenue effect of returns & reversals.
          </div>
          <div className="summary-period">
            Return rate: {formatPercent(highReturnRate)}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        Insights + Alerts
      -------------------------------------------------- */}
      <div className="row g-2 mb-2">
        {/* Sales Insights */}
        <div className="col-lg-6">
          <div className="section-card">
            <div className="section-title">Sales Insights</div>
            <div className="section-subtitle">
              Highlights from items & customers.
            </div>

            <ul className="insights-list">
              <li>
                Top item:{" "}
                {topItems[0] ? (
                  <>
                    <strong>{topItems[0].itemName}</strong>
                    <span className="badge-pill">
                      {formatMoney(topItems[0].totalRevenue)} sales
                    </span>
                  </>
                ) : (
                  "No item data."
                )}
              </li>

              <li>
                Top customer:{" "}
                {topCustomers[0] ? (
                  <>
                    <strong>{topCustomers[0].customerName}</strong>
                    <span className="badge-pill">
                      {formatMoney(topCustomers[0].totalRevenue)} sales
                    </span>
                  </>
                ) : (
                  "No customer data."
                )}
              </li>

              <li>
                Items in period: <strong>{items.length}</strong>
                <span className="badge-pill orange">
                  Total item sales {formatMoney(totalItemRevenue)}
                </span>
              </li>

              <li>
                Customers in period: <strong>{customerCount}</strong>
                <span className="badge-pill orange">
                  Total customer sales {formatMoney(totalCustomerRevenue)}
                </span>
              </li>

              {topItems.length > 1 && (
                <li>
                  Top 5 items contribute{" "}
                  <span className="badge-pill orange">
                    {(() => {
                      if (!totalItemRevenue) return "0% of sales";
                      const sum = topItems.reduce(
                        (acc, it) => acc + (it.totalRevenue || 0),
                        0
                      );
                      return `${(
                        (sum / totalItemRevenue) *
                        100
                      ).toFixed(1)}% of item sales`;
                    })()}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Alerts / Risks */}
        <div className="col-lg-6">
          <div className="section-card">
            <div className="section-title">Risk & Alerts</div>
            <div className="section-subtitle">
              Sales patterns that may require attention.
            </div>

            <ul className="insights-list">
              <li>
                Items with negative sales:{" "}
                <strong>{negativeRevenueItems.length}</strong>
                {negativeRevenueItems.length > 0 && (
                  <span className="badge-pill red">
                    Check returns / pricing
                  </span>
                )}
              </li>

              <li>
                High return impact:{" "}
                <span
                  className={
                    "badge-pill " +
                    (highReturnRate > 10
                      ? "red"
                      : highReturnRate > 3
                      ? "orange"
                      : "")
                  }
                >
                  {formatPercent(highReturnRate)} of gross sales
                </span>
              </li>

              <li>
                Sales reversals:
                <span className="badge-pill red">
                  {formatMoney(saleReversalRevenue)}
                </span>
              </li>

              <li>
                Sales returns:
                <span className="badge-pill red">
                  {formatMoney(salesReturnRevenue)}
                </span>
              </li>

              <li>
                Return reversals adding back:
                <span className="badge-pill">
                  {formatMoney(salesReturnReversalRevenue)}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        Item + Customer Tables
      -------------------------------------------------- */}
      <div className="row g-2">
        {/* Item Table */}
        <div className="col-lg-7">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Item Sales</div>
                  <div className="section-subtitle">
                    {items.length} item{items.length === 1 ? "" : "s"} in
                    result.
                  </div>
                </div>
              </div>

              <div
                className="table-responsive"
                style={{ maxHeight: "360px", overflowY: "auto" }}
              >
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Branch</th>
                      <th className="text-end">Qty Sold</th>
                      <th className="text-end">Revenue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center text-muted py-3"
                        >
                          {loading
                            ? "Loading item sales..."
                            : "No item data for this period."}
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={`${it.itemId}_${it.branchId}`}>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {it.itemName || "Unknown"}
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                              }}
                            >
                              {it.itemCode || ""}
                            </div>
                          </td>

                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {it.branchName || "Unknown"}
                            </div>
                          </td>

                          <td className="text-end">
                            {/* Display human-readable qty from backend */}
                            <div>{it.qtyDisplay || "—"}</div>
                            {/* Optional base-equivalent hint if available */}
                            {typeof it.qtySoldBaseEq === "number" && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "#9ca3af",
                                }}
                              >
                                {it.qtySoldBaseEq.toLocaleString()} base units
                              </div>
                            )}
                          </td>

                          <td className="text-end">
                            {formatMoney(it.totalRevenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Table */}
        <div className="col-lg-5">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Customer Sales</div>
                  <div className="section-subtitle">
                    {customerCount} customer
                    {customerCount === 1 ? "" : "s"} in result.
                  </div>
                </div>
              </div>

              <div
                className="table-responsive"
                style={{ maxHeight: "360px", overflowY: "auto" }}
              >
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Branch</th>
                      <th className="text-end">Revenue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center text-muted py-3"
                        >
                          {loading
                            ? "Loading customer sales..."
                            : "No customer data for this period."}
                        </td>
                      </tr>
                    ) : (
                      customers.map((c, idx) => {
                        const p =
                          c.qtySold?.primaryQty != null
                            ? c.qtySold.primaryQty
                            : 0;
                        const b =
                          c.qtySold?.baseQty != null ? c.qtySold.baseQty : 0;

                        return (
                          <tr key={`${c.customerId || "none"}_${idx}`}>
                            <td>
                              <div style={{ fontWeight: 600 }}>
                                {c.customerName || "Unknown"}
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: 500 }}>
                                {c.branchName || "Unknown"}
                              </div>
                            </td>

                            <td className="text-end">
                              {formatMoney(c.totalRevenue)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={2500} />
    </div>
  );
};

export default SalesDashboard;
