// // src/pages/reports/StockDashboard.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { ToastContainer, toast } from "react-toastify";

// import { getStockSnapshot } from "../../lib/api/ledger.api";

// import "react-toastify/dist/ReactToastify.css";
// import "bootstrap-icons/font/bootstrap-icons.css";

// const StockDashboard = ({ setActiveView, salesRepId }) => {
//   const navigate = useNavigate();

//   // --------------------------------------------------
//   // State
//   // --------------------------------------------------
//   const [loading, setLoading] = useState(false);

//   const [summary, setSummary] = useState({
//     generatedAt: null,
//     totalReceivedQty: 0,
//     totalIssuedQty: 0,
//     netMovementQty: 0,
//     periodItemCount: 0,
//     periodBranchCount: 0,
//     onHandQty: 0,
//     onHandStockValue: 0,
//     onHandItemCount: 0,
//     onHandBranchCount: 0,
//     transactionTypeTotals: {},
//   });

//   const [itemsMovement, setItemsMovement] = useState([]);
//   const [branchesMovement, setBranchesMovement] = useState([]);
//   const [onHandRows, setOnHandRows] = useState([]);

//   const [filters, setFilters] = useState({ from: "", to: "" });
//   const [periodLabel, setPeriodLabel] = useState("");

//   // --------------------------------------------------
//   // Helpers
//   // --------------------------------------------------
//   const formatNumber = (val) =>
//     (val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

//   const formatMoney = (val) =>
//     (val || 0).toLocaleString(undefined, {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     });

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

//   /** Builds a readable period label like "Nov 1 – Present" */
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
//         const toLabel = isToday(toStr) ? "Present" : fmt(to);
//         return `${fmt(from)} – ${toLabel}`;
//       }
//       if (from) return `From ${fmt(from)}`;
//       if (to) return `Until ${fmt(to)}`;
//       return "Custom period";
//     } catch {
//       return `${fromStr || ""} – ${toStr || ""}`;
//     }
//   };

//   // --------------------------------------------------
//   // Derived insights
//   // --------------------------------------------------
//   const topMovingItems = useMemo(() => {
//     return [...itemsMovement]
//       .sort((a, b) => Math.abs(b.netQty || 0) - Math.abs(a.netQty || 0))
//       .slice(0, 5);
//   }, [itemsMovement]);

//   const negativeOnHandItems = useMemo(
//     () => onHandRows.filter((r) => (r.qtyOnHand || 0) < 0),
//     [onHandRows]
//   );

//   const zeroStockItems = useMemo(
//     () => onHandRows.filter((r) => (r.qtyOnHand || 0) === 0),
//     [onHandRows]
//   );

//   const lowStockItems = useMemo(() => {
//     return onHandRows.filter(
//       (r) =>
//         (r.qtyOnHand || 0) > 0 &&
//         r.reorderLevel !== undefined &&
//         r.qtyOnHand <= r.reorderLevel
//     );
//   }, [onHandRows]);

//   // --------------------------------------------------
//   // Load snapshot
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

//       const data = await getStockSnapshot(params);

//       const {
//         generatedAt,
//         totalReceivedQty = 0,
//         totalIssuedQty = 0,
//         netMovementQty = 0,
//         periodItemCount = 0,
//         periodBranchCount = 0,
//         onHandQty = 0,
//         onHandStockValue = 0,
//         onHandItemCount = 0,
//         onHandBranchCount = 0,
//         itemsMovement: items = [],
//         branchesMovement: branches = [],
//         onHandRows: stockRows = [],
//         transactionTypeTotals = {},
//       } = data || {};

//       setSummary({
//         generatedAt,
//         totalReceivedQty,
//         totalIssuedQty,
//         netMovementQty,
//         periodItemCount,
//         periodBranchCount,
//         onHandQty,
//         onHandStockValue,
//         onHandItemCount,
//         onHandBranchCount,
//         transactionTypeTotals,
//       });

//       setItemsMovement(Array.isArray(items) ? items : []);
//       setBranchesMovement(Array.isArray(branches) ? branches : []);
//       setOnHandRows(Array.isArray(stockRows) ? stockRows : []);
//       setPeriodLabel(buildPeriodLabel(from, to));
//     } catch (err) {
//       console.error("❌ Failed loading stock snapshot:", err);
//       toast.error(
//         err?.response?.data?.message || "Failed to load stock snapshot."
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

//   const {
//     totalReceivedQty,
//     totalIssuedQty,
//     netMovementQty,
//     periodItemCount,
//     periodBranchCount,
//     onHandQty,
//     onHandStockValue,
//     onHandItemCount,
//     onHandBranchCount,
//     transactionTypeTotals,
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
//           <h2 className="page-title">Stock Snapshot</h2>
//           <p className="page-subtitle">
//             Hybrid view of physical movements and on-hand stock across branches.
//           </p>
//           <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
//             Generated at: {formattedGeneratedAt}
//           </small>
//         </div>

//         {/* Filters */}
//         <div className="row filter-bar">
//           <div className="col-md-6 filter-group me-3">
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
//                   <i className="bi bi-arrow-repeat me-1" />
//                   Apply
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

//         {/* On-hand Snapshot */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">On-hand Snapshot</span>
//             <i className="bi bi-box-seam summary-icon" />
//           </div>

//           <div className="summary-value">
//             {formatNumber(onHandQty)}
//             <span style={{ fontSize: "0.75rem", fontWeight: 400 }}> units</span>
//           </div>

//           <div className="summary-sub">
//             Approx. value {formatMoney(onHandStockValue)} in stock.
//           </div>

//           <div className="summary-sub">
//             {formatNumber(onHandItemCount)} items ·{" "}
//             {formatNumber(onHandBranchCount)} branches
//           </div>

//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>

//         {/* Stock Alerts */}
//         <div className="summary-card orange">
//           <div className="summary-header">
//             <span className="summary-label orange">Stock Alerts</span>
//             <i className="bi bi-exclamation-triangle summary-icon" />
//           </div>

//           <div className="summary-value">
//             {lowStockItems.length + zeroStockItems.length}
//           </div>

//           <div className="summary-sub">
//             <span className="badge-pill orange me-2">
//               Low: {lowStockItems.length}
//             </span>
//             <span className="badge-pill red">
//               No Stock: {zeroStockItems.length}
//             </span>
//           </div>

//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>

//         {/* Inbound Movement */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Inbound Stock Movement</span>
//             <i className="bi bi-box-arrow-in-down summary-icon" />
//           </div>

//           <div className="summary-value">
//             {formatNumber(
//               (transactionTypeTotals["purchase"] || 0) +
//                 (transactionTypeTotals["adj-goods-receive"] || 0) +
//                 (transactionTypeTotals["sales-return"] || 0) +
//                 (transactionTypeTotals["adj-sales-return"] || 0)
//             )}
//             <span style={{ fontSize: "0.75rem", fontWeight: 400 }}> Movements</span>
//           </div>

//           <div className="summary-sub">
//             Purchases:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["purchase"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-sub">
//             Goods Receive Adjustments:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["adj-goods-receive"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-sub">
//             Sales Returns:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["sales-return"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-sub">
//             Adjusted Sales Returns:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["adj-sales-return"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>

//         {/* Outbound Movement */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Outbound Stock Movement</span>
//             <i className="bi bi-box-arrow-in-up summary-icon" />
//           </div>

//           <div className="summary-value">
//             {formatNumber(
//               (transactionTypeTotals["sale"] || 0) +
//                 (transactionTypeTotals["adj-sale"] || 0) +
//                 (transactionTypeTotals["purchase-return"] || 0) +
//                 (transactionTypeTotals["adj-goods-return"] || 0)
//             )}
//             <span style={{ fontSize: "0.75rem", fontWeight: 400 }}> Movements</span>
//           </div>

//           <div className="summary-sub">
//             Sales:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["sale"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-sub">
//             Adjusted Sales:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["adj-sale"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-sub">
//             Purchase Returns:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["purchase-return"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-sub">
//             Adjusted Goods Returns:
//             <strong className="ms-1">
//               {formatNumber(transactionTypeTotals["adj-goods-return"] || 0)}
//             </strong>
//           </div>

//           <div className="summary-period">Period: {periodLabel}</div>
//         </div>
//       </div>

//       {/* --------------------------------------------------
//         BODY SECTIONS
//       -------------------------------------------------- */}
//       <div className="d-flex gap-2">

//         {/* ------------------ Branch Movement ------------------ */}
//         <div className="flex-fill">
//           <div className="table-container">
//             <div className="table-block">

//               <div className="d-flex justify-content-between mb-2">
//                 <div>
//                   <div className="section-title">Branch Movement Overview</div>
//                   <div className="section-subtitle">
//                     Total inflow / outflow per branch.
//                   </div>
//                 </div>
//               </div>

//               <div className="table-responsive" style={{ maxHeight: 360 }}>
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Branch</th>
//                       <th className="text-end">Qty In</th>
//                       <th className="text-end">Qty Out</th>
//                       <th className="text-end">Net Qty</th>
//                       <th className="text-end">Entries</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {branchesMovement.length === 0 ? (
//                       <tr>
//                         <td colSpan={5} className="text-center text-muted py-3">
//                           No branch movement recorded for this period.
//                         </td>
//                       </tr>
//                     ) : (
//                       branchesMovement.map((b, idx) => (
//                         <tr key={idx}>
//                           <td>{b.branchName}</td>
//                           <td className="text-end">{formatNumber(b.qtyIn)}</td>
//                           <td className="text-end">{formatNumber(b.qtyOut)}</td>
//                           <td className="text-end">{formatNumber(b.netQty)}</td>
//                           <td className="text-end">{formatNumber(b.docCount)}</td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>

//             </div>
//           </div>

//           {/* ------------------ Low Stock Items ------------------ */}
//           <div className="table-container mt-2">
//             <div className="table-block">

//               <div className="d-flex justify-content-between mb-2">
//                 <div>
//                   <div className="section-title">Low Stock Items</div>
//                   <div className="section-subtitle">
//                     Items where qty on hand is at or below reorder level.
//                   </div>
//                 </div>

//                 <div className="d-flex align-items-center">
//                   <span className="badge-pill red me-2">
//                     {lowStockItems.length} items
//                   </span>
//                 </div>
//               </div>

//               <div className="table-responsive" style={{ maxHeight: 360 }}>
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Item</th>
//                       <th>Branch</th>
//                       <th className="text-end">Qty</th>
//                       <th className="text-end">Reorder Level</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {lowStockItems.length === 0 ? (
//                       <tr>
//                         <td colSpan={4} className="text-center text-muted py-3">
//                           No low-stock items.
//                         </td>
//                       </tr>
//                     ) : (
//                       lowStockItems.map((r, i) => (
//                         <tr key={i}>
//                           <td>
//                             <div className="fw-bold">{r.itemName}</div>
//                             <div className="text-muted small">{r.itemCode}</div>
//                           </td>
//                           <td>{r.branchName}</td>
//                           <td className="text-end">{formatNumber(r.qtyOnHand)}</td>
//                           <td className="text-end">{formatNumber(r.reorderLevel)}</td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>

//             </div>
//           </div>
//         </div>

//         {/* ------------------ Movement By Item ------------------ */}
//         <div className="flex-fill">
//           <div className="table-container">
//             <div className="table-block">

//               <div className="d-flex justify-content-between mb-2">
//                 <div>
//                   <div className="section-title">Movement by Item</div>
//                   <div className="section-subtitle">
//                     Net in / out by item within the selected period.
//                   </div>
//                 </div>

//                 <button
//                   className="btn btn-sm btn-light"
//                   style={{ borderRadius: 6 }}
//                   onClick={() => setActiveView("pivot")}
//                   title="Open full report"
//                 >
//                   <i className="bi bi-box-arrow-up-right"></i>
//                 </button>
//               </div>

//               <div className="table-responsive" style={{ maxHeight: 360 }}>
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Item</th>
//                       <th>Branch</th>
//                       <th className="text-end">Qty In</th>
//                       <th className="text-end">Qty Out</th>
//                       <th className="text-end">Net Qty</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {itemsMovement.length === 0 ? (
//                       <tr>
//                         <td colSpan={5} className="text-center text-muted py-3">
//                           No movement data for this period.
//                         </td>
//                       </tr>
//                     ) : (
//                       itemsMovement.map((row, idx) => (
//                         <tr key={idx}>
//                           <td>
//                             <div className="fw-bold">{row.itemName}</div>
//                             <div className="text-muted small">{row.itemCode}</div>
//                           </td>
//                           <td>{row.branchName}</td>
//                           <td className="text-end">{formatNumber(row.qtyIn)}</td>
//                           <td className="text-end">{formatNumber(row.qtyOut)}</td>
//                           <td className="text-end">{formatNumber(row.netQty)}</td>
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

// export default StockDashboard;







// src/pages/reports/StockDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";

import { getStockSnapshot } from "../../lib/api/ledger.api";
import { getItems } from "../../lib/api/inventory.api"; // 🔹 NEW

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const StockDashboard = ({ setActiveView, salesRepId }) => {
  const navigate = useNavigate();

  // --------------------------------------------------
  // State
  // --------------------------------------------------
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState({
    generatedAt: null,
    totalReceivedQty: { baseQty: 0, primaryQty: 0 },
    totalIssuedQty: { baseQty: 0, primaryQty: 0 },
    netMovementQty: { baseQty: 0, primaryQty: 0 },
    periodItemCount: 0,
    periodBranchCount: 0,
    onHandQty: { baseQty: 0, primaryQty: 0 },
    onHandStockValue: 0,
    onHandItemCount: 0,
    onHandBranchCount: 0,
    transactionTypeTotals: {},
  });

  const [itemsMovement, setItemsMovement] = useState([]);
  const [branchesMovement, setBranchesMovement] = useState([]);
  const [onHandRows, setOnHandRows] = useState([]);

  // 🔹 UOM map: { [itemId]: { primaryUom, baseUom } }
  const [itemUomMap, setItemUomMap] = useState({});

  const [filters, setFilters] = useState({ from: "", to: "" });
  const [periodLabel, setPeriodLabel] = useState("");

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const formatNumber = (val) =>
    (val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const formatMoney = (val) =>
    (val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // "10 PACK + 5 PIECE" / "6 PACK" / "0"
  const formatQtyCombined = (
    primaryQty = 0,
    baseQty = 0,
    primaryLabel = "primary",
    baseLabel = "base"
  ) => {
    const p = primaryQty || 0;
    const b = baseQty || 0;
    const parts = [];
    if (p) parts.push(`${formatNumber(p)} ${primaryLabel}`);
    if (b) parts.push(`${formatNumber(b)} ${baseLabel}`);
    if (!parts.length) return "0";
    return parts.join(" + ");
  };

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

  /** Builds a readable period label like "Nov 1 – Present" */
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
        const toLabel = isToday(toStr) ? "Present" : fmt(to);
        return `${fmt(from)} – ${toLabel}`;
      }
      if (from) return `From ${fmt(from)}`;
      if (to) return `Until ${fmt(to)}`;
      return "Custom period";
    } catch {
      return `${fromStr || ""} – ${toStr || ""}`;
    }
  };

  // Helper to get base-equivalent qty from onHandRows row (for alerts)
  const getBaseEqQty = (row) => {
    const factor = row?.factorToBase || 1;
    const base = row?.qtyOnHand?.baseQty || 0;
    const primary = row?.qtyOnHand?.primaryQty || 0;
    return base + primary * factor;
  };

  // --------------------------------------------------
  // Derived insights
  // --------------------------------------------------
  const topMovingItems = useMemo(() => {
    return [...itemsMovement]
      .sort((a, b) => {
        const aNet = Math.abs(a?.netQty?.baseQty || 0);
        const bNet = Math.abs(b?.netQty?.baseQty || 0);
        return bNet - aNet;
      })
      .slice(0, 5);
  }, [itemsMovement]);

  const negativeOnHandItems = useMemo(
    () => onHandRows.filter((r) => getBaseEqQty(r) < 0),
    [onHandRows]
  );

  const zeroStockItems = useMemo(
    () => onHandRows.filter((r) => getBaseEqQty(r) === 0),
    [onHandRows]
  );

  const lowStockItems = useMemo(() => {
    return onHandRows.filter((r) => {
      const qtyBaseEq = getBaseEqQty(r);
      return (
        qtyBaseEq > 0 &&
        r.reorderLevel !== undefined &&
        qtyBaseEq <= (r.reorderLevel || 0)
      );
    });
  }, [onHandRows]);

  // --------------------------------------------------
  // Load snapshot
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
        getStockSnapshot(params),
        getItems({}), // you can filter here if needed
      ]);

      const {
        generatedAt,
        totalReceivedQty = { baseQty: 0, primaryQty: 0 },
        totalIssuedQty = { baseQty: 0, primaryQty: 0 },
        netMovementQty = { baseQty: 0, primaryQty: 0 },
        periodItemCount = 0,
        periodBranchCount = 0,
        onHandQty = { baseQty: 0, primaryQty: 0 },
        onHandStockValue = 0,
        onHandItemCount = 0,
        onHandBranchCount = 0,
        itemsMovement: items = [],
        branchesMovement: branches = [],
        // Optional: if backend returns onHandRows from getCurrentStock
        onHandRows: stockRows = [],
        transactionTypeTotals = {},
      } = data || {};

      setSummary({
        generatedAt,
        totalReceivedQty,
        totalIssuedQty,
        netMovementQty,
        periodItemCount,
        periodBranchCount,
        onHandQty,
        onHandStockValue,
        onHandItemCount,
        onHandBranchCount,
        transactionTypeTotals,
      });

      setItemsMovement(Array.isArray(items) ? items : []);
      setBranchesMovement(Array.isArray(branches) ? branches : []);
      setOnHandRows(Array.isArray(stockRows) ? stockRows : []);
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
      console.error("❌ Failed loading stock snapshot:", err);
      toast.error(
        err?.response?.data?.message || "Failed to load stock snapshot."
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

  const {
    totalReceivedQty,
    totalIssuedQty,
    netMovementQty,
    periodItemCount,
    periodBranchCount,
    onHandQty,
    onHandStockValue,
    onHandItemCount,
    onHandBranchCount,
    transactionTypeTotals,
  } = summary;

  // Precompute inbound/outbound totals from transactionTypeTotals (base qty)
  const t = transactionTypeTotals || {};

  const inboundBaseTotal =
    (t["purchase"]?.baseQty || 0) +
    (t["adj-goods-receive"]?.baseQty || 0) +
    (t["sales-return"]?.baseQty || 0) +
    (t["adj-sales-return"]?.baseQty || 0);

  const outboundBaseTotal =
    (t["sale"]?.baseQty || 0) +
    (t["adj-sale"]?.baseQty || 0) +
    (t["purchase-return"]?.baseQty || 0) +
    (t["adj-goods-return"]?.baseQty || 0);

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
          <h2 className="page-title">Stock Snapshot</h2>
          <p className="page-subtitle">
            Hybrid view of physical movements and on-hand stock across branches.
          </p>
          <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
            Generated at: {formattedGeneratedAt}
          </small>
        </div>

        {/* Filters */}
        <div className="row filter-bar">
          <div className="col-md-6 filter-group me-3">
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
                  <i className="bi bi-arrow-repeat me-1" />
                  Apply
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
        {/* On-hand Snapshot */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">On-hand Snapshot</span>
            <i className="bi bi-box-seam summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(onHandQty.primaryQty)}
            <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>
              {" "}
              Primary Units
            </span>
          </div>

          <div className="summary-sub">
            {formatNumber(onHandQty.baseQty)} Base Units
          </div>

          <div className="summary-sub">
            Approx. value {formatMoney(onHandStockValue)} in stock.
          </div>

          <div className="summary-sub">
            {formatNumber(onHandItemCount)} items ·{" "}
            {formatNumber(onHandBranchCount)} branches
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Stock Alerts */}
        <div className="summary-card orange">
          <div className="summary-header">
            <span className="summary-label orange">Stock Alerts</span>
            <i className="bi bi-exclamation-triangle summary-icon" />
          </div>

          <div className="summary-value">
            {lowStockItems.length + zeroStockItems.length}
          </div>

          <div className="summary-sub">
            <span className="badge-pill orange me-2">
              Low: {lowStockItems.length}
            </span>
            <span className="badge-pill red">
              No Stock: {zeroStockItems.length}
            </span>
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Inbound Movement */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Inbound Stock Movement</span>
            <i className="bi bi-box-arrow-in-down summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(inboundBaseTotal)}
            <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>
              {" "}
              Movements (base)
            </span>
          </div>

          <div className="summary-sub">
            Purchases:
            <strong className="ms-1">
              {formatQtyCombined(
                t["purchase"]?.primaryQty,
                t["purchase"]?.baseQty
              )}
            </strong>
          </div>

          <div className="summary-sub">
            Goods Receive Adjustments:
            <strong className="ms-1">
              {formatQtyCombined(
                t["adj-goods-receive"]?.primaryQty,
                t["adj-goods-receive"]?.baseQty
              )}
            </strong>
          </div>

          <div className="summary-sub">
            Sales Returns:
            <strong className="ms-1">
              {formatQtyCombined(
                t["sales-return"]?.primaryQty,
                t["sales-return"]?.baseQty
              )}
            </strong>
          </div>

          <div className="summary-sub">
            Adjusted Sales Returns:
            <strong className="ms-1">
              {formatQtyCombined(
                t["adj-sales-return"]?.primaryQty,
                t["adj-sales-return"]?.baseQty
              )}
            </strong>
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Outbound Movement */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Outbound Stock Movement</span>
            <i className="bi bi-box-arrow-in-up summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(outboundBaseTotal)}
            <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>
              {" "}
              Movements (base)
            </span>
          </div>

          <div className="summary-sub">
            Sales:
            <strong className="ms-1">
              {formatQtyCombined(t["sale"]?.primaryQty, t["sale"]?.baseQty)}
            </strong>
          </div>

          <div className="summary-sub">
            Adjusted Sales:
            <strong className="ms-1">
              {formatQtyCombined(
                t["adj-sale"]?.primaryQty,
                t["adj-sale"]?.baseQty
              )}
            </strong>
          </div>

          <div className="summary-sub">
            Purchase Returns:
            <strong className="ms-1">
              {formatQtyCombined(
                t["purchase-return"]?.primaryQty,
                t["purchase-return"]?.baseQty
              )}
            </strong>
          </div>

          <div className="summary-sub">
            Adjusted Goods Returns:
            <strong className="ms-1">
              {formatQtyCombined(
                t["adj-goods-return"]?.primaryQty,
                t["adj-goods-return"]?.baseQty
              )}
            </strong>
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>
      </div>

      {/* --------------------------------------------------
        BODY SECTIONS
      -------------------------------------------------- */}
      <div className="d-flex gap-2">
        {/* ------------------ Branch Movement ------------------ */}
        <div className="flex-fill">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between mb-2">
                <div>
                  <div className="section-title">Branch Movement Overview</div>
                  <div className="section-subtitle">
                    Purchases / Sales / Returns per branch.
                  </div>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: 360 }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th className="text-end">Purchases</th>
                      <th className="text-end">Sales</th>
                      <th className="text-end">Returns</th>
                      <th className="text-end">Net Qty</th>
                    </tr>
                  </thead>

                  <tbody>
                    {branchesMovement.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3">
                          No branch movement recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      branchesMovement.map((b, idx) => {
                        const p = b?.purchases || {};
                        const s = b?.sales || {};
                        const r = b?.returns || {};
                        const n = b?.netQty || {};

                        // Branch is multi-item; keep generic labels
                        return (
                          <tr key={idx}>
                            <td>{b.branchName}</td>
                            <td className="text-end">
                              {formatQtyCombined(p.primaryQty, p.baseQty)}
                            </td>
                            <td className="text-end">
                              {formatQtyCombined(s.primaryQty, s.baseQty)}
                            </td>
                            <td className="text-end">
                              {formatQtyCombined(r.primaryQty, r.baseQty)}
                            </td>
                            <td className="text-end">
                              {formatQtyCombined(n.primaryQty, n.baseQty)}
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

          {/* ------------------ Low Stock Items ------------------ */}
          <div className="table-container mt-2">
            <div className="table-block">
              <div className="d-flex justify-content-between mb-2">
                <div>
                  <div className="section-title">Low Stock Items</div>
                  <div className="section-subtitle">
                    Items where qty on hand is at or below reorder level.
                  </div>
                </div>

                <div className="d-flex align-items-center">
                  <span className="badge-pill red me-2">
                    {lowStockItems.length} items
                  </span>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: 360 }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Branch</th>
                      <th className="text-end">Qty (Base Eq)</th>
                      <th className="text-end">Reorder Level</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lowStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          No low-stock items.
                        </td>
                      </tr>
                    ) : (
                      lowStockItems.map((r, i) => {
                        const qtyBaseEq = getBaseEqQty(r);
                        return (
                          <tr key={i}>
                            <td>
                              <div className="fw-bold">{r.itemName}</div>
                              <div className="text-muted small">
                                {r.itemCode}
                              </div>
                            </td>
                            <td>{r.branchName}</td>
                            <td className="text-end">
                              {formatNumber(qtyBaseEq)}
                            </td>
                            <td className="text-end">
                              {formatNumber(r.reorderLevel)}
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

        {/* ------------------ Movement By Item ------------------ */}
        <div className="flex-fill">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between mb-2">
                <div>
                  <div className="section-title">Movement by Item</div>
                  <div className="section-subtitle">
                    Purchases / Sales / Returns per item in the period.
                  </div>
                </div>

                <button
                  className="btn btn-sm btn-light"
                  style={{ borderRadius: 6 }}
                  onClick={() => setActiveView("pivot")}
                  title="Open full report"
                >
                  <i className="bi bi-box-arrow-up-right"></i>
                </button>
              </div>

              <div className="table-responsive" style={{ maxHeight: 360 }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Branch</th>
                      <th className="text-end">Purchases</th>
                      <th className="text-end">Sales</th>
                      <th className="text-end">Returns</th>
                      <th className="text-end">Net Qty</th>
                    </tr>
                  </thead>

                  <tbody>
                    {itemsMovement.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-3">
                          No movement data for this period.
                        </td>
                      </tr>
                    ) : (
                      itemsMovement.map((row, idx) => {
                        const p = row?.purchases || {};
                        const s = row?.sales || {};
                        const r = row?.returns || {};
                        const n = row?.netQty || {};

                        const uom = itemUomMap[row.itemId] || {};
                        const primaryLabel = uom.primaryUom || "primary";
                        const hasBaseUom = !!uom.baseUom;
                        const baseLabel = uom.baseUom || "base";

                        const pBaseQty = hasBaseUom ? p.baseQty : 0;
                        const sBaseQty = hasBaseUom ? s.baseQty : 0;
                        const rBaseQty = hasBaseUom ? r.baseQty : 0;
                        const nBaseQty = hasBaseUom ? n.baseQty : 0;

                        return (
                          <tr key={idx}>
                            <td>
                              <div className="fw-bold">{row.itemName}</div>
                              <div className="text-muted small">
                                {row.itemCode}
                              </div>
                            </td>
                            <td>{row.branchName}</td>
                            <td className="text-end">
                              {formatQtyCombined(
                                p.primaryQty,
                                pBaseQty,
                                primaryLabel,
                                baseLabel
                              )}
                            </td>
                            <td className="text-end">
                              {formatQtyCombined(
                                s.primaryQty,
                                sBaseQty,
                                primaryLabel,
                                baseLabel
                              )}
                            </td>
                            <td className="text-end">
                              {formatQtyCombined(
                                r.primaryQty,
                                rBaseQty,
                                primaryLabel,
                                baseLabel
                              )}
                            </td>
                            <td className="text-end">
                              {formatQtyCombined(
                                n.primaryQty,
                                nBaseQty,
                                primaryLabel,
                                baseLabel
                              )}
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

export default StockDashboard;
