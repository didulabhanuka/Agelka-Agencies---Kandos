// src/pages/reports/PurchaseDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { getPurchaseSnapshot } from "../../lib/api/ledger.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

const PurchaseDashboard = ({ salesRepId }) => {
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState({
    generatedAt: null,
    totalNetPurchase: 0,
    totalGrossPurchase: 0,
    totalNetItems: {
      itemsCount: 0,
      qty: { baseQty: 0, primaryQty: 0 },
    },
    GRNs: {
      grnCount: 0,
      status: {
        approved: 0,
        waiting_for_approval: 0,
        cancelled: 0,
      },
    },
    supplierCount: 0,
    branchCount: 0,
    returnImpact: 0,
  });

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [filters, setFilters] = useState({ from: "", to: "" });
  const [periodLabel, setPeriodLabel] = useState("");

  const formatMoney = (val) =>
    val == null
      ? "—"
      : "LKR " +
        Number(val).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const formatNumber = (val) =>
    Number(val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const formatQtyCombined = (primaryQty = 0, baseQty = 0) => {
    const p = Number(primaryQty || 0);
    const b = Number(baseQty || 0);
    const parts = [];
    if (p) parts.push(`${formatNumber(p)} ${p > 1 ? "PACKS" : "PACK"}`);
    if (b) parts.push(`${formatNumber(b)} ${b > 1 ? "PIECES" : "PIECE"}`);
    return parts.length ? parts.join(" + ") : "0";
  };

  const formatPercent = (val) =>
    `${Number(val || 0).toLocaleString(undefined, {
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

  // ✅ Filter out null/blank supplier rows (your JSON currently has one duplicate null supplier row)
  const validSuppliers = useMemo(() => {
    return (suppliers || []).filter(
      (s) =>
        (s?.supplierId && String(s.supplierId).trim()) ||
        (s?.supplierName && String(s.supplierName).trim())
    );
  }, [suppliers]);

  const topItems = useMemo(() => {
    return [...items].sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));
  }, [items]);

  const top3BuyingItems = useMemo(() => topItems.slice(0, 3), [topItems]);

  const topSuppliers = useMemo(() => {
    return [...validSuppliers].sort(
      (a, b) => (b.totalCostValue || 0) - (a.totalCostValue || 0)
    );
  }, [validSuppliers]);

  const highReturnRate = useMemo(() => {
    if (!summary.totalGrossPurchase) return 0;
    return (
      (Math.abs(summary.returnImpact || 0) / (summary.totalGrossPurchase || 1)) * 100
    );
  }, [summary.returnImpact, summary.totalGrossPurchase]);

  const totalItemCost = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.totalCost || 0), 0),
    [items]
  );

  const totalSupplierCost = useMemo(
    () =>
      validSuppliers.reduce((sum, s) => sum + Number(s.totalCostValue || 0), 0),
    [validSuppliers]
  );

  const loadSnapshot = async (from, to) => {
    try {
      setLoading(true);

      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (salesRepId && salesRepId !== "All") params.salesRep = salesRepId;

      const res = await getPurchaseSnapshot(params);

      // ✅ API returns { message, generatedAt, ... }
      const data = res || {};

      const {
        generatedAt,
        totalNetPurchase = 0,
        totalGrossPurchase = 0,
        totalNetItems = { itemsCount: 0, qty: { primaryQty: 0, baseQty: 0 } },
        GRNs = {
          grnCount: 0,
          status: { approved: 0, waiting_for_approval: 0, cancelled: 0 },
        },
        supplierCount = 0,
        branchCount = 0,
        returnImpact = 0,
        items: itemRows = [],
        suppliers: supplierRows = [],
      } = data;

      setSummary({
        generatedAt: generatedAt || null,
        totalNetPurchase: Number(totalNetPurchase || 0),
        totalGrossPurchase: Number(totalGrossPurchase || 0),
        totalNetItems: {
          itemsCount: Number(totalNetItems?.itemsCount || 0),
          qty: {
            primaryQty: Number(totalNetItems?.qty?.primaryQty || 0),
            baseQty: Number(totalNetItems?.qty?.baseQty || 0),
          },
        },
        GRNs: {
          grnCount: Number(GRNs?.grnCount || 0),
          status: {
            approved: Number(GRNs?.status?.approved || 0),
            waiting_for_approval: Number(GRNs?.status?.waiting_for_approval || 0),
            cancelled: Number(GRNs?.status?.cancelled || 0),
          },
        },
        supplierCount: Number(supplierCount || 0),
        branchCount: Number(branchCount || 0),
        returnImpact: Number(returnImpact || 0),
      });

      setItems(Array.isArray(itemRows) ? itemRows : []);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
      setPeriodLabel(buildPeriodLabel(from, to));
    } catch (err) {
      console.error("❌ Error loading purchase snapshot:", err);
      toast.error(
        err?.response?.data?.message || "Failed to load purchase snapshot."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);

    const fromStr = first.toISOString().slice(0, 10);
    const toStr = today.toISOString().slice(0, 10);

    setFilters({ from: fromStr, to: toStr });
    loadSnapshot(fromStr, toStr);
  }, [salesRepId]);

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
    totalNetPurchase,
    totalGrossPurchase,
    totalNetItems,
    GRNs,
    supplierCount,
    branchCount,
    returnImpact,
  } = summary;

  return (
    <div className="container-fluid py-4 px-5">
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

      <div className="summary-grid">
        <div className="summary-card orange">
          <div className="summary-header">
            <span className="summary-label orange">Net Purchases</span>
            <i className="bi bi-cash-stack summary-icon orange" />
          </div>
          <div className="summary-value">{formatMoney(totalNetPurchase)}</div>
          <div className="summary-sub">Purchase cost after returns & reversals.</div>
          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Gross & Return Impact</span>
            <i className="bi bi-arrow-left-right summary-icon" />
          </div>

          <div className="summary-value">{formatMoney(totalGrossPurchase)}</div>

          <div className="summary-sub"> 
            Return impact: {formatMoney(returnImpact)}
          </div>

          <div className="summary-sub">
            Gross cost with return deduction summary.
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Net Qty Purchased</span>
            <i className="bi bi-box-seam summary-icon" />
          </div>

          <div className="summary-value"> {formatNumber(totalNetItems?.itemsCount || 0)} Items
          </div>

          <div className="summary-sub">
            {formatQtyCombined(
              totalNetItems?.qty?.primaryQty,
              totalNetItems?.qty?.baseQty
            )}
          </div>

          <div className="summary-sub">
            Net item count and quantities bought for the selected period.
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <span className="summary-label">Activity</span>
            <i className="bi bi-receipt summary-icon" />
          </div>

          <div className="summary-value">
            {formatNumber(GRNs?.grnCount || 0)}{" "}
            <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>GRNs</span>
          </div>

          <div className="summary-sub">
            {formatNumber(supplierCount)} suppliers • {formatNumber(branchCount)} branches
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
                {formatNumber(GRNs?.status?.approved || 0)}
              </span>
            </div>
            <div>
              Waiting:
              <span className="badge-pill yellow">
                {formatNumber(GRNs?.status?.waiting_for_approval || 0)}
              </span>
            </div>
            <div>
              Cancelled:
              <span className="badge-pill red">
                {formatNumber(GRNs?.status?.cancelled || 0)}
              </span>
            </div>
          </div>

          <div className="summary-period">Period: {periodLabel}</div>
        </div>
      </div>

      <div className="row g-2 mb-2">
        <div className="col-lg-12">
          <div className="section-card">
            <div className="section-title">Purchase Insights</div>
            <div className="section-subtitle">Top items & suppliers.</div>

            <ul className="insights-list">
              <li>
                <strong>Top 3 Items:</strong>:{" "}
                {top3BuyingItems.length > 0 ? (
                    top3BuyingItems.map((it, index) => (
                      <span key={`${it.itemId}_${index}`} style={{ marginRight: 8 }}>
                        <span className="badge-pill">
                          {index + 1}. {it.itemName} ({formatMoney(it.totalCost)})
                        </span>
                      </span>
                    ))
                ) : (
                  "No item data."
                )}
              </li>

              <li>
                <strong>Top supplier:</strong>{" "}
                {topSuppliers[0] ? (
                  <>
                    <span className="badge-pill">
                      {topSuppliers[0].supplierName || "Unknown Supplier"} — {formatMoney(topSuppliers[0].totalCostValue)}
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
            </ul>
          </div>
        </div>
      </div>

      <div className="row g-2">
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
                            {it.qtyDisplay ||
                              formatQtyCombined(
                                it.qtyPurchased?.primaryQty,
                                it.qtyPurchased?.baseQty
                              )}
                          </td>
                          <td className="text-end">{formatMoney(it.totalCost)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

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
                      <th>Branch</th>
                      <th className="text-end">Items Count</th>
                      <th className="text-end">Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {validSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          {loading ? "Loading..." : "No supplier data."}
                        </td>
                      </tr>
                    ) : (
                      validSuppliers.map((s, idx) => (
                        <tr key={`${s.supplierId || "na"}_${s.branchId || idx}`}>
                          <td>{s.supplierName || "Unknown Supplier"}</td>
                          <td>{s.branchName || "—"}</td>
                          <td className="text-end">
                            {formatNumber(
                              Array.isArray(s.itemsReceived) ? s.itemsReceived.length : 0
                            )}
                          </td>
                          <td className="text-end">{formatMoney(s.totalCostValue)}</td>
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