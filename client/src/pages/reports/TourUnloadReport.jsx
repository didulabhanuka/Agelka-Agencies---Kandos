// src/pages/inventory/TourUnloadReport.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useReactToPrint } from "react-to-print";

import { listSalesRepStockDetails } from "../../lib/api/inventory.api";
import { getSalesReps } from "../../lib/api/users.api";
import GRNPrintTemplate from "../../components/print/TourUnloadPrintTemplate";

import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const TourUnloadReport = () => {
  const [stockDetails, setStockDetails] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [salesRepFilter, setSalesRepFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");

  const [countInputs, setCountInputs] = useState({});

  const [sortConfig, setSortConfig] = useState({
    key: "item",
    direction: "asc",
  });

  const printRef = useRef(null);

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
      console.error("Failed to load tour unload report data:", err);
      toast.error("Failed to load tour unload report data");
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = (v) => v === "" || v === null || v === undefined;

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // UOM-safe: no plural guessing
  const compactQty = (qty, uom) => {
    const n = toNumber(qty);
    if (!uom) return `${n}`;
    return `${n}${uom}`;
  };

  const normalizeToBase = ({ primaryQty, baseQty, factorToBase, hasBase }) => {
    const factor = Math.max(1, Math.floor(toNumber(factorToBase || 1)));
    const p = toNumber(primaryQty);
    const b = hasBase ? toNumber(baseQty) : 0;
    return hasBase ? p * factor + b : p;
  };

  const baseToDisplayText = ({ totalBaseQty, factorToBase, primaryUom, baseUom, hasBase }) => {
    const totalBase = Math.max(0, Math.floor(toNumber(totalBaseQty)));
    const factor = Math.max(1, Math.floor(toNumber(factorToBase || 1)));

    if (!hasBase || !baseUom || factor <= 1) {
      return compactQty(totalBase, primaryUom || baseUom || "UNIT");
    }

    const primary = Math.floor(totalBase / factor);
    const base = totalBase % factor;

    if (primary > 0 && base > 0) return `${compactQty(primary, primaryUom)} + ${compactQty(base, baseUom)}`;
    if (primary > 0) return compactQty(primary, primaryUom);
    return compactQty(base, baseUom);
  };

  const getUnloadStatusMeta = ({
    systemPrimary,
    systemBase,
    countedPrimary,
    countedBase,
    hasBase,
    factorToBase,
    primaryUom,
    baseUom,
  }) => {
    const primaryEmpty = isEmpty(countedPrimary);
    const baseEmpty = isEmpty(countedBase);

    // dual-UOM: only both empty means not counted
    const notEntered = hasBase ? primaryEmpty && baseEmpty : primaryEmpty;

    if (notEntered) {
      return {
        key: "not_counted",
        label: "Not Counted",
        icon: "bi-dash-circle",
        className: "pill-muted",
      };
    }

    const systemTotalBase = normalizeToBase({
      primaryQty: systemPrimary,
      baseQty: systemBase,
      factorToBase,
      hasBase,
    });

    const countedTotalBase = normalizeToBase({
      primaryQty: countedPrimary,
      baseQty: countedBase,
      factorToBase,
      hasBase,
    });

    if (countedTotalBase === systemTotalBase) {
      return {
        key: "all_there",
        label: "All There",
        icon: "bi-check-circle-fill",
        className: "pill-success",
      };
    }

    if (countedTotalBase < systemTotalBase) {
      const missingBase = systemTotalBase - countedTotalBase;
      const missingText = baseToDisplayText({
        totalBaseQty: missingBase,
        factorToBase,
        primaryUom,
        baseUom,
        hasBase,
      });

      return {
        key: "missing",
        label: `Missing (${missingText})`,
        icon: "bi-exclamation-triangle-fill",
        className: "pill-warning",
      };
    }

    const extraBase = countedTotalBase - systemTotalBase;
    const extraText = baseToDisplayText({
      totalBaseQty: extraBase,
      factorToBase,
      primaryUom,
      baseUom,
      hasBase,
    });

    return {
      key: "extra",
      label: `Extra (${extraText})`,
      icon: "bi-plus-circle-fill",
      className: "pill-info",
    };
  };

  const flatRows = useMemo(() => {
    const result = [];

    for (const block of stockDetails || []) {
      const item = block?.item || {};
      const rows = Array.isArray(block?.rows) ? block.rows : [];

      for (const row of rows) {
        const qtyPrimary = toNumber(row?.qtyOnHand?.qtyOnHandPrimary);
        const qtyBase = toNumber(row?.qtyOnHand?.qtyOnHandBase);

        const rowId = `${item?._id || "item"}-${row?._id || "row"}`;
        const primaryUom = row?.uom?.primaryUom || item?.primaryUom || "";
        const baseUom = row?.uom?.baseUom || item?.baseUom || null;
        const factorToBase = Math.max(1, Math.floor(toNumber(row?.factorToBase ?? item?.factorToBase ?? 1)));
        const hasBase = !!baseUom && factorToBase > 1;

        const currentInput = countInputs[rowId] || {
          countedPrimary: "",
          countedBase: "",
        };

        const unloadStatus = getUnloadStatusMeta({
          systemPrimary: qtyPrimary,
          systemBase: qtyBase,
          countedPrimary: currentInput.countedPrimary,
          countedBase: currentInput.countedBase,
          hasBase,
          factorToBase,
          primaryUom,
          baseUom,
        });

        result.push({
          id: rowId,
          itemId: item?._id || "",
          itemCode: item?.itemCode || "-",
          itemName: item?.name || "-",
          brandId: item?.brand?._id || "",
          brandName: item?.brand?.name || "-",
          brandCode: item?.brand?.brandCode || "",
          salesRepId: row?.salesRep?._id || "",
          salesRepCode: row?.salesRep?.repCode || "",
          salesRepName: row?.salesRep?.name || "-",
          primaryUom,
          baseUom,
          factorToBase,
          hasBase,
          qtyOnHandPrimary: qtyPrimary,
          qtyOnHandBase: qtyBase,
          unloadStatusKey: unloadStatus.key,
          unloadStatusLabel: unloadStatus.label,
          unloadStatusIcon: unloadStatus.icon,
          unloadStatusClass: unloadStatus.className,
          countedPrimary: currentInput.countedPrimary,
          countedBase: currentInput.countedBase,
          updatedAt: row?.updatedAt || null,
        });
      }
    }

    return result;
  }, [stockDetails, countInputs]);

  const filteredRows = useMemo(() => {
    let data = [...flatRows];

    const s = search.trim().toLowerCase();
    if (s) {
      data = data.filter(
        (r) =>
          r.itemName?.toLowerCase().includes(s) ||
          r.itemCode?.toLowerCase().includes(s) ||
          r.brandName?.toLowerCase().includes(s) ||
          r.salesRepName?.toLowerCase().includes(s) ||
          r.salesRepCode?.toLowerCase().includes(s)
      );
    }

    if (salesRepFilter !== "All") data = data.filter((r) => r.salesRepId === salesRepFilter);
    if (brandFilter !== "All") data = data.filter((r) => r.brandId === brandFilter);

    const statusRank = { not_counted: 1, all_there: 2, missing: 3, extra: 4 };

    data.sort((a, b) => {
      let aVal;
      let bVal;

      switch (sortConfig.key) {
        case "item":
          aVal = `${a.itemName} ${a.itemCode}`.toLowerCase();
          bVal = `${b.itemName} ${b.itemCode}`.toLowerCase();
          break;
        case "brand":
          aVal = `${a.brandName} ${a.brandCode}`.toLowerCase();
          bVal = `${b.brandName} ${b.brandCode}`.toLowerCase();
          break;
        case "salesRep":
          aVal = `${a.salesRepName} ${a.salesRepCode}`.toLowerCase();
          bVal = `${b.salesRepName} ${b.salesRepCode}`.toLowerCase();
          break;
        case "qty":
          aVal = a.hasBase
            ? toNumber(a.qtyOnHandPrimary) * a.factorToBase + toNumber(a.qtyOnHandBase)
            : toNumber(a.qtyOnHandPrimary);
          bVal = b.hasBase
            ? toNumber(b.qtyOnHandPrimary) * b.factorToBase + toNumber(b.qtyOnHandBase)
            : toNumber(b.qtyOnHandPrimary);
          break;
        case "status":
          aVal = statusRank[a.unloadStatusKey || "not_counted"] ?? 99;
          bVal = statusRank[b.unloadStatusKey || "not_counted"] ?? 99;
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
  }, [flatRows, search, salesRepFilter, brandFilter, sortConfig]);

  const salesRepOptions = useMemo(() => {
    const repIdsInRows = new Set(flatRows.map((r) => r.salesRepId).filter(Boolean));

    const fromMaster = salesReps
      .filter((r) => repIdsInRows.has(r._id))
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
          label: `${r.salesRepCode || ""}${r.salesRepCode && r.salesRepName ? " — " : ""}${r.salesRepName || ""}`,
        });
      }
    }
    return Array.from(map.values());
  }, [salesReps, flatRows]);

  const brandOptions = useMemo(() => {
    const map = new Map();
    for (const r of flatRows) {
      if (!r.brandId) continue;
      if (!map.has(r.brandId)) {
        map.set(r.brandId, {
          value: r.brandId,
          label: `${r.brandCode || ""}${r.brandCode && r.brandName ? " — " : ""}${r.brandName || ""}`,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [flatRows]);

  const selectedBrandLabel = useMemo(() => {
    if (brandFilter === "All") return "";
    const found = brandOptions.find((b) => b.value === brandFilter);
    if (!found) return "";
    return found.label.split(" — ")?.[1] || found.label;
  }, [brandFilter, brandOptions]);

  const selectedSalesRepLabel = useMemo(() => {
    if (salesRepFilter === "All") return "";
    const found = salesRepOptions.find((r) => r.value === salesRepFilter);
    if (!found) return "";
    return found.label.split(" — ")?.[1] || found.label;
  }, [salesRepFilter, salesRepOptions]);

  const handlePrintUnloadReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Tour_Unload_Report_${new Date().toISOString().slice(0, 10)}`,
  });

  const summary = useMemo(() => {
    let allThere = 0;
    let missing = 0;
    let extra = 0;
    let notCounted = 0;

    for (const r of filteredRows) {
      if (r.unloadStatusKey === "all_there") allThere++;
      else if (r.unloadStatusKey === "missing") missing++;
      else if (r.unloadStatusKey === "extra") extra++;
      else notCounted++;
    }

    return { total: filteredRows.length, allThere, missing, extra, notCounted };
  }, [filteredRows]);

  const handleCountInput = (rowId, field, value) => {
    if (value !== "" && !/^\d+$/.test(value)) return;

    setCountInputs((prev) => {
      const current = prev[rowId] || {
        countedPrimary: "",
        countedBase: "",
      };

      const next = { ...current, [field]: value };

      // UX: typing base first auto-sets primary = 0
      if (
        field === "countedBase" &&
        value !== "" &&
        (next.countedPrimary === "" || next.countedPrimary === null || next.countedPrimary === undefined)
      ) {
        next.countedPrimary = "0";
      }

      return { ...prev, [rowId]: next };
    });
  };

  const resetFilters = () => {
    setSearch("");
    setSalesRepFilter("All");
    setBrandFilter("All");
    setSortConfig({ key: "item", direction: "asc" });
  };

  const clearCounts = () => {
    setCountInputs({});
    toast.info("All entered unload counts cleared");
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "bi-arrow-down-up";
    return sortConfig.direction === "asc" ? "bi-sort-down" : "bi-sort-up";
  };

  return (
    <div className="container-fluid py-4 px-5">
      <style>{`
        .stock-table-wrap { max-height: 72vh; overflow: auto; border-radius: 14px; }
        .stock-table-wrap .modern-table thead th {
          position: sticky; top: 0; z-index: 5; background: #fff;
          box-shadow: inset 0 -1px 0 #eef0f3; white-space: nowrap;
        }
        .stock-row { transition: background-color .15s ease, box-shadow .15s ease; }
        .stock-row:hover { background: #fafbff; box-shadow: inset 3px 0 0 #5c3e94; }

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

        .sort-btn:hover { color: #5c3e94; }

        .filter-grid { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .filter-grid .filter-input { min-width: 240px; }
        .filter-grid .custom-select { min-width: 220px; }

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

        .table-top-note {
          display: flex; justify-content: space-between; align-items: center;
          gap: 10px; margin-bottom: 10px; flex-wrap: wrap;
        }

        .avatar-circle {
          width: 34px; height: 34px; border-radius: 999px; background: #f3f4f6; color: #374151;
          display: inline-flex; align-items: center; justify-content: center; font-weight: 700;
          border: 1px solid #e5e7eb; flex-shrink: 0;
        }

        .main-text { font-weight: 700; color: #111827; }
        .sub-text { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .qty-inline { font-weight: 600; color: #111827; }

        .status-pill-ux {
          display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
          font-size: 12px; font-weight: 700; padding: 4px 10px;
          border: 1px solid transparent; white-space: nowrap;
        }
        .status-pill-ux.pill-success { background: #ecfdf3; color: #027a48; border-color: #abefc6; }
        .status-pill-ux.pill-warning { background: #fffaeb; color: #b54708; border-color: #fedf89; }
        .status-pill-ux.pill-info { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
        .status-pill-ux.pill-muted { background: #f2f4f7; color: #475467; border-color: #e4e7ec; }

        .count-input-group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .count-input-wrap {
          display: inline-flex; align-items: center; gap: 4px; border: 1px solid #d0d5dd;
          border-radius: 8px; padding: 2px 6px; background: #fff;
        }
        .count-input { width: 70px; border: none; outline: none; font-weight: 600; background: transparent; }
        .count-uom { font-size: 11px; color: #667085; font-weight: 700; text-transform: uppercase; }

        .summary-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .summary-chip {
          font-size: 12px; font-weight: 700; border-radius: 999px; padding: 6px 10px;
          border: 1px solid #e5e7eb; background: #fff; color: #344054;
        }
      `}</style>

      <div className="pb-4">
        <h2 className="page-title">Tour Unload Report</h2>
        <p className="page-subtitle">
          Compare system stock with physically unloaded quantities by item and sales rep.
        </p>
      </div>

      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search item / brand / sales rep..."
              className="filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select className="custom-select" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
              <option value="All">All Brands</option>
              {brandOptions.map((brand) => (
                <option key={brand.value} value={brand.value}>
                  {brand.label}
                </option>
              ))}
            </select>

            <select className="custom-select" value={salesRepFilter} onChange={(e) => setSalesRepFilter(e.target.value)}>
              <option value="All">All Sales Reps</option>
              {salesRepOptions.map((rep) => (
                <option key={rep.value} value={rep.value}>
                  {rep.label}
                </option>
              ))}
            </select>

            <button type="button" className="btn-soft" onClick={resetFilters}>
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>

            <button type="button" className="btn-soft" onClick={clearCounts}>
              <i className="bi bi-eraser me-1" />
              Clear Unload Counts
            </button>
          </div>
        </div>
      </div>

      <div className="table-container p-3 mb-3">
        <div className="table-top-note">
          <div className="summary-chips">
            <span className="summary-chip"><i className="bi bi-list-ul me-1" />Total: {summary.total}</span>
            <span className="summary-chip"><i className="bi bi-dash-circle me-1" />Not Counted: {summary.notCounted}</span>
            <span className="summary-chip"><i className="bi bi-check-circle me-1" />All There: {summary.allThere}</span>
            <span className="summary-chip"><i className="bi bi-exclamation-triangle me-1" />Missing: {summary.missing}</span>
            <span className="summary-chip"><i className="bi bi-plus-circle me-1" />Extra: {summary.extra}</span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn-soft-primary"
              onClick={handlePrintUnloadReport}
              disabled={loading}
              title="Print / Download Tour Unload Report"
            >
              <i className="bi bi-printer me-1" />
              Print Report
            </button>

            {loading && (
              <span className="small text-muted">
                <i className="bi bi-arrow-repeat me-1" />
                Loading...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="table-container p-3">
        <div className="stock-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th><button className="sort-btn" onClick={() => handleSort("item")}>Item <i className={`bi ${getSortIcon("item")}`} /></button></th>
                <th><button className="sort-btn" onClick={() => handleSort("brand")}>Brand <i className={`bi ${getSortIcon("brand")}`} /></button></th>
                <th><button className="sort-btn" onClick={() => handleSort("salesRep")}>Sales Rep <i className={`bi ${getSortIcon("salesRep")}`} /></button></th>
                <th><button className="sort-btn" onClick={() => handleSort("qty")}>Qty On Hand <i className={`bi ${getSortIcon("qty")}`} /></button></th>
                <th>Unload Count</th>
                <th><button className="sort-btn" onClick={() => handleSort("status")}>Status <i className={`bi ${getSortIcon("status")}`} /></button></th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={row.id} className="stock-row">
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle">
                          {row.itemName?.charAt(0)?.toUpperCase() || row.itemCode?.charAt(0)?.toUpperCase() || "I"}
                        </div>
                        <div>
                          <div className="main-text">{row.itemName}</div>
                          <div className="sub-text">{row.itemCode}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <div className="main-text">{row.brandName || "-"}</div>
                        <div className="sub-text">{row.brandCode || "-"}</div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <div className="main-text">{row.salesRepName || "-"}</div>
                        <div className="sub-text">{row.salesRepCode || "-"}</div>
                      </div>
                    </td>

                    <td>
                      <div className="qty-inline">
                        {compactQty(row.qtyOnHandPrimary, row.primaryUom)}
                        {row.hasBase ? ` + ${compactQty(row.qtyOnHandBase, row.baseUom)}` : ""}
                      </div>
                    </td>

                    <td>
                      <div className="count-input-group">
                        <div className="count-input-wrap">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="count-input"
                            placeholder="0"
                            value={row.countedPrimary ?? ""}
                            onChange={(e) => handleCountInput(row.id, "countedPrimary", e.target.value)}
                          />
                          <span className="count-uom">{row.primaryUom || "PRIMARY"}</span>
                        </div>

                        {row.hasBase ? (
                          <div className="count-input-wrap">
                            <input
                              type="text"
                              inputMode="numeric"
                              className="count-input"
                              placeholder="0"
                              value={row.countedBase ?? ""}
                              onChange={(e) => handleCountInput(row.id, "countedBase", e.target.value)}
                            />
                            <span className="count-uom">{row.baseUom}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <span className={`status-pill-ux ${row.unloadStatusClass}`}>
                        <i className={`bi ${row.unloadStatusIcon}`} />
                        {row.unloadStatusLabel}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    {loading ? "Loading tour unload rows..." : "No rows found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden print template */}
      <div style={{ display: "none" }}>
        <GRNPrintTemplate
          ref={printRef}
          rows={filteredRows}
          brandFilterLabel={selectedBrandLabel}
          salesRepFilterLabel={selectedSalesRepLabel}
          generatedBy="Admin"
          includeOnlyCounted={true}
        />
      </div>

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default TourUnloadReport;