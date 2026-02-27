// src/pages/reports/ItemMovementPivotPage.jsx

import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getStockSnapshot } from "../../lib/api/ledger.api";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const ItemMovementPivotPage = ({ setActiveView }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchItem, setSearchItem] = useState("");

  // Sort (SalesInvoice-style)
  const [sortConfig, setSortConfig] = useState({
    key: "item",
    direction: "asc",
  });

  useEffect(() => {
    loadSnapshot();
  }, []);

  const loadSnapshot = async () => {
    try {
      setLoading(true);

      const res = await getStockSnapshot({});

      if (!res) {
        toast.error("Failed to fetch movement pivot");
        return;
      }

      // ✅ New API shape: use itemsMovement directly
      setRows(Array.isArray(res.itemsMovement) ? res.itemsMovement : []);
      setGeneratedAt(res.generatedAt || null);
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
    const branches = [...new Set((rows || []).map((r) => r.branchName).filter(Boolean))];
    return branches.sort((a, b) => String(a).localeCompare(String(b)));
  }, [rows]);

  // ------------------------------
  // Helpers
  // ------------------------------
  const safeNum = (v) => Number(v || 0);

  const getQtyScore = (obj = {}) => {
    // For sorting only; primary weighted higher than base
    return safeNum(obj.primaryQty) * 1_000_000 + safeNum(obj.baseQty);
  };

  const getDisplayText = (row, key, fallbackObj = {}) => {
    const map = {
      purchases: row?.purchasesDisplay,
      sales: row?.salesDisplay,
      returns: row?.returnsDisplay,
      net: row?.netQtyDisplay,
    };

    const display = map[key];
    if (display && typeof display === "string" && display.trim()) {
      // normalize backend "0 BASES" style into cleaner "0"
      const clean = display.trim();
      if (/^0\s+\w+/i.test(clean)) return "0";
      return clean;
    }

    // fallback (if display field missing)
    const p = safeNum(fallbackObj.primaryQty);
    const b = safeNum(fallbackObj.baseQty);
    if (!p && !b) return "0";

    const primaryLabel = row?.primaryUom || "PRIMARY";
    const hasBase = !!row?.baseUom;
    const baseLabel = row?.baseUom || "BASE";

    const parts = [];
    if (p) parts.push(`${p.toLocaleString("en-US")} ${primaryLabel}${p > 1 ? "S" : ""}`);
    if (hasBase && b) parts.push(`${b.toLocaleString("en-US")} ${baseLabel}${b > 1 ? "S" : ""}`);
    return parts.join(" + ") || "0";
  };

  // ------------------------------
  // Sort helpers
  // ------------------------------
  const getSortValue = (row, key) => {
    switch (key) {
      case "item":
        return String(row.itemName || "").toLowerCase();
      case "code":
        return String(row.itemCode || "").toLowerCase();
      case "branch":
        return String(row.branchName || "").toLowerCase();
      case "available":
        return getQtyScore(row.netQty);
      case "purchases":
        return getQtyScore(row.purchases);
      case "sales":
        return getQtyScore(row.sales);
      case "returns":
        return getQtyScore(row.returns);
      default:
        return "";
    }
  };

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

  // ------------------------------
  // Filters + Sort
  // ------------------------------
  const filteredData = useMemo(() => {
    let data = [...rows];
    const search = searchItem.trim().toLowerCase();

    data = data.filter((row) => {
      const matchesBranch = selectedBranch === "all" || row.branchName === selectedBranch;

      const itemName = String(row.itemName || "").toLowerCase();
      const itemCode = String(row.itemCode || "").toLowerCase();
      const matchesSearch = !search || itemName.includes(search) || itemCode.includes(search);

      return matchesBranch && matchesSearch;
    });

    data.sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [rows, selectedBranch, searchItem, sortConfig]);

  const resetFilters = () => {
    setSelectedBranch("all");
    setSearchItem("");
    setSortConfig({ key: "item", direction: "asc" });
  };

  const visibleCountLabel = useMemo(() => {
    const count = filteredData.length;
    return `${count} row${count === 1 ? "" : "s"}`;
  }, [filteredData.length]);

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="container-fluid py-4 px-5">
      <style>
        {`
          .pivot-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }

          .pivot-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
            vertical-align: middle;
          }

          .pivot-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }

          .pivot-row:hover {
            background: #fafbff;
            box-shadow: inset 3px 0 0 #5c3e94;
          }

          .item-cell {
            min-width: 260px;
          }

          .item-name {
            font-weight: 700;
            color: #111827;
          }

          .item-code {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .uom-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            background: #f8fafc;
            color: #475467;
            border: 1px solid #e5e7eb;
          }

          .qty-cell {
            min-width: 170px;
            text-align: right;
          }

          .qty-main {
            color: #111827;
            line-height: 1.2;
          }

          .qty-empty {
            color: #9ca3af;
            font-weight: 500;
          }

          .filter-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            width: 100%;
          }

          .filter-grid .filter-input {
            min-width: 240px;
          }

          .filter-grid .custom-select {
            min-width: 180px;
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

        .btn-soft-primary {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #5c3e94;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          min-height: 42px;
          white-space: nowrap;
        }

        .btn-soft-primary:hover {
          background: #dbeafe;
          border-color: #bfdbfe;
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
        `}
      </style>

      {/* Header */}
      <div className="pb-4">
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

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search item / code..."
              className="filter-input"
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
            />

            <select
              className="custom-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="all">All Branches</option>
              {branchList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-soft"
              onClick={resetFilters}
              title="Reset all filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>

            <button
              type="button"
              className="btn-soft-primary"
              onClick={loadSnapshot}
              disabled={loading}
              title="Refresh snapshot"
            >
              <i className={`bi ${loading ? "bi-arrow-repeat" : "bi-arrow-clockwise"} me-1`} />
              Refresh
            </button>
          </div>
        </div>

        <button
          className="btn btn-light border"
          onClick={() => setActiveView?.("stock")}
          title="Back to Stock View"
        >
          <i className="bi bi-arrow-left me-1" />
          Back
        </button>
      </div>

      {/* Table */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-grid-3x3-gap" />
            {visibleCountLabel}
          </span>

          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="pivot-table-wrap">
          <table className="modern-table small-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("item")}>
                    Item <i className={`bi ${getSortIcon("item")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("branch")}>
                    Branch <i className={`bi ${getSortIcon("branch")}`} />
                  </button>
                </th>

                <th className="text-end">
                  <button className="sort-btn" onClick={() => handleSort("available")}>
                    Available <i className={`bi ${getSortIcon("available")}`} />
                  </button>
                </th>

                <th className="text-end">
                  <button className="sort-btn" onClick={() => handleSort("purchases")}>
                    Purchases <i className={`bi ${getSortIcon("purchases")}`} />
                  </button>
                </th>

                <th className="text-end">
                  <button className="sort-btn" onClick={() => handleSort("sales")}>
                    Sales <i className={`bi ${getSortIcon("sales")}`} />
                  </button>
                </th>

                <th className="text-end">
                  <button className="sort-btn" onClick={() => handleSort("returns")}>
                    Returns <i className={`bi ${getSortIcon("returns")}`} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    Loading movement data...
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
                  const availableText = getDisplayText(row, "net", row.netQty);
                  const purchaseText = getDisplayText(row, "purchases", row.purchases);
                  const salesText = getDisplayText(row, "sales", row.sales);
                  const returnsText = getDisplayText(row, "returns", row.returns);

                  const uomLabel = row.baseUom
                    ? `${row.primaryUom || "PRIMARY"} / ${row.baseUom}`
                    : `${row.primaryUom || "PRIMARY"} only`;

                  return (
                    <tr
                      key={`${row.itemId || row.itemCode}-${row.branchId || row.branchName || idx}`}
                      className="pivot-row"
                    >
                      <td className="item-cell">
                        <div className="item-name">{row.itemName || "-"}</div>
                        <div className="item-code">{row.itemCode || "-"}</div>
                        <div className="uom-pill">
                          <i className="bi bi-box-seam" />
                          {uomLabel}
                        </div>
                      </td>

                      <td>
                        <span>
                          {row.branchName || "-"}
                        </span>
                      </td>

                      <td className="qty-cell">
                        <div className={availableText === "0" ? "qty-empty" : "qty-main"}>
                          {availableText}
                        </div>
                      </td>

                      <td className="qty-cell">
                        <div className={purchaseText === "0" ? "qty-empty" : "qty-main"}>
                          {purchaseText}
                        </div>
                      </td>

                      <td className="qty-cell">
                        <div className={salesText === "0" ? "qty-empty" : "qty-main"}>
                          {salesText}
                        </div>
                      </td>

                      <td className="qty-cell">
                        <div className={returnsText === "0" ? "qty-empty" : "qty-main"}>
                          {returnsText}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default ItemMovementPivotPage;