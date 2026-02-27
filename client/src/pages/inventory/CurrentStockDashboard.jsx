// src/pages/inventory/CurrentStockDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";

import { listSalesRepStockDetails } from "../../lib/api/inventory.api";
import { getSalesReps } from "../../lib/api/users.api";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const CurrentStockDashboard = () => {
  const [stockDetails, setStockDetails] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [salesRepFilter, setSalesRepFilter] = useState("All");

  const [sortConfig, setSortConfig] = useState({
    key: "item",
    direction: "asc",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [stockRes, repsRes] = await Promise.all([
        listSalesRepStockDetails(),
        getSalesReps?.() ?? Promise.resolve([]),
      ]);

      setStockDetails(Array.isArray(stockRes) ? stockRes : []);
      setSalesReps((repsRes || []).filter((r) => (r.status || "active") === "active"));
    } catch (err) {
      console.error("Failed to load current stock:", err);
      toast.error("Failed to load current stock");
    } finally {
      setLoading(false);
    }
  };

  // Helpers
  const compactQty = (qty, uom) => {
    const n = Number(qty ?? 0);
    if (!uom) return `${n}`;
    // match your requested style: 9Packs / 5Pieces (no space)
    const label = `${uom}`.toLowerCase();
    const pretty =
      label === "pack"
        ? n === 1
          ? "Pack"
          : "Packs"
        : label === "piece"
        ? n === 1
          ? "Piece"
          : "Pieces"
        : n === 1
        ? uom
        : `${uom}s`;

    return `${n}${pretty}`;
  };

  const formatMoney = (value) => {
    const n = Number(value ?? 0);
    return `Rs. ${new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)}`;
  };

  const getStockStatusMeta = (status) => {
    switch (status) {
      case "in_stock":
        return { label: "In Stock", icon: "bi-check-circle-fill", className: "pill-success" };
      case "low_stock":
        return {
          label: "Low Stock",
          icon: "bi-exclamation-triangle-fill",
          className: "pill-warning",
        };
      case "out_of_stock":
        return { label: "Out of Stock", icon: "bi-x-circle-fill", className: "pill-danger" };
      default:
        return { label: "Unknown", icon: "bi-question-circle-fill", className: "pill-muted" };
    }
  };

  // Flatten API -> one row per (item, salesRep)
    const flatRows = useMemo(() => {
    const result = [];

    for (const block of stockDetails || []) {
        const item = block?.item || {};
        const rows = Array.isArray(block?.rows) ? block.rows : [];

        for (const row of rows) {
        const qtyPrimary = Number(row?.qtyOnHand?.qtyOnHandPrimary ?? 0);
        const qtyBase = Number(row?.qtyOnHand?.qtyOnHandBase ?? 0);

        const stockValuePrimary = Number(row?.stockValue?.stockValuePrimary ?? 0);
        const stockValueBase = Number(row?.stockValue?.stockValueBase ?? 0);

        result.push({
            id: `${item?._id || "item"}-${row?._id || "row"}`,
            itemId: item?._id || "",
            itemCode: item?.itemCode || "-",
            itemName: item?.name || "-",
            primaryUom: row?.uom?.primaryUom || item?.primaryUom || "",
            baseUom: row?.uom?.baseUom || item?.baseUom || "",
            salesRepId: row?.salesRep?._id || "",
            salesRepCode: row?.salesRep?.repCode || "",
            salesRepName: row?.salesRep?.name || "-",
            qtyOnHandPrimary: qtyPrimary,
            qtyOnHandBase: qtyBase,
            stockValuePrimary,
            stockValueBase,
            totalStockValue: stockValuePrimary + stockValueBase,

            // ✅ use API stockStatus directly from block
            stockStatus: block?.stockStatus || "unknown",

            updatedAt: row?.updatedAt || null,
        });
        }
    }

    return result;
    }, [stockDetails]);

  const filteredRows = useMemo(() => {
    let data = [...flatRows];

    const s = search.trim().toLowerCase();
    if (s) {
      data = data.filter(
        (r) =>
          r.itemName?.toLowerCase().includes(s) ||
          r.itemCode?.toLowerCase().includes(s) ||
          r.salesRepName?.toLowerCase().includes(s) ||
          r.salesRepCode?.toLowerCase().includes(s)
      );
    }

    if (salesRepFilter !== "All") {
      data = data.filter((r) => r.salesRepId === salesRepFilter);
    }

    const statusRank = {
      in_stock: 1,
      low_stock: 2,
      out_of_stock: 3,
      unknown: 4,
    };

    data.sort((a, b) => {
      let aVal;
      let bVal;

      switch (sortConfig.key) {
        case "item":
          aVal = `${a.itemName} ${a.itemCode}`.toLowerCase();
          bVal = `${b.itemName} ${b.itemCode}`.toLowerCase();
          break;
        case "salesRep":
          aVal = `${a.salesRepName} ${a.salesRepCode}`.toLowerCase();
          bVal = `${b.salesRepName} ${b.salesRepCode}`.toLowerCase();
          break;
        case "qty":
          aVal = Number(a.qtyOnHandPrimary ?? 0) + Number(a.qtyOnHandBase ?? 0);
          bVal = Number(b.qtyOnHandPrimary ?? 0) + Number(b.qtyOnHandBase ?? 0);
          break;
        case "stockValue":
          aVal = Number(a.totalStockValue ?? 0);
          bVal = Number(b.totalStockValue ?? 0);
          break;
        case "status":
          aVal = statusRank[a.stockStatus || "unknown"] ?? 99;
          bVal = statusRank[b.stockStatus || "unknown"] ?? 99;
          break;
        default:
          aVal = `${a.itemName} ${a.itemCode}`.toLowerCase();
          bVal = `${b.itemName} ${b.itemCode}`.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [flatRows, search, salesRepFilter, sortConfig]);

  const salesRepOptions = useMemo(() => {
    const repIdsInStock = new Set(flatRows.map((r) => r.salesRepId).filter(Boolean));

    const fromMaster = salesReps
      .filter((r) => repIdsInStock.has(r._id))
      .map((r) => ({
        value: r._id,
        label: `${r.repCode || ""}${r.repCode && r.name ? " — " : ""}${r.name || ""}`,
      }));

    if (fromMaster.length) return fromMaster;

    const map = new Map();
    for (const r of flatRows) {
      if (!r.salesRepId) continue;
      if (!map.has(r.salesRepId)) {
        map.set(r.salesRepId, {
          value: r.salesRepId,
          label: `${r.salesRepCode || ""}${r.salesRepCode && r.salesRepName ? " — " : ""}${
            r.salesRepName || ""
          }`,
        });
      }
    }
    return Array.from(map.values());
  }, [salesReps, flatRows]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "bi-arrow-down-up";
    return sortConfig.direction === "asc" ? "bi-sort-down" : "bi-sort-up";
  };

  const resetFilters = () => {
    setSearch("");
    setSalesRepFilter("All");
    setSortConfig({ key: "item", direction: "asc" });
  };

  const visibleCountLabel = useMemo(() => {
    const count = filteredRows.length;
    return `${count} stock row${count === 1 ? "" : "s"}`;
  }, [filteredRows.length]);

  return (
    <div className="container-fluid py-4 px-5">
      <style>
        {`
          .stock-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }

          .stock-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
          }

          .stock-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }

          .stock-row:hover {
            background: #fafbff;
            box-shadow: inset 3px 0 0 #5c3e94;
          }

          .sort-btn {
            border: none;
            background: transparent;
            padding: 0;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            color: inherit;
          }

          .sort-btn:hover {
            color: #5c3e94;
          }

        .btn-soft {
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #344054;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          min-height: 42px;
          white-space: nowrap;
        }

        .btn-soft:hover {
          background: #f9fafb;
          border-color: #d0d5dd;
        }

          .filter-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
          }

          .filter-grid .filter-input {
            min-width: 240px;
          }

          .filter-grid .custom-select {
            min-width: 220px;
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

          .avatar-circle {
            width: 34px;
            height: 34px;
            border-radius: 999px;
            background: #f3f4f6;
            color: #374151;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            border: 1px solid #e5e7eb;
            flex-shrink: 0;
          }

          .main-text {
            font-weight: 700;
            color: #111827;
          }

          .sub-text {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .qty-inline {
            font-weight: 600;
            color: #111827;
          }

          .qty-muted {
            color: #6b7280;
            font-weight: 500;
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

          .status-pill-ux.pill-warning {
            background: #fffaeb;
            color: #b54708;
            border-color: #fedf89;
          }

          .status-pill-ux.pill-danger {
            background: #fef3f2;
            color: #b42318;
            border-color: #fecdca;
          }

          .status-pill-ux.pill-muted {
            background: #f2f4f7;
            color: #475467;
            border-color: #e4e7ec;
          }
        `}
      </style>

      <div className="pb-4">
        <h2 className="page-title">Current Stock</h2>
        <p className="page-subtitle">View current stock balances by item and sales rep.</p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search item / sales rep..."
              className="filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="custom-select"
              value={salesRepFilter}
              onChange={(e) => setSalesRepFilter(e.target.value)}
            >
              <option value="All">All Sales Reps</option>
              {salesRepOptions.map((rep) => (
                <option key={rep.value} value={rep.value}>
                  {rep.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-soft"
              onClick={resetFilters}
              title="Reset filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-box-seam" />
            {visibleCountLabel}
          </span>

          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="stock-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("item")}>
                    Item <i className={`bi ${getSortIcon("item")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("salesRep")}>
                    Sales Rep <i className={`bi ${getSortIcon("salesRep")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("qty")}>
                    Qty On Hand <i className={`bi ${getSortIcon("qty")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("stockValue")}>
                    Stock Value <i className={`bi ${getSortIcon("stockValue")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("status")}>
                    Status <i className={`bi ${getSortIcon("status")}`} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const stockMeta = getStockStatusMeta(row.stockStatus);

                  return (
                    <tr key={row.id} className="stock-row">
                      {/* Item */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="avatar-circle">
                            {row.itemName?.charAt(0)?.toUpperCase() ||
                              row.itemCode?.charAt(0)?.toUpperCase() ||
                              "I"}
                          </div>
                          <div>
                            <div className="main-text">{row.itemName}</div>
                            <div className="sub-text">{row.itemCode}</div>
                          </div>
                        </div>
                      </td>

                      {/* Sales Rep */}
                      <td>
                        <div>
                          <div className="main-text">{row.salesRepName || "-"}</div>
                          <div className="sub-text">{row.salesRepCode || "-"}</div>
                        </div>
                      </td>

                      {/* Qty On Hand (single-line style) */}
                      <td>
                        <div className="qty-inline">
                          {compactQty(row.qtyOnHandPrimary, row.primaryUom)}
                          {row.baseUom
                            ? ` + ${compactQty(row.qtyOnHandBase, row.baseUom)}`
                            : ""}
                        </div>
                      </td>

                      {/* Stock Value */}
                      <td>
                        <div>
                          <div className="main-text">{formatMoney(row.totalStockValue)}</div>
                          <div className="sub-text">
                            {formatMoney(row.stockValuePrimary)} + {formatMoney(row.stockValueBase)}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill-ux ${stockMeta.className}`}>
                          <i className={`bi ${stockMeta.icon}`} />
                          {stockMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    {loading ? "Loading current stock..." : "No stock rows found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default CurrentStockDashboard;