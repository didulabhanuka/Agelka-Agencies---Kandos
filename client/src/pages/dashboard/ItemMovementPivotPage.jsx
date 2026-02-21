// // src/pages/reports/ItemMovementPivotPage.jsx

// import React, { useEffect, useState, useMemo } from "react";
// import { ToastContainer, toast } from "react-toastify";
// import { getStockSnapshot } from "../../lib/api/ledger.api";
// import * as XLSX from "xlsx";

// import "react-toastify/dist/ReactToastify.css";
// import "bootstrap-icons/font/bootstrap-icons.css";

// const ItemMovementPivotPage = ({ setActiveView }) => {

//   const [loading, setLoading] = useState(true);
//   const [pivot, setPivot] = useState([]);
//   const [generatedAt, setGeneratedAt] = useState(null);

//   // Filters
//   const [selectedBranch, setSelectedBranch] = useState("all");
//   const [searchItem, setSearchItem] = useState("");

//   useEffect(() => {
//     loadSnapshot();
//   }, []);

//   const loadSnapshot = async () => {
//     try {
//       setLoading(true);
//       const res = await getStockSnapshot({});

//       if (!res) {
//         toast.error("Failed to fetch movement pivot");
//         return;
//       }

//       setPivot(res.itemMovementPivot || []);
//       setGeneratedAt(res.generatedAt || null);
//     } catch (err) {
//       console.error("❌ Failed loading snapshot:", err);
//       toast.error("Failed to load pivot data");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ------------------------------
//   // Branch List (auto-extracted)
//   // ------------------------------
//   const branchList = useMemo(() => {
//     const branches = [...new Set(pivot.map((p) => p.branchName))];
//     return branches.sort();
//   }, [pivot]);

//   // ------------------------------
//   // Filters Applied
//   // ------------------------------
//   const filteredData = useMemo(() => {
//     return pivot.filter((row) => {
//       const matchesBranch =
//         selectedBranch === "all" || row.branchName === selectedBranch;

//       const search = searchItem.toLowerCase();
//       const matchesSearch =
//         row.itemName.toLowerCase().includes(search) ||
//         row.itemCode.toLowerCase().includes(search);

//       return matchesBranch && matchesSearch;
//     });
//   }, [pivot, selectedBranch, searchItem]);

//   // ------------------------------
//   // Number Formatter
//   // ------------------------------
//   const formatNumber = (num) => {
//     const n = Number(num);
//     if (!n || n === 0) return "-";
//     return n.toLocaleString("en-US");
//   };

//   // ------------------------------
//   // Prepare Export (uses FILTERED DATA)
//   // ------------------------------
//   const prepareExportData = () => {
//     return filteredData.map((row) => ({
//       Item: row.itemName,
//       Code: row.itemCode,
//       Branch: row.branchName,
//       AvailableQty: row.netQty,
//       Purchase: row.purchase,
//       PurchaseReturn: row.purchase_return,
//       AdjGoodsReceive: row.adj_goods_receive,
//       AdjGoodsReturn: row.adj_goods_return,
//       Sale: row.sale,
//       SalesReturn: row.sales_return,
//       AdjSale: row.adj_sale,
//       AdjSalesReturn: row.adj_sales_return,
//     }));
//   };

//   // ------------------------------
//   // CSV Export
//   // ------------------------------
//   const exportCSV = () => {
//     const data = prepareExportData();

//     if (!data.length) {
//       toast.warn("No filtered data to export.");
//       return;
//     }

//     const header = Object.keys(data[0]).join(",");
//     const rows = data
//       .map((row) =>
//         Object.values(row)
//           .map((v) => `"${v ?? ""}"`)
//           .join(",")
//       )
//       .join("\n");

//     const csvContent = `${header}\n${rows}`;

//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);

//     const link = document.createElement("a");
//     link.href = url;
//     link.download = `ItemMovementPivot_${Date.now()}.csv`;
//     link.click();
//   };

//   // ------------------------------
//   // Excel Export
//   // ------------------------------
//   const exportExcel = () => {
//     const data = prepareExportData();

//     if (!data.length) {
//       toast.warn("No filtered data to export.");
//       return;
//     }

//     const sheet = XLSX.utils.json_to_sheet(data);
//     const wb = XLSX.utils.book_new();

//     XLSX.utils.book_append_sheet(wb, sheet, "Item Movement");
//     XLSX.writeFile(wb, `ItemMovementPivot_${Date.now()}.xlsx`);
//   };

//   // ------------------------------
//   // UI
//   // ------------------------------
//   return (
//     <div className="container-fluid py-4 px-5">
//       {/* Page Header */}
//       <div className="pb-3">
//         <h2 className="page-title">Item Movement Pivot</h2>
//         <p className="page-subtitle">
//           Detailed movement breakdown by item, branch, and transaction type.
//         </p>

//         {generatedAt && (
//           <div className="text-muted" style={{ fontSize: "0.85rem" }}>
//             Last generated: {new Date(generatedAt).toLocaleString()}
//           </div>
//         )}
//       </div>

//       {/* FILTERS */}
//       <div className="filter-bar">
//         <div className="filter-left">

//           {/* Item Search */}
//           <input
//             type="text"
//             placeholder="Search item..."
//             className="filter-input"
//             value={searchItem}
//             onChange={(e) => setSearchItem(e.target.value)}
//           />

//           {/* Branch Filter */}
//           <div className="dropdown-container">
//             <select
//               className="custom-select"
//               value={selectedBranch}
//               onChange={(e) => setSelectedBranch(e.target.value)}
//             >
//               <option value="all">All Branches</option>
//               {branchList.map((b, idx) => (
//                 <option key={idx} value={b}>
//                   {b}
//                 </option>
//               ))}
//             </select>
//           </div>         
//         </div>
//       </div>

//       {/* Table Section */}
//       <div className="table-container p-3">
//         <div className="table-block">

//           {/* Header Bar + Export */}
//           <div className="d-flex justify-content-between align-items-center mb-3">

//             <div>
//               <div className="section-title">Movement by Transaction Type (Pivot)</div>
//               <div className="section-subtitle">
//                 Showing {filteredData.length} results.
//               </div>
//             </div>

//             <div className="d-flex align-items-center gap-2">
//               {/* Export Dropdown */}
//               <div className="dropdown">
//                 <button
//                   className="btn btn-sm btn-success dropdown-toggle"
//                   data-bs-toggle="dropdown"
//                 >
//                   <i className="bi bi-download me-1"></i> Export
//                 </button>

//                 <ul className="dropdown-menu dropdown-menu-end">
//                   <li>
//                     <button className="dropdown-item" onClick={exportExcel}>
//                       Excel (.xlsx)
//                     </button>
//                   </li>
//                   <li>
//                     <button className="dropdown-item" onClick={exportCSV}>
//                       CSV (.csv)
//                     </button>
//                   </li>
//                 </ul>
//               </div>

//               {/* Back */}
//               <button
//                 className="btn btn-sm btn-light"
//                 style={{ borderRadius: "6px" }}
//                 onClick={() => setActiveView("stock")}
//               >
//                 <i className="bi bi-arrow-left"></i>
//               </button>
//             </div>
//           </div>

//           {/* TABLE */}
//           <div
//             className="table-responsive"
//             style={{ maxHeight: "500px", overflowY: "auto" }}
//           >
//             <table className="modern-table small-table">
//               <thead>
//                 <tr>
//                   <th rowSpan={2}>Item</th>
//                   <th rowSpan={2}>Branch</th>
//                   <th rowSpan={2} className="text-end">Available Qty</th>
//                   <th colSpan={2} className="text-center">Purchase</th>
//                   <th colSpan={2} className="text-center">Purchase Adjustments</th>
//                   <th colSpan={2} className="text-center">Sale</th>
//                   <th colSpan={2} className="text-center">Sale Adjustments</th>
//                 </tr>

//                 <tr>
//                   <th className="text-end">Purchase</th>
//                   <th className="text-end">Purchase Return</th>
//                   <th className="text-end">Adj GRN</th>
//                   <th className="text-end">Adj GRN Return</th>
//                   <th className="text-end">Sale</th>
//                   <th className="text-end">Sales Return</th>
//                   <th className="text-end">Adj Sale</th>
//                   <th className="text-end">Adj Sale Return</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {loading ? (
//                   <tr>
//                     <td colSpan={13} className="text-center text-muted py-4">
//                       Loading movement data…
//                     </td>
//                   </tr>
//                 ) : filteredData.length === 0 ? (
//                   <tr>
//                     <td colSpan={13} className="text-center text-muted py-4">
//                       No matching results.
//                     </td>
//                   </tr>
//                 ) : (
//                   filteredData.map((row, idx) => (
//                     <tr key={idx}>
//                       <td>
//                         <div style={{ fontWeight: 600 }}>{row.itemName}</div>
//                         <div className="text-muted" style={{ fontSize: "0.75rem" }}>
//                           {row.itemCode}
//                         </div>
//                       </td>

//                       <td>{row.branchName}</td>

//                       <td className="text-end">{formatNumber(row.netQty)}</td>

//                       <td className="text-end">{formatNumber(row.purchase)}</td>
//                       <td className="text-end">{formatNumber(row.purchase_return)}</td>

//                       <td className="text-end">{formatNumber(row.adj_goods_receive)}</td>
//                       <td className="text-end">{formatNumber(row.adj_goods_return)}</td>

//                       <td className="text-end">{formatNumber(row.sale)}</td>
//                       <td className="text-end">{formatNumber(row.sales_return)}</td>

//                       <td className="text-end">{formatNumber(row.adj_sale)}</td>
//                       <td className="text-end">{formatNumber(row.adj_sales_return)}</td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>

//             </table>
//           </div>

//         </div>
//       </div>

//       <ToastContainer position="top-right" autoClose={2000} />
//     </div>
//   );
// };

// export default ItemMovementPivotPage;









// src/pages/reports/ItemMovementPivotPage.jsx

import React, { useEffect, useState, useMemo } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getStockSnapshot } from "../../lib/api/ledger.api";
import { getItems } from "../../lib/api/inventory.api"; // 🔹 NEW
import * as XLSX from "xlsx";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const ItemMovementPivotPage = ({ setActiveView }) => {
  const [loading, setLoading] = useState(true);
  const [pivot, setPivot] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);

  // 🔹 UOM map: { [itemId]: { primaryUom, baseUom } }
  const [itemUomMap, setItemUomMap] = useState({});

  // Filters
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchItem, setSearchItem] = useState("");

  useEffect(() => {
    loadSnapshot();
  }, []);

  const loadSnapshot = async () => {
    try {
      setLoading(true);

      // Load snapshot + items in parallel
      const [res, itemsRes] = await Promise.all([
        getStockSnapshot({}),
        getItems({}), // you can pass filters if needed
      ]);

      if (!res) {
        toast.error("Failed to fetch movement pivot");
        return;
      }

      setPivot(res.itemMovementPivot || []);
      setGeneratedAt(res.generatedAt || null);

      // Build UOM map from items
      const uomMap = {};
      (itemsRes || []).forEach((it) => {
        uomMap[it._id] = {
          primaryUom: it.primaryUom || null,
          baseUom: it.baseUom || null,
        };
      });
      setItemUomMap(uomMap);
    } catch (err) {
      console.error("❌ Failed loading snapshot:", err);
      toast.error("Failed to load pivot data");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // Branch List (auto-extracted)
  // ------------------------------
  const branchList = useMemo(() => {
    const branches = [...new Set(pivot.map((p) => p.branchName))];
    return branches.sort();
  }, [pivot]);

  // ------------------------------
  // Filters Applied
  // ------------------------------
  const filteredData = useMemo(() => {
    return pivot.filter((row) => {
      const matchesBranch =
        selectedBranch === "all" || row.branchName === selectedBranch;

      const search = searchItem.toLowerCase();
      const matchesSearch =
        row.itemName.toLowerCase().includes(search) ||
        row.itemCode.toLowerCase().includes(search);

      return matchesBranch && matchesSearch;
    });
  }, [pivot, selectedBranch, searchItem]);

  // ------------------------------
  // Number + Qty Formatters
  // ------------------------------
  const formatNumber = (num) => {
    const n = Number(num);
    if (!n || n === 0) return "-";
    return n.toLocaleString("en-US");
  };

  // "10 PACK + 5 PIECE" / "6 PACK" / "0"
  const formatQtyCombined = (
    primaryQty = 0,
    baseQty = 0,
    primaryLabel = "PRIMARY",
    baseLabel = "BASE"
  ) => {
    const p = primaryQty || 0;
    const b = baseQty || 0;
    const parts = [];
    if (p) parts.push(`${formatNumber(p)} ${primaryLabel}`);
    if (b) parts.push(`${formatNumber(b)} ${baseLabel}`);
    if (!parts.length) return "0";
    return parts.join(" + ");
  };

  // ------------------------------
  // Prepare Export (uses FILTERED DATA)
  // ------------------------------
  const prepareExportData = () => {
    return filteredData.map((row) => ({
      Item: row.itemName,
      Code: row.itemCode,
      Branch: row.branchName,

      AvailableQty_Primary: row?.netQty?.primaryQty || 0,
      AvailableQty_Base: row?.netQty?.baseQty || 0,

      Purchases_Primary: row?.purchase?.primaryQty || 0,
      Purchases_Base: row?.purchase?.baseQty || 0,

      Sales_Primary: row?.sales?.primaryQty || 0,
      Sales_Base: row?.sales?.baseQty || 0,

      Returns_Primary: row?.returns?.primaryQty || 0,
      Returns_Base: row?.returns?.baseQty || 0,

      PurchaseReturns_Primary: row?.returns?.purchase_return?.primaryQty || 0,
      PurchaseReturns_Base: row?.returns?.purchase_return?.baseQty || 0,

      SalesReturns_Primary: row?.returns?.sales_return?.primaryQty || 0,
      SalesReturns_Base: row?.returns?.sales_return?.baseQty || 0,
    }));
  };

  // ------------------------------
  // CSV Export
  // ------------------------------
  const exportCSV = () => {
    const data = prepareExportData();

    if (!data.length) {
      toast.warn("No filtered data to export.");
      return;
    }

    const header = Object.keys(data[0]).join(",");
    const rows = data
      .map((row) =>
        Object.values(row)
          .map((v) => `"${v ?? ""}"`)
          .join(",")
      )
      .join("\n");

    const csvContent = `${header}\n${rows}`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `ItemMovementPivot_${Date.now()}.csv`;
    link.click();
  };

  // ------------------------------
  // Excel Export
  // ------------------------------
  const exportExcel = () => {
    const data = prepareExportData();

    if (!data.length) {
      toast.warn("No filtered data to export.");
      return;
    }

    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, sheet, "Item Movement");
    XLSX.writeFile(wb, `ItemMovementPivot_${Date.now()}.xlsx`);
  };

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="container-fluid py-4 px-5">
      {/* Page Header */}
      <div className="pb-3">
        <h2 className="page-title">Item Movement Pivot</h2>
        <p className="page-subtitle">
          Detailed movement breakdown by item and branch (Purchases / Sales / Returns).
        </p>

        {generatedAt && (
          <div className="text-muted" style={{ fontSize: "0.85rem" }}>
            Last generated: {new Date(generatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* FILTERS */}
      <div className="filter-bar">
        <div className="filter-left">
          {/* Item Search */}
          <input
            type="text"
            placeholder="Search item..."
            className="filter-input"
            value={searchItem}
            onChange={(e) => setSearchItem(e.target.value)}
          />

          {/* Branch Filter */}
          <div className="dropdown-container">
            <select
              className="custom-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="all">All Branches</option>
              {branchList.map((b, idx) => (
                <option key={idx} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-container p-3">
        <div className="table-block">
          {/* Header Bar + Export */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div className="section-title">
                Movement by Transaction Type (Pivot)
              </div>
              <div className="section-subtitle">
                Showing {filteredData.length} results.
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              {/* Export Dropdown */}
              <div className="dropdown">
                <button
                  className="btn btn-sm btn-success dropdown-toggle"
                  data-bs-toggle="dropdown"
                >
                  <i className="bi bi-download me-1"></i> Export
                </button>

                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <button className="dropdown-item" onClick={exportExcel}>
                      Excel (.xlsx)
                    </button>
                  </li>
                  <li>
                    <button className="dropdown-item" onClick={exportCSV}>
                      CSV (.csv)
                    </button>
                  </li>
                </ul>
              </div>

              {/* Back */}
              <button
                className="btn btn-sm btn-light"
                style={{ borderRadius: "6px" }}
                onClick={() => setActiveView("stock")}
              >
                <i className="bi bi-arrow-left"></i>
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div
            className="table-responsive"
            style={{ maxHeight: "500px", overflowY: "auto" }}
          >
            <table className="modern-table small-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Branch</th>
                  <th className="text-end">Available Qty</th>
                  <th className="text-end">Purchases</th>
                  <th className="text-end">Sales</th>
                  <th colSpan="2" className="text-end">
                    Returns <br />
                    <small>Purchase | Sales</small>
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      Loading movement data…
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No matching results.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, idx) => {
                    const net = row?.netQty || {};
                    const p = row?.purchase || {};
                    const s = row?.sales || {};
const r = row?.returns || {};

// support both snake_case and camelCase just in case
const purchaseReturnQty =
  r.purchase_return || r.purchaseReturn || {};
const salesReturnQty =
  r.sales_return || r.salesReturn || {};

const uom = itemUomMap[row.itemId] || {};
const primaryLabel = uom.primaryUom || "PRIMARY";
const hasBaseUom = !!uom.baseUom;
const baseLabel = uom.baseUom || "BASE";

// If no baseUom defined, hide base-side qty in display
const netBaseQty = hasBaseUom ? net.baseQty : 0;
const pBaseQty = hasBaseUom ? p.baseQty : 0;
const sBaseQty = hasBaseUom ? s.baseQty : 0;

// ❌ previously using r.baseQty for both types
// ✅ now use each nested object's baseQty
const purchaseReturnBaseQty = hasBaseUom
  ? purchaseReturnQty.baseQty
  : 0;
const salesReturnBaseQty = hasBaseUom
  ? salesReturnQty.baseQty
  : 0;


                    return (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.itemName}</div>
                          <div
                            className="text-muted"
                            style={{ fontSize: "0.75rem" }}
                          >
                            {row.itemCode}
                          </div>
                        </td>

                        <td>{row.branchName}</td>

                        <td className="text-end">
                          {formatQtyCombined(
                            net.primaryQty,
                            netBaseQty,
                            primaryLabel,
                            baseLabel
                          )}
                        </td>

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
    purchaseReturnQty.primaryQty,
    purchaseReturnBaseQty,
    primaryLabel,
    baseLabel
  )}
</td>

<td className="text-end">
  {formatQtyCombined(
    salesReturnQty.primaryQty,
    salesReturnBaseQty,
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

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default ItemMovementPivotPage;
