// // src/pages/reports/BusinessDashboard.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { ToastContainer, toast } from "react-toastify";
// import { getBusinessSnapshot } from "../../lib/api/ledger.api";

// import "bootstrap-icons/font/bootstrap-icons.css";
// import "react-toastify/dist/ReactToastify.css";

// const BusinessDashboard = ({ salesRepId }) => {
//   const [loading, setLoading] = useState(false);

//   const [summary, setSummary] = useState({
//     totalRevenue: 0,
//     totalCost: 0,
//     profit: 0,
//     margin: 0,
//     generatedAt: null,
//     branchCount: 0,
//     itemCount: 0,
//   });

//   const [branches, setBranches] = useState([]);
//   const [items, setItems] = useState([]);
//   const [periodLabel, setPeriodLabel] = useState("");

//   const navigate = useNavigate();

//   // ---------- helpers ----------
//   const formatMoney = (Val) =>
//     Val == null
//       ? "—"
//       : "LKR " +
//         Number(Val).toLocaleString("en-LK", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         });

//   const formatPercent = (val) =>
//     `${(val || 0).toLocaleString(undefined, {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
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

//   const branchTotals = useMemo(() => {
//     return branches.reduce(
//       (acc, b) => {
//         acc.totalRevenue += b.totalRevenue || 0;
//         acc.totalCost += b.totalCost || 0;
//         acc.totalProfit += b.profit || 0;
//         acc.totalQty += b.totalQty || 0;
//         return acc;
//       },
//       { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalQty: 0 }
//     );
//   }, [branches]);

//   // ---------- load snapshot ----------
//   const loadSnapshot = async () => {
//     try {
//       setLoading(true);

//       const today = new Date();
//       const year = today.getFullYear();
//       const monthIndex = today.getMonth();
//       const firstOfMonth = new Date(year, monthIndex, 1);

//       const fromStr = firstOfMonth.toISOString().slice(0, 10);
//       const toStr = today.toISOString().slice(0, 10);

//       const monthName = firstOfMonth.toLocaleString(undefined, {
//         month: "short",
//       });
//       setPeriodLabel(`${monthName} ${firstOfMonth.getDate()} – Present`);

//       const params = {
//         from: fromStr,
//         to: toStr,
//       };

//       // 🔹 Inject Sales Rep filter (same pattern as PurchaseDashboard)
//       if (salesRepId && salesRepId !== "All") {
//         params.salesRep = salesRepId;
//       }

//       const data = await getBusinessSnapshot(params);

//       const {
//         generatedAt,
//         totalRevenue,
//         totalCost,
//         profit,
//         margin,
//         branchCount,
//         itemCount,
//         branches: branchArr = [],
//         items: itemArr = [],
//       } = data;

//       setSummary({
//         generatedAt,
//         totalRevenue,
//         totalCost,
//         profit,
//         margin,
//         branchCount,
//         itemCount,
//       });

//       setBranches(Array.isArray(branchArr) ? branchArr : []);
//       setItems(Array.isArray(itemArr) ? itemArr : []);
//     } catch (err) {
//       console.error("❌ Error loading business snapshot:", err);
//       toast.error(
//         err?.response?.data?.message || "Failed to load business snapshot."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ---------- initial load + reload on Sales Rep change ----------
//   useEffect(() => {
//     loadSnapshot();
//   }, [salesRepId]); // 🔁 reload when rep changes

  
//   return (
//     <div className="container-fluid py-4 px-5">
//       {/* Header */}
//       <div className="pb-3">
//         <h2 className="page-title">Business Overview</h2>
//         <p className="page-subtitle">
//           Profitability snapshot across all branches and items for the current month.
//         </p>
//         <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
//           Generated at: {formattedGeneratedAt}
//         </small>
//       </div>

//       {/* Summary cards */}
//       <div className="summary-grid">
//         {/* Revenue */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Revenue</span>
//             <i className="bi bi-graph-up-arrow summary-icon" />
//           </div>
//           <div className="summary-value">
//             {formatMoney(summary.totalRevenue)}
//           </div>
//           <div className="summary-sub">
//             Total selling value from all branches.
//           </div>
//           <div className="summary-period">
//             Period: {periodLabel}
//           </div>
//         </div>

//         {/* Cost */}
//         <div className="summary-card">
//           <div className="summary-header">
//             <span className="summary-label">Cost</span>
//             <i className="bi bi-cash-coin summary-icon" />
//           </div>
//           <div className="summary-value">
//             {formatMoney(summary.totalCost)}
//           </div>
//           <div className="summary-sub">
//             Stock cost consumed by all recorded sales.
//           </div>
//           <div className="summary-period">
//             Period: {periodLabel}
//           </div>
//         </div>

//         {/* Profit */}
//         <div className="summary-card orange">
//           <div className="summary-header">
//             <span className="summary-label">Profit</span>
//             <i className="bi bi-coin summary-icon" />
//           </div>

//           <div className="summary-value">{formatMoney(summary.profit)}</div>
//           <div className="summary-sub">Revenue minus cost for the period.</div>

//           <div className="summary-footer">
//             <span className="summary-period">Period: {periodLabel}</span>

//             <i
//               className="bi bi-arrow-right-circle summary-footer-icon"
//               onClick={() => navigate("/reports/profit")}
//               title="View Profit Dashboard"
//             />
//           </div>
//         </div>


//         {/* Margin */}
//         <div className="summary-card orange">
//           <div className="summary-header">
//             <span className="summary-label">Margin</span>
//             <i className="bi bi-percent summary-icon" />
//           </div>
//           <div className="summary-value">
//             {formatPercent(summary.margin)}
//           </div>
//           <div className="summary-sub">
//             Profit as a percentage of revenue.
//           </div>
//           <div className="summary-period">
//             Period: {periodLabel}
//           </div>
//         </div>
//       </div>

//       {/* Main two-column layout */}
//       <div className="row g-2">
//         {/* Branch table */}
//         <div className="col-lg-5">
//           <div className="table-container">
//             <div className="table-block">
//               <div className="d-flex justify-content-between align-items-center mb-2">
//                 <div>
//                   <div className="section-title">Branch Profitability</div>
//                   <div className="section-subtitle">
//                     {summary.branchCount} branch
//                     {summary.branchCount === 1 ? "" : "es"} in result.
//                   </div>
//                 </div>
//               </div>
//               <div
//                 className="table-responsive"
//                 style={{ maxHeight: "380px", overflowY: "auto" }}
//               >
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Branch</th>
//                       <th className="text-end">Qty</th>
//                       <th className="text-end">Revenue</th>
//                       <th className="text-end">Cost</th>
//                       <th className="text-end">Profit</th>
//                       <th className="text-end">Margin</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {branches.length === 0 ? (
//                       <tr>
//                         <td colSpan={6} className="text-center text-muted py-3">
//                           {loading
//                             ? "Loading branch profitability..."
//                             : "No branch data for this period."}
//                         </td>
//                       </tr>
//                     ) : (
//                       branches.map((b) => (
//                         <tr key={b.branchId}>
//                           <td>
//                             <div style={{ fontWeight: 600 }}>
//                               {b.branchName || "Unknown"}
//                             </div>
//                             <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
//                               {b.branchCode || ""}
//                             </div>
//                           </td>
//                           <td className="text-end">
//                             {b.totalQty?.toLocaleString() ?? 0}
//                           </td>
//                           <td className="text-end">
//                             {formatMoney(b.totalRevenue)}
//                           </td>
//                           <td className="text-end">
//                             {formatMoney(b.totalCost)}
//                           </td>
//                           <td className="text-end">
//                             {formatMoney(b.profit)}
//                           </td>
//                           <td className="text-end">
//                             {formatPercent(b.margin)}
//                           </td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                   {branches.length > 0 && (
//                     <tfoot>
//                       <tr>
//                         <th>Total</th>
//                         <th className="text-end">
//                           {branchTotals.totalQty.toLocaleString()}
//                         </th>
//                         <th className="text-end">
//                           {formatMoney(branchTotals.totalRevenue)}
//                         </th>
//                         <th className="text-end">
//                           {formatMoney(branchTotals.totalCost)}
//                         </th>
//                         <th className="text-end">
//                           {formatMoney(branchTotals.totalProfit)}
//                         </th>
//                         <th className="text-end"></th>
//                       </tr>
//                     </tfoot>
//                   )}
//                 </table>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Item table */}
//         <div className="col-lg-7">
//           <div className="table-container">
//             <div className="table-block">
//               <div className="d-flex justify-content-between align-items-center mb-2">
//                 <div>
//                   <div className="section-title">Item Profitability</div>
//                   <div className="section-subtitle">
//                     {summary.itemCount} item
//                     {summary.itemCount === 1 ? "" : "s"} in result.
//                   </div>
//                 </div>
//               </div>

//               <div
//                 className="table-responsive"
//                 style={{ maxHeight: "380px", overflowY: "auto" }}
//               >
//                 <table className="modern-table">
//                   <thead>
//                     <tr>
//                       <th>Item</th>
//                       <th>Branch</th>
//                       <th className="text-end">Qty Sold</th>
//                       <th className="text-end">Revenue</th>
//                       <th className="text-end">Cost</th>
//                       <th className="text-end">Profit</th>
//                       <th className="text-end">Margin</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {items.length === 0 ? (
//                       <tr>
//                         <td colSpan={7} className="text-center text-muted py-3">
//                           {loading
//                             ? "Loading item profitability..."
//                             : "No item data for this period."}
//                         </td>
//                       </tr>
//                     ) : (
//                       items.map((it) => (
//                         <tr key={`${it.itemId}_${it.branchId}`}>
//                           <td>
//                             <div style={{ fontWeight: 600 }}>
//                               {it.itemName || "Unknown"}
//                             </div>
//                             <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
//                               {it.itemCode || ""}
//                             </div>
//                           </td>
//                           <td>
//                             <div style={{ fontWeight: 500 }}>
//                               {it.branchName || "Unknown"}
//                             </div>
//                           </td>
//                           <td className="text-end">
//                             {it.qtySold?.toLocaleString() ?? 0}
//                           </td>
//                           <td className="text-end">
//                             {formatMoney(it.totalRevenue)}
//                           </td>
//                           <td className="text-end">
//                             {formatMoney(it.totalCost)}
//                           </td>
//                           <td className="text-end">
//                             {formatMoney(it.profit)}
//                           </td>
//                           <td className="text-end">
//                             {formatPercent(it.margin)}
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

// export default BusinessDashboard;

// src/pages/reports/BusinessDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import { getBusinessSnapshot } from "../../lib/api/ledger.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

const BusinessDashboard = ({ salesRepId }) => {
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalCost: 0,
    profit: 0,
    margin: 0,
    generatedAt: null,
    branchCount: 0,
    itemCount: 0,
  });

  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [periodLabel, setPeriodLabel] = useState("");

  const navigate = useNavigate();

  // ---------- helpers ----------
  const formatMoney = (Val) =>
    Val == null
      ? "—"
      : "LKR " +
        Number(Val).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const formatPercent = (val) =>
    `${(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  // 🔁 Aggregate branch totals with split qty
  const branchTotals = useMemo(() => {
    return branches.reduce(
      (acc, b) => {
        acc.totalRevenue += b.totalRevenue || 0;
        acc.totalCost += b.totalCost || 0;
        acc.totalProfit += b.profit || 0;
        acc.totalQtyBaseEq += b.totalQtyBaseEq || 0;

        const primary = b.totalQty?.primaryQty || 0;
        const base = b.totalQty?.baseQty || 0;
        acc.totalPrimaryQty += primary;
        acc.totalBaseQty += base;

        return acc;
      },
      {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalQtyBaseEq: 0,
        totalPrimaryQty: 0,
        totalBaseQty: 0,
      }
    );
  }, [branches]);

  // ---------- load snapshot ----------
  const loadSnapshot = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const year = today.getFullYear();
      const monthIndex = today.getMonth();
      const firstOfMonth = new Date(year, monthIndex, 1);

      const fromStr = firstOfMonth.toISOString().slice(0, 10);
      const toStr = today.toISOString().slice(0, 10);

      const monthName = firstOfMonth.toLocaleString(undefined, {
        month: "short",
      });
      setPeriodLabel(`${monthName} ${firstOfMonth.getDate()} – Present`);

      const params = {
        from: fromStr,
        to: toStr,
      };

      // 🔹 Sales Rep filter
      if (salesRepId && salesRepId !== "All") {
        params.salesRep = salesRepId;
      }

      const data = await getBusinessSnapshot(params);

      const {
        generatedAt,
        totalRevenue,
        totalCost,
        profit,
        margin,
        branchCount,
        itemCount,
        branches: branchArr = [],
        items: itemArr = [],
      } = data || {};

      setSummary({
        generatedAt,
        totalRevenue: totalRevenue || 0,
        totalCost: totalCost || 0,
        profit: profit || 0,
        margin: margin || 0,
        branchCount: branchCount || 0,
        itemCount: itemCount || 0,
      });

      setBranches(Array.isArray(branchArr) ? branchArr : []);
      setItems(Array.isArray(itemArr) ? itemArr : []);
    } catch (err) {
      console.error("❌ Error loading business snapshot:", err);
      toast.error(
        err?.response?.data?.message || "Failed to load business snapshot."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------- initial load + reload on Sales Rep change ----------
  useEffect(() => {
    loadSnapshot();
  }, [salesRepId]);

  return (
    <div className="container-fluid py-4 px-5">
      {/* Header */}
      <div className="pb-3">
        <h2 className="page-title">Business Overview</h2>
        <p className="page-subtitle">
          Profitability snapshot across all branches and items for the current
          month.
        </p>
        <small style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
          Generated at: {formattedGeneratedAt}
        </small>
      </div>

      {/* Summary cards */}
      <div className="summary-grid">
        {/* Revenue */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Revenue</span>
            <i className="bi bi-graph-up-arrow summary-icon" />
          </div>
          <div className="summary-value">
            {formatMoney(summary.totalRevenue)}
          </div>
          <div className="summary-sub">
            Total selling value from all branches.
          </div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Cost */}
        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Cost</span>
            <i className="bi bi-cash-coin summary-icon" />
          </div>
          <div className="summary-value">
            {formatMoney(summary.totalCost)}
          </div>
          <div className="summary-sub">
            Stock cost consumed by all recorded sales.
          </div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        {/* Profit */}
        <div className="summary-card orange">
          <div className="summary-header">
            <span className="summary-label">Profit</span>
            <i className="bi bi-coin summary-icon" />
          </div>

          <div className="summary-value">{formatMoney(summary.profit)}</div>
          <div className="summary-sub">Revenue minus cost for the period.</div>

          <div className="summary-footer">
            <span className="summary-period">Period: {periodLabel}</span>

            <i
              className="bi bi-arrow-right-circle summary-footer-icon"
              onClick={() => navigate("/reports/profit")}
              title="View Profit Dashboard"
            />
          </div>
        </div>

        {/* Margin */}
        <div className="summary-card orange">
          <div className="summary-header">
            <span className="summary-label">Margin</span>
            <i className="bi bi-percent summary-icon" />
          </div>
          <div className="summary-value">
            {formatPercent(summary.margin)}
          </div>
          <div className="summary-sub">
            Profit as a percentage of revenue.
          </div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="row g-2">
        {/* Branch table */}
        <div className="col-lg-5">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Branch Profitability</div>
                  <div className="section-subtitle">
                    {summary.branchCount} branch
                    {summary.branchCount === 1 ? "" : "es"} in result.
                  </div>
                </div>
              </div>
              <div
                className="table-responsive"
                style={{ maxHeight: "380px", overflowY: "auto" }}
              >
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Revenue</th>
                      <th className="text-end">Cost</th>
                      <th className="text-end">Profit</th>
                      <th className="text-end">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-3">
                          {loading
                            ? "Loading branch profitability..."
                            : "No branch data for this period."}
                        </td>
                      </tr>
                    ) : (
                      branches.map((b) => {
                        const primary =
                          b.totalQty?.primaryQty != null
                            ? b.totalQty.primaryQty
                            : 0;
                        const base =
                          b.totalQty?.baseQty != null ? b.totalQty.baseQty : 0;

                        return (
                          <tr key={b.branchId}>
                            <td>
                              <div style={{ fontWeight: 600 }}>
                                {b.branchName || "Unknown"}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#9ca3af",
                                }}
                              >
                                {b.branchCode || ""}
                              </div>
                            </td>
                            <td className="text-end">
                              <div>
                                {primary.toLocaleString()}{" "}
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    color: "#9ca3af",
                                  }}
                                >
                                  primary
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#9ca3af",
                                }}
                              >
                                {base.toLocaleString()}{" "}
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    color: "#9ca3af",
                                  }}
                                >
                                  base
                                </span>
                              </div>
                            </td>
                            <td className="text-end">
                              {formatMoney(b.totalRevenue)}
                            </td>
                            <td className="text-end">
                              {formatMoney(b.totalCost)}
                            </td>
                            <td className="text-end">
                              {formatMoney(b.profit)}
                            </td>
                            <td className="text-end">
                              {formatPercent(b.margin)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {branches.length > 0 && (
                    <tfoot>
                      <tr>
                        <th>Total</th>
                        <th className="text-end">
                          <div>
                            {branchTotals.totalPrimaryQty.toLocaleString()}{" "}
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "#9ca3af",
                              }}
                            >
                              primary
                            </span>
                          </div>
                          <div
                            style={{ fontSize: "0.75rem", color: "#9ca3af" }}
                          >
                            {branchTotals.totalBaseQty.toLocaleString()}{" "}
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "#9ca3af",
                              }}
                            >
                              base
                            </span>
                          </div>
                        </th>
                        <th className="text-end">
                          {formatMoney(branchTotals.totalRevenue)}
                        </th>
                        <th className="text-end">
                          {formatMoney(branchTotals.totalCost)}
                        </th>
                        <th className="text-end">
                          {formatMoney(branchTotals.totalProfit)}
                        </th>
                        <th className="text-end"></th>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Item table */}
        <div className="col-lg-7">
          <div className="table-container">
            <div className="table-block">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="section-title">Item Profitability</div>
                  <div className="section-subtitle">
                    {summary.itemCount} item
                    {summary.itemCount === 1 ? "" : "s"} in result.
                  </div>
                </div>
              </div>

              <div
                className="table-responsive"
                style={{ maxHeight: "380px", overflowY: "auto" }}
              >
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Branch</th>
                      <th className="text-end">Qty Sold</th>
                      <th className="text-end">Revenue</th>
                      <th className="text-end">Cost</th>
                      <th className="text-end">Profit</th>
                      <th className="text-end">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-3">
                          {loading
                            ? "Loading item profitability..."
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
                            {/* qtySold is now a formatted string like "11 PIECES" */}
                            {it.qtySold || it.qtyDisplay || "-"}
                          </td>
                          <td className="text-end">
                            {formatMoney(it.totalRevenue)}
                          </td>
                          <td className="text-end">
                            {formatMoney(it.totalCost)}
                          </td>
                          <td className="text-end">
                            {formatMoney(it.profit)}
                          </td>
                          <td className="text-end">
                            {formatPercent(it.margin)}
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

export default BusinessDashboard;
