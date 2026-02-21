// // src/pages/reports/PurchaseDashboard.jsx

// import React, { useEffect, useMemo, useState } from "react";
// import { ToastContainer, toast } from "react-toastify";
// import { getPurchaseSnapshot } from "../../lib/api/ledger.api";

// import "bootstrap-icons/font/bootstrap-icons.css";
// import "react-toastify/dist/ReactToastify.css";

// const PurchaseDashboard = ({ salesRepId }) => {
//   const [loading, setLoading] = useState(false);

//   // --------------------------------------------------
//   // Summary state
//   // --------------------------------------------------
//   const [summary, setSummary] = useState({
//     generatedAt: null,
//     totalNetPurchase: 0,
//     totalGrossPurchase: 0,
//     totalNetQty: 0,
//     grnCount: 0,
//     supplierCount: 0,
//     branchCount: 0,

//     purchaseReturnCost: 0,
//     purchaseReversalCost: 0,
//     purchaseReturnReversalCost: 0,
//     returnImpactCost: 0,

//     grnStatus: {
//       approved: 0,
//       waiting_for_approval: 0,
//       cancelled: 0,
//     },
//   });

//   // --------------------------------------------------
//   // Data lists
//   // --------------------------------------------------
//   const [items, setItems] = useState([]);
//   const [suppliers, setSuppliers] = useState([]);

//   // --------------------------------------------------
//   // Filters + period label
//   // --------------------------------------------------
//   const [filters, setFilters] = useState({ from: "", to: "" });
//   const [periodLabel, setPeriodLabel] = useState("");

//   // --------------------------------------------------
//   // Formatting helpers
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
//     (val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

//   const formatPercent = (val) =>
//     `${(val || 0).toLocaleString(undefined, {
//       minimumFractionDigits: 1,
//       maximumFractionDigits: 1,
//     })}%`;

//   // --------------------------------------------------
//   // Derived display values
//   // --------------------------------------------------
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
//     return d.toDateString() === t.toDateString();
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
//       if (from) return `From ${fmt(from)}`;
//       if (to) return `Until ${fmt(to)}`;
//     } catch {
//       return `${fromStr || ""} – ${toStr || ""}`;
//     }

//     return "Custom period";
//   };

//   // --------------------------------------------------
//   // Insights
//   // --------------------------------------------------
//   const topItems = useMemo(() => {
//     return [...items]
//       .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
//       .slice(0, 5);
//   }, [items]);

//   const topSuppliers = useMemo(() => {
//     return [...suppliers]
//       .sort((a, b) => (b.totalCostValue || 0) - (a.totalCostValue || 0))
//       .slice(0, 5);
//   }, [suppliers]);

//   const negativeCostItems = useMemo(
//     () => items.filter((it) => (it.totalCost || 0) < 0),
//     [items]
//   );

//   const highReturnRate = useMemo(() => {
//     if (!summary.totalGrossPurchase) return 0;
//     return (
//       (Math.abs(summary.returnImpactCost || 0) /
//         (summary.totalGrossPurchase || 1)) *
//       100
//     );
//   }, [summary.returnImpactCost, summary.totalGrossPurchase]);

//   const totalItemCost = useMemo(
//     () => items.reduce((sum, it) => sum + (it.totalCost || 0), 0),
//     [items]
//   );

//   const totalSupplierCost = useMemo(
//     () => suppliers.reduce((sum, s) => sum + (s.totalCostValue || 0), 0),
//     [suppliers]
//   );

//   // --------------------------------------------------
//   // Load data
//   // --------------------------------------------------
//   const loadSnapshot = async (from, to) => {
//     try {
//       setLoading(true);

//       const params = {};
//       if (from) params.from = from;
//       if (to) params.to = to;

//       // 🔹 Inject Sales Rep filter from wrapper
//       if (salesRepId && salesRepId !== "All") {
//         params.salesRep = salesRepId;
//       }

//       const data = await getPurchaseSnapshot(params);

//       if (!data) throw new Error("No snapshot returned");

//       const {
//         generatedAt,
//         totalNetPurchase,
//         totalGrossPurchase,
//         totalNetQty,
//         grnCount,
//         supplierCount,
//         branchCount,
//         returnImpact = {},
//         grnStatus = {},
//         items: itemRows = [],
//         suppliers: supplierRows = [],
//       } = data;

//       const {
//         purchaseReturnCost = 0,
//         purchaseReversalCost = 0,
//         purchaseReturnReversalCost = 0,
//         returnImpactCost = 0,
//       } = returnImpact;

//       setSummary({
//         generatedAt,
//         totalNetPurchase: totalNetPurchase || 0,
//         totalGrossPurchase: totalGrossPurchase || 0,
//         totalNetQty: totalNetQty || 0,
//         grnCount: grnCount || 0,
//         supplierCount: supplierCount || 0,
//         branchCount: branchCount || 0,

//         purchaseReturnCost,
//         purchaseReversalCost,
//         purchaseReturnReversalCost,
//         returnImpactCost,
//         grnStatus,
//       });

//       setItems(Array.isArray(itemRows) ? itemRows : []);
//       setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
//       setPeriodLabel(buildPeriodLabel(from, to));
//     } catch (err) {
//       console.error("❌ Error loading purchase snapshot:", err);
//       toast.error(
//         err?.response?.data?.message || "Failed to load purchase snapshot."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --------------------------------------------------
//   // Initial load + reload on Sales Rep change
//   // --------------------------------------------------
//   useEffect(() => {
//     const today = new Date();
//     const first = new Date(today.getFullYear(), today.getMonth(), 1);

//     const fromStr = first.toISOString().slice(0, 10);
//     const toStr = today.toISOString().slice(0, 10);

//     setFilters({ from: fromStr, to: toStr });
//     loadSnapshot(fromStr, toStr);
//   }, [salesRepId]); // 🔹 reload when rep changes

//   // --------------------------------------------------
//   // Filter handling
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

//   // --------------------------------------------------
//   // Extract summary for render
//   // --------------------------------------------------
//   const {
//     totalNetPurchase,
//     totalGrossPurchase,
//     totalNetQty,
//     grnCount,
//     supplierCount,
//     branchCount,
//     purchaseReturnCost,
//     purchaseReversalCost,
//     purchaseReturnReversalCost,
//     returnImpactCost,
//     grnStatus,
//   } = summary;
  
//   // --------------------------------------------------
//   // Render
//   // --------------------------------------------------
//   return (
//     <div className="container-fluid py-4 px-5">

//       {/* --------------------------------------------------
//         HEADER + FILTER BAR
//       -------------------------------------------------- */}
//       <div className="d-flex justify-content-between align-items-end flex-wrap mb-3">
//         <div>
//           <h2 className="page-title">Purchase Snapshot</h2>
//           <p className="page-subtitle">
//             Overview of purchases, returns, GRNs, suppliers & items.
//           </p>
//           <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
//             Generated at: {formattedGeneratedAt}
//           </small>
//         </div>

//         <div className="row filter-bar">
//           <div className="col-md-5 filter-group me-3">
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
//                   <span className="spinner-border spinner-border-sm me-1"></span>
//                   Loading...
//                 </>
//               ) : (
//                 <>
//                   <i className="bi bi-arrow-repeat me-1" /> Apply
//                 </>
//               )}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* --------------------------------------------------
//         SUMMARY CARDS
//       -------------------------------------------------- */}
//       <div className="summary-grid">

//         {/* Net Purchases */}
//         <div className="summary-card orange">
//           <div className="summary-header">
//             <span className="summary-label orange">Net Purchases</span>
//             <i className="bi bi-cash-stack summary-icon orange" />
//           </div>
//           <div className="summary-value">{formatMoney(totalNetPurchase)}</div>
//           <div className="summary-sub">Purchase cost after returns & reversals.</div>
//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>

//         {/* Gross Purchases */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Gross Purchases</span>
//             <i className="bi bi-bar-chart summary-icon" />
//           </div>
//           <div className="summary-value">{formatMoney(totalGrossPurchase)}</div>
//           <div className="summary-sub">Total purchase cost before return effects.</div>
//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>

//         {/* Net Qty */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Net Qty Purchased</span>
//             <i className="bi bi-box-seam summary-icon" />
//           </div>
//           <div className="summary-value">{formatNumber(totalNetQty)}</div>
//           <div className="summary-sub">Net quantity after adjustments.</div>
//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>

//         {/* Activity */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Activity</span>
//             <i className="bi bi-receipt summary-icon" />
//           </div>

//           <div className="summary-value">
//             {formatNumber(grnCount)}{" "}
//             <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>GRNs</span>
//           </div>

//           <div className="summary-sub">
//             {formatNumber(supplierCount)} suppliers •{" "}
//             {formatNumber(branchCount)} branches
//           </div>

//           <div
//             style={{
//               marginTop: "0.4rem",
//               fontSize: "0.78rem",
//               display: "flex",
//               flexDirection: "column",
//               gap: "0.25rem",
//               color: "#4b5563",
//             }}
//           >
//             <div>
//               Approved:
//               <span className="badge-pill blue">
//                 {formatNumber(grnStatus?.approved || 0)}
//               </span>
//             </div>

//             <div>
//               Waiting:
//               <span className="badge-pill yellow">
//                 {formatNumber(grnStatus?.waiting_for_approval || 0)}
//               </span>
//             </div>

//             <div>
//               Cancelled:
//               <span className="badge-pill red">
//                 {formatNumber(grnStatus?.cancelled || 0)}
//               </span>
//             </div>
//           </div>

//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>

//         {/* Return Impact */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Return Impact</span>
//             <i className="bi bi-arrow-counterclockwise summary-icon" />
//           </div>
//           <div className="summary-value">{formatMoney(returnImpactCost)}</div>
//           <div className="summary-sub">Net cost effect of purchase returns.</div>
//           <div className="summary-period">
//             Return rate: {formatPercent(highReturnRate)}
//           </div>
//         </div>
//       </div>

//       {/* --------------------------------------------------
//         INSIGHTS
//       -------------------------------------------------- */}
//       <div className="row g-2 mb-2">

//         {/* Purchase Insights */}
//         <div className="col-lg-6">
//           <div className="section-card">
//             <div className="section-title">Purchase Insights</div>
//             <div className="section-subtitle">Top items & suppliers.</div>

//             <ul className="insights-list">
//               <li>
//                 Top item:{" "}
//                 {topItems[0] ? (
//                   <>
//                     <strong>{topItems[0].itemName}</strong>{" "}
//                     <span className="badge-pill">
//                       {formatMoney(topItems[0].totalCost)}
//                     </span>
//                   </>
//                 ) : (
//                   "No item data."
//                 )}
//               </li>

//               <li>
//                 Top supplier:{" "}
//                 {topSuppliers[0] ? (
//                   <>
//                     <strong>{topSuppliers[0].supplierName}</strong>{" "}
//                     <span className="badge-pill">
//                       {formatMoney(topSuppliers[0].totalCostValue)}
//                     </span>
//                   </>
//                 ) : (
//                   "No supplier data."
//                 )}
//               </li>

//               <li>
//                 Items in period: <strong>{items.length}</strong>{" "}
//                 <span className="badge-pill orange">
//                   Total {formatMoney(totalItemCost)}
//                 </span>
//               </li>

//               <li>
//                 Suppliers in period: <strong>{supplierCount}</strong>{" "}
//                 <span className="badge-pill orange">
//                   Total {formatMoney(totalSupplierCost)}
//                 </span>
//               </li>

//               {topItems.length > 1 && (
//                 <li>
//                   Top 5 items contribute{" "}
//                   <span className="badge-pill orange">
//                     {(() => {
//                       if (!totalItemCost) return "0%";
//                       const top5 = topItems.reduce(
//                         (sum, it) => sum + (it.totalCost || 0),
//                         0
//                       );
//                       return `${((top5 / totalItemCost) * 100).toFixed(1)}%`;
//                     })()}
//                   </span>{" "}
//                   of purchases
//                 </li>
//               )}
//             </ul>
//           </div>
//         </div>

//         {/* Risk Alerts */}
//         <div className="col-lg-6">
//           <div className="section-card">
//             <div className="section-title">Risk & Alerts</div>
//             <div className="section-subtitle">Patterns requiring attention.</div>

//             <ul className="insights-list">
//               <li>
//                 Items with negative cost:{" "}
//                 <strong>{negativeCostItems.length}</strong>{" "}
//                 {negativeCostItems.length > 0 && (
//                   <span className="badge-pill red">Check pricing</span>
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
//                   {formatPercent(highReturnRate)}
//                 </span>
//               </li>

//               <li>
//                 Purchase reversals:{" "}
//                 <span className="badge-pill red">
//                   {formatMoney(purchaseReversalCost)}
//                 </span>
//               </li>

//               <li>
//                 Purchase returns:{" "}
//                 <span className="badge-pill red">
//                   {formatMoney(purchaseReturnCost)}
//                 </span>
//               </li>

//               <li>
//                 Return reversals added back:{" "}
//                 <span className="badge-pill">
//                   {formatMoney(purchaseReturnReversalCost)}
//                 </span>
//               </li>
//             </ul>
//           </div>
//         </div>
//       </div>

//       {/* --------------------------------------------------
//         TABLES
//       -------------------------------------------------- */}
//       <div className="row g-2">

//         {/* Items */}
//         <div className="col-lg-7">
//           <div className="table-container">
//             <div className="table-block">
//               <div className="section-title">Item Purchases</div>
//               <div className="section-subtitle">
//                 {items.length} item{items.length === 1 ? "" : "s"}.
//               </div>

//               <div className="table-responsive" style={{ maxHeight: "360px" }}>
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Item</th>
//                       <th>Branch</th>
//                       <th className="text-end">Qty</th>
//                       <th className="text-end">Cost</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {items.length === 0 ? (
//                       <tr>
//                         <td colSpan={4} className="text-center text-muted py-3">
//                           {loading ? "Loading..." : "No item data."}
//                         </td>
//                       </tr>
//                     ) : (
//                       items.map((it) => (
//                         <tr key={`${it.itemId}_${it.branchId}`}>
//                           <td>
//                             <div style={{ fontWeight: 600 }}>{it.itemName}</div>
//                             <small className="text-muted">{it.itemCode}</small>
//                           </td>

//                           <td>{it.branchName}</td>

//                           <td className="text-end">
//                             {it.qtyPurchased?.toLocaleString() ?? 0}
//                           </td>

//                           <td className="text-end">
//                             {formatMoney(it.totalCost)}
//                           </td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Suppliers */}
//         <div className="col-lg-5">
//           <div className="table-container">
//             <div className="table-block">
//               <div className="section-title">Supplier Purchases</div>
//               <div className="section-subtitle">
//                 {supplierCount} supplier{supplierCount === 1 ? "" : "s"}.
//               </div>

//               <div className="table-responsive" style={{ maxHeight: "360px" }}>
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Supplier</th>
//                       <th className="text-end">Qty</th>
//                       <th className="text-end">Cost</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {suppliers.length === 0 ? (
//                       <tr>
//                         <td colSpan={3} className="text-center text-muted py-3">
//                           {loading ? "Loading..." : "No supplier data."}
//                         </td>
//                       </tr>
//                     ) : (
//                       suppliers.map((s, idx) => (
//                         <tr key={`${s.supplierId}_${idx}`}>
//                           <td>{s.supplierName}</td>

//                           <td className="text-end">
//                             {s.totalQty?.toLocaleString() ?? 0}
//                           </td>

//                           <td className="text-end">
//                             {formatMoney(s.totalCostValue)}
//                           </td>
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

// export default PurchaseDashboard;








// src/pages/reports/PurchaseDashboard.jsx

// src/pages/reports/PurchaseDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getPurchaseSnapshot } from "../../lib/api/ledger.api";
import { getItems } from "../../lib/api/inventory.api"; // Importing getItems to fetch UOM details

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

const PurchaseDashboard = ({ salesRepId }) => {
  const [loading, setLoading] = useState(false);

  // --------------------------------------------------
  // Summary state
  // --------------------------------------------------
  const [summary, setSummary] = useState({
    generatedAt: null,
    totalNetPurchase: 0,
    totalGrossPurchase: 0,
    totalNetQty: { baseQty: 0, primaryQty: 0 },
    grnCount: 0,
    supplierCount: 0,
    branchCount: 0,
    purchaseReturnCost: 0,
    purchaseReversalCost: 0,
    purchaseReturnReversalCost: 0,
    returnImpactCost: 0,
    grnStatus: {
      approved: 0,
      waiting_for_approval: 0,
      cancelled: 0,
    },
  });

  // --------------------------------------------------
  // Data lists
  // --------------------------------------------------
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // --------------------------------------------------
  // UOM map: { [itemId]: { primaryUom, baseUom } }
  const [itemUomMap, setItemUomMap] = useState({});

  // --------------------------------------------------
  // Filters + period label
  // --------------------------------------------------
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [periodLabel, setPeriodLabel] = useState("");

  // --------------------------------------------------
  // Formatting helpers
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
    (val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const formatQtyCombined = (primaryQty = 0, baseQty = 0) => {
    const p = primaryQty || 0;
    const b = baseQty || 0;
    const parts = [];
    if (p) parts.push(`${formatNumber(p)} ${p > 1 ? "PACKS" : "PACK"}`);
    if (b) parts.push(`${formatNumber(b)} ${b > 1 ? "PIECES" : "PIECE"}`);
    if (!parts.length) return "0";
    return parts.join(" + ");
  };

  // Format percentages
  const formatPercent = (val) =>
    `${(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;

  // --------------------------------------------------
  // Derived display values
  // --------------------------------------------------
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
    return d.toDateString() === t.toDateString();
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
      if (from) return `From ${fmt(from)}`;
      if (to) return `Until ${fmt(to)}`;
    } catch {
      return `${fromStr || ""} – ${toStr || ""}`;
    }

    return "Custom period";
  };

  // --------------------------------------------------
  // Insights
  // --------------------------------------------------
  const topItems = useMemo(() => {
    return [...items]
      .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
      .slice(0, 5);
  }, [items]);

  const topSuppliers = useMemo(() => {
    return [...suppliers]
      .sort((a, b) => (b.totalCostValue || 0) - (a.totalCostValue || 0))
      .slice(0, 5);
  }, [suppliers]);

  const negativeCostItems = useMemo(
    () => items.filter((it) => (it.totalCost || 0) < 0),
    [items]
  );

  const highReturnRate = useMemo(() => {
    if (!summary.totalGrossPurchase) return 0;
    return (
      (Math.abs(summary.returnImpactCost || 0) /
        (summary.totalGrossPurchase || 1)) *
      100
    );
  }, [summary.returnImpactCost, summary.totalGrossPurchase]);

  const totalItemCost = useMemo(
    () => items.reduce((sum, it) => sum + (it.totalCost || 0), 0),
    [items]
  );

  const totalSupplierCost = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.totalCostValue || 0), 0),
    [suppliers]
  );

  // --------------------------------------------------
  // Load data
  // --------------------------------------------------
  const loadSnapshot = async (from, to) => {
    try {
      setLoading(true);

      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;

      // 🔹 Inject Sales Rep filter from wrapper
      if (salesRepId && salesRepId !== "All") {
        params.salesRep = salesRepId;
      }

      // 🔹 Parallel: snapshot + items (for UOM labels)
      const [data, itemsRes] = await Promise.all([
        getPurchaseSnapshot(params),
        getItems({}), // Fetch UOMs for items
      ]);

      const {
        generatedAt,
        totalNetPurchase,
        totalGrossPurchase,
        totalNetQty,
        grnCount,
        supplierCount,
        branchCount,
        returnImpact = {},
        grnStatus = {},
        items: itemRows = [],
        suppliers: supplierRows = [],
      } = data;

      const {
        purchaseReturnCost = 0,
        purchaseReversalCost = 0,
        purchaseReturnReversalCost = 0,
        returnImpactCost = 0,
      } = returnImpact;

      setSummary({
        generatedAt,
        totalNetPurchase: totalNetPurchase || 0,
        totalGrossPurchase: totalGrossPurchase || 0,
        totalNetQty,
        grnCount: grnCount || 0,
        supplierCount: supplierCount || 0,
        branchCount: branchCount || 0,

        purchaseReturnCost,
        purchaseReversalCost,
        purchaseReturnReversalCost,
        returnImpactCost,
        grnStatus,
      });

      setItems(Array.isArray(itemRows) ? itemRows : []);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
      setPeriodLabel(buildPeriodLabel(from, to));

      // 🔹 Build UOM map from items
      const uomMap = {};
      (itemsRes || []).forEach((it) => {
        uomMap[it._id] = {
          primaryUom: it.primaryUom || null,
          baseUom: it.baseUom || null,
        };
      });
      setItemUomMap(uomMap);
    } catch (err) {
      console.error("❌ Error loading purchase snapshot:", err);
      toast.error(
        err?.response?.data?.message || "Failed to load purchase snapshot."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Initial load + reload on Sales Rep change
  // --------------------------------------------------
  useEffect(() => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);

    const fromStr = first.toISOString().slice(0, 10);
    const toStr = today.toISOString().slice(0, 10);

    setFilters({ from: fromStr, to: toStr });
    loadSnapshot(fromStr, toStr);
  }, [salesRepId]); // 🔹 reload when rep changes

  // --------------------------------------------------
  // Filter handling
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

  // --------------------------------------------------
  // Extract summary for render
  // --------------------------------------------------
  const {
    totalNetPurchase,
    totalGrossPurchase,
    totalNetQty,
    grnCount,
    supplierCount,
    branchCount,
    purchaseReturnCost,
    purchaseReversalCost,
    purchaseReturnReversalCost,
    returnImpactCost,
    grnStatus,
  } = summary;

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="container-fluid py-4 px-5">
      {/* --------------------------------------------------
        HEADER + FILTER BAR
      -------------------------------------------------- */}
      <div className="d-flex justify-content-between align-items-end flex-wrap mb-3">
        <div>
          <h2 className="page-title">Purchase Snapshot</h2>
          <p className="page-subtitle">
            Overview of purchases, returns, GRNs, suppliers & items.
          </p>
          <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
            Generated at: {formattedGeneratedAt}
          </small>
        </div>

        <div className="row filter-bar">
          <div className="col-md-5 filter-group me-3">
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
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Loading...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat me-1" /> Apply
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        SUMMARY CARDS
      -------------------------------------------------- */}
      <div className="summary-grid">

        {/* Net Purchases */}
        <div className="summary-card orange">
          <div className="summary-header">
            <span className="summary-label orange">Net Purchases</span>
            <i className="bi bi-cash-stack summary-icon orange" />
          </div>
          <div className="summary-value">{formatMoney(totalNetPurchase)}</div>
          <div className="summary-sub">Purchase cost after returns & reversals.</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Gross Purchases */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Gross Purchases</span>
            <i className="bi bi-bar-chart summary-icon" />
          </div>
          <div className="summary-value">{formatMoney(totalGrossPurchase)}</div>
          <div className="summary-sub">Total purchase cost before return effects.</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Net Qty */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Net Qty Purchased</span>
            <i className="bi bi-box-seam summary-icon" />
          </div>
          <div className="summary-value">
            {formatQtyCombined(totalNetQty.primaryQty, totalNetQty.baseQty)}
          </div>
          <div className="summary-sub">Net quantity after adjustments.</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Activity */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Activity</span>
            <i className="bi bi-receipt summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(grnCount)}{" "}
            <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>GRNs</span>
          </div>

          <div className="summary-sub">
            {formatNumber(supplierCount)} suppliers •{" "}
            {formatNumber(branchCount)} branches
          </div>

          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.78rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              color: "#4b5563",
            }}
          >
            <div>
              Approved:
              <span className="badge-pill blue">
                {formatNumber(grnStatus?.approved || 0)}
              </span>
            </div>

            <div>
              Waiting:
              <span className="badge-pill yellow">
                {formatNumber(grnStatus?.waiting_for_approval || 0)}
              </span>
            </div>

            <div>
              Cancelled:
              <span className="badge-pill red">
                {formatNumber(grnStatus?.cancelled || 0)}
              </span>
            </div>
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Return Impact */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Return Impact</span>
            <i className="bi bi-arrow-counterclockwise summary-icon" />
          </div>
          <div className="summary-value">{formatMoney(returnImpactCost)}</div>
          <div className="summary-sub">Net cost effect of purchase returns.</div>
          <div className="summary-period">
            Return rate: {formatPercent(highReturnRate)}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        INSIGHTS
      -------------------------------------------------- */}
      <div className="row g-2 mb-2">

        {/* Purchase Insights */}
        <div className="col-lg-6">
          <div className="section-card">
            <div className="section-title">Purchase Insights</div>
            <div className="section-subtitle">Top items & suppliers.</div>

            <ul className="insights-list">
              <li>
                Top item:{" "}
                {topItems[0] ? (
                  <>
                    <strong>{topItems[0].itemName}</strong>{" "}
                    <span className="badge-pill">
                      {formatMoney(topItems[0].totalCost)}
                    </span>
                  </>
                ) : (
                  "No item data."
                )}
              </li>

              <li>
                Top supplier:{" "}
                {topSuppliers[0] ? (
                  <>
                    <strong>{topSuppliers[0].supplierName}</strong>{" "}
                    <span className="badge-pill">
                      {formatMoney(topSuppliers[0].totalCostValue)}
                    </span>
                  </>
                ) : (
                  "No supplier data."
                )}
              </li>

              <li>
                Items in period: <strong>{items.length}</strong>{" "}
                <span className="badge-pill orange">
                  Total {formatMoney(totalItemCost)}
                </span>
              </li>

              <li>
                Suppliers in period: <strong>{supplierCount}</strong>{" "}
                <span className="badge-pill orange">
                  Total {formatMoney(totalSupplierCost)}
                </span>
              </li>

              {topItems.length > 1 && (
                <li>
                  Top 5 items contribute{" "}
                  <span className="badge-pill orange">
                    {(() => {
                      if (!totalItemCost) return "0%";
                      const top5 = topItems.reduce(
                        (sum, it) => sum + (it.totalCost || 0),
                        0
                      );
                      return `${((top5 / totalItemCost) * 100).toFixed(1)}%`;
                    })()}
                  </span>{" "}
                  of purchases
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="col-lg-6">
          <div className="section-card">
            <div className="section-title">Risk & Alerts</div>
            <div className="section-subtitle">Patterns requiring attention.</div>

            <ul className="insights-list">
              <li>
                Items with negative cost:{" "}
                <strong>{negativeCostItems.length}</strong>{" "}
                {negativeCostItems.length > 0 && (
                  <span className="badge-pill red">Check pricing</span>
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
                  {formatPercent(highReturnRate)}
                </span>
              </li>

              <li>
                Purchase reversals:{" "}
                <span className="badge-pill red">
                  {formatMoney(purchaseReversalCost)}
                </span>
              </li>

              <li>
                Purchase returns:{" "}
                <span className="badge-pill red">
                  {formatMoney(purchaseReturnCost)}
                </span>
              </li>

              <li>
                Return reversals added back:{" "}
                <span className="badge-pill">
                  {formatMoney(purchaseReturnReversalCost)}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------
        TABLES
      -------------------------------------------------- */}
      <div className="row g-2">

        {/* Items */}
        <div className="col-lg-7">
          <div className="table-container">
            <div className="table-block">
              <div className="section-title">Item Purchases</div>
              <div className="section-subtitle">
                {items.length} item{items.length === 1 ? "" : "s"}.
              </div>

              <div className="table-responsive" style={{ maxHeight: "360px" }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Branch</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          {loading ? "Loading..." : "No item data."}
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={`${it.itemId}_${it.branchId}`}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{it.itemName}</div>
                            <small className="text-muted">{it.itemCode}</small>
                          </td>

                          <td>{it.branchName}</td>

                          <td className="text-end">
                            {formatQtyCombined(it.qtyPurchased?.primaryQty, it.qtyPurchased?.baseQty)}
                          </td>

                          <td className="text-end">
                            {formatMoney(it.totalCost)}
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

        {/* Suppliers */}
        <div className="col-lg-5">
          <div className="table-container">
            <div className="table-block">
              <div className="section-title">Supplier Purchases</div>
              <div className="section-subtitle">
                {supplierCount} supplier{supplierCount === 1 ? "" : "s"}.
              </div>

              <div className="table-responsive" style={{ maxHeight: "360px" }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-3">
                          {loading ? "Loading..." : "No supplier data."}
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((s, idx) => (
                        <tr key={`${s.supplierId}_${idx}`}>
                          <td>{s.supplierName}</td>

                          <td className="text-end">
                            {formatQtyCombined(s.totalQty.primaryQty, s.totalQty.baseQty)}
                          </td>

                          <td className="text-end">
                            {formatMoney(s.totalCostValue)}
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

      </div>

      <ToastContainer position="top-right" autoClose={2500} />
    </div>
  );
};

export default PurchaseDashboard;
