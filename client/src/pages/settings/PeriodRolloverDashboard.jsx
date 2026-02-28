// src/pages/settings/PeriodRolloverDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { toast, ToastContainer } from "react-toastify";
import {
  triggerRollover,
  getRolloverStatus,
  getClosedPeriods,
  getCurrentCounts,
} from "../../lib/api/period.api";
import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const START_YEAR   = 2026;
const YEARS        = Array.from({ length: 5 }, (_, i) => START_YEAR + i); // 2026–2030

// ─── Label + date range builders ───────────────────────────────────────────────

const buildSelection = (mode, fm, fy, tm, ty, fd, td) => {
  // Returns { label, displayLabel, fromDate, toDate } or null if incomplete
  if (mode === "single") {
    if (fm === null || fm === undefined) return null;
    const from = new Date(fy, fm, 1);
    const to   = new Date(fy, fm + 1, 0); // last day of month
    return {
      label:        `${MONTHS_SHORT[fm]}-${fy}`,
      displayLabel: `${MONTHS_FULL[fm]} ${fy}`,
      fromDate:     from.toISOString().split('T')[0],
      toDate:       to.toISOString().split('T')[0],
    };
  }
  if (mode === "month-range") {
    if (fm === null || fm === undefined || tm === null || tm === undefined) return null;
    const from = new Date(fy, fm, 1);
    const to   = new Date(ty, tm + 1, 0); // last day of end month
    const sameMonth = fy === ty && fm === tm;
    return {
      label:        sameMonth
        ? `${MONTHS_SHORT[fm]}-${fy}`
        : `${MONTHS_SHORT[fm]}-${fy}_${MONTHS_SHORT[tm]}-${ty}`,
      displayLabel: sameMonth
        ? `${MONTHS_FULL[fm]} ${fy}`
        : `${MONTHS_SHORT[fm]} ${fy} — ${MONTHS_SHORT[tm]} ${ty}`,
      fromDate:     from.toISOString().split('T')[0],
      toDate:       to.toISOString().split('T')[0],
    };
  }
  if (mode === "date-range") {
    if (!fd || !td) return null;
    if (new Date(td) < new Date(fd)) return null;
    const fmt = (d) => {
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2,"0")}-${MONTHS_SHORT[dt.getMonth()]}-${dt.getFullYear()}`;
    };
    return {
      label:        fd === td ? fmt(fd) : `${fmt(fd)}_${fmt(td)}`,
      displayLabel: fd === td
        ? fmt(fd)
        : `${new Date(fd).getDate()} ${MONTHS_SHORT[new Date(fd).getMonth()]} ${new Date(fd).getFullYear()} — ${new Date(td).getDate()} ${MONTHS_SHORT[new Date(td).getMonth()]} ${new Date(td).getFullYear()}`,
      fromDate: fd,
      toDate:   td,
    };
  }
  return null;
};

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
const ConfirmRolloverModal = ({ selection, counts, onClose, onConfirmed }) => {
  const [typedValue, setTypedValue] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmWord = `close ${selection.label.toLowerCase()}`;
  const isMatch = typedValue.trim().toLowerCase() === confirmWord;

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try { await onConfirmed(); onClose(); }
    finally { setLoading(false); }
  };

  const totalLedger = (counts?.salesLedger||0)+(counts?.purchaseLedger||0)+(counts?.stockLedger||0);

  return (
    <div className="pr-overlay" onClick={onClose}>
      <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pr-modal-header">
          <div className="pr-modal-title"><i className="bi bi-archive me-2" />Confirm Period Close</div>
          <button className="pr-modal-close" onClick={onClose}><i className="bi bi-x" /></button>
        </div>
        <div className="pr-modal-body">
          <p className="pr-modal-desc">
            Archiving period: <strong>{selection.displayLabel}</strong><br />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Stored as: <code className="pr-code">{selection.label}</code> &nbsp;|&nbsp; Range: {selection.fromDate} → {selection.toDate}</span>
          </p>

          <div className="pr-modal-counts">
            {[
              { label: "Sales Invoices",    value: counts?.salesInvoices,    icon: "bi-receipt-cutoff" },
              { label: "Sales Returns",     value: counts?.salesReturns,     icon: "bi-arrow-return-left" },
              { label: "GRNs",              value: counts?.grns,             icon: "bi-box-seam" },
              { label: "Stock Adjustments", value: counts?.stockAdjustments, icon: "bi-arrow-left-right" },
              { label: "Payments",          value: counts?.customerPayments, icon: "bi-cash-stack" },
              { label: "Ledger Entries",    value: totalLedger,              icon: "bi-journal-text" },
              { label: "SalesRep Stocks",   value: counts?.salesRepStocks,   icon: "bi-person-lines-fill" },
            ].map(({ label, value, icon }) => (
              <div key={label} className="pr-modal-count-row">
                <span><i className={`bi ${icon} me-2 text-muted`} />{label}</span>
                <strong>{value ?? 0}</strong>
              </div>
            ))}
            <div className="pr-modal-count-total">
              <span>Total records</span>
              <strong>{counts?.total ?? 0}</strong>
            </div>
          </div>

          <ul className="pr-impact-list">
            <li><i className="bi bi-arrow-repeat text-warning me-2" />SalesRep stocks reset to zero for new period</li>
            <li><i className="bi bi-box-seam text-success me-2" />Item stock levels carry forward unchanged</li>
            <li><i className="bi bi-database text-primary me-2" />Data archived to agelka-history-db — nothing deleted</li>
          </ul>

          <div className="pr-confirm-box">
            <label className="pr-confirm-label">Type <code className="pr-code">{confirmWord}</code> to confirm</label>
            <input
              autoFocus type="text"
              className={`pr-confirm-input ${typedValue && !isMatch ? "pr-input-error" : ""} ${isMatch ? "pr-input-ok" : ""}`}
              placeholder={confirmWord}
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isMatch && handleConfirm()}
            />
          </div>
        </div>
        <div className="pr-modal-footer">
          <button className="pr-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="pr-btn-confirm" disabled={!isMatch || loading} onClick={handleConfirm}>
            {loading ? <><span className="spinner-border spinner-border-sm me-2" />Closing…</> : <><i className="bi bi-archive me-2" />Close Period</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Summary Card ──────────────────────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, color, loading }) => (
  <div className="pr-summary-card">
    <div className={`pr-summary-icon ${color}`}><i className={`bi ${icon}`} /></div>
    <div>
      <div className="pr-summary-value">{loading ? <span className="spinner-border spinner-border-sm" /> : (value ?? 0)}</div>
      <div className="pr-summary-label">{label}</div>
    </div>
  </div>
);

// ─── MonthYear Select ──────────────────────────────────────────────────────────
const MonthYearSelect = ({ label, month, year, onMonthChange, onYearChange }) => (
  <div className="pr-mypicker">
    <div className="pr-label">{label}</div>
    <div className="pr-mypicker-row">
      <select className="pr-select" value={month ?? ""} onChange={(e) => onMonthChange(e.target.value === "" ? null : Number(e.target.value))}>
        <option value="">Select Month</option>
        {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select className="pr-select" value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  </div>
);

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const PeriodRolloverDashboard = () => {
  const [mode, setMode] = useState("single");

  // Single / month-range — default null month so nothing is pre-selected
  const [fromMonth, setFromMonth] = useState(null);
  const [fromYear,  setFromYear]  = useState(START_YEAR);
  const [toMonth,   setToMonth]   = useState(null);
  const [toYear,    setToYear]    = useState(START_YEAR);

  // Date range
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

  const [modalOpen, setModalOpen]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [activeJob, setActiveJob]         = useState(null);
  const [closedPeriods, setClosedPeriods] = useState([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [counts, setCounts]               = useState(null);
  const [countsLoading, setCountsLoading] = useState(false);

  // Compute selection from current state
  const selection = buildSelection(mode, fromMonth, fromYear, toMonth, toYear, fromDate, toDate);

  useEffect(() => { fetchData(); }, []);

  // Refresh counts whenever selection changes
  useEffect(() => {
    if (!selection) { setCounts(null); return; }
    fetchCounts(selection.fromDate, selection.toDate);
  }, [selection?.fromDate, selection?.toDate]);

  const fetchData = async () => {
    setStatusLoading(true);
    try {
      const [s, h] = await Promise.all([getRolloverStatus(), getClosedPeriods()]);
      setActiveJob(s.activeJob);
      setClosedPeriods(h.periods || []);
    } catch { toast.error("Failed to load period data."); }
    finally { setStatusLoading(false); }
  };

  const fetchCounts = async (fd, td) => {
    setCountsLoading(true);
    try {
      const data = await getCurrentCounts(fd, td);
      setCounts(data);
    } catch { toast.error("Failed to load document counts."); }
    finally { setCountsLoading(false); }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Reset all selections on mode switch
    setFromMonth(null); setFromYear(START_YEAR);
    setToMonth(null);   setToYear(START_YEAR);
    setFromDate("");    setToDate("");
    setCounts(null);
  };

  const handleOpenModal = () => {
    if (!selection) { toast.warning("Please complete the date selection."); return; }
    setModalOpen(true);
  };

  const handleConfirmed = async () => {
    try {
      setLoading(true);
      const result = await triggerRollover(selection.label, selection.fromDate, selection.toDate);
      toast.success(result.message || `Period "${selection.displayLabel}" closed successfully!`);
      // Reset selection
      setFromMonth(null); setFromYear(START_YEAR);
      setToMonth(null);   setToYear(START_YEAR);
      setFromDate("");    setToDate("");
      setCounts(null);
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Rollover failed.");
      await fetchData();
      throw err;
    } finally { setLoading(false); }
  };

  const formatDate = (v) => {
    if (!v) return "-";
    return new Date(v).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const getStatusMeta = (s) => ({
    completed: { label: "Completed", className: "pill-success", icon: "bi-check-circle-fill" },
    failed:    { label: "Failed",    className: "pill-danger",  icon: "bi-x-circle-fill" },
    archiving: { label: "Archiving…",className: "pill-warning", icon: "bi-hourglass-split" },
    clearing:  { label: "Clearing…", className: "pill-warning", icon: "bi-hourglass-split" },
  }[s] || { label: "Started", className: "pill-warning", icon: "bi-hourglass-split" });

  const totalLedger = (counts?.salesLedger||0)+(counts?.purchaseLedger||0)+(counts?.stockLedger||0);

  return (
    <div className="container-fluid py-4 px-5">
      <style>{`

        .pr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .pr-grid { grid-template-columns: 1fr; } }
        .pr-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
        .pr-panel-title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
        .pr-panel-sub { font-size: 12px; color: #9ca3af; margin-bottom: 20px; }
        .pr-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }

        .pr-mode-tabs { display: flex; gap: 6px; margin-bottom: 20px; }
        .pr-mode-tab { flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 600; cursor: pointer; text-align: center; transition: all .15s; }
        .pr-mode-tab:hover { border-color: #d1d5db; color: #374151; }
        .pr-mode-tab.active { background: #111827; border-color: #111827; color: #fff; }

        .pr-mypicker { display: flex; flex-direction: column; gap: 6px; }
        .pr-mypicker-row { display: flex; gap: 8px; }
        .pr-select { flex: 1; padding: 9px 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; color: #111827; background: #f9fafb; outline: none; cursor: pointer; transition: border-color .15s; appearance: none; }
        .pr-select:focus { border-color: #9ca3af; background: #fff; }

        .pr-date-row { display: flex; align-items: flex-end; gap: 10px; }
        .pr-date-field { flex: 1; }
        .pr-date-input { width: 100%; padding: 9px 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; color: #111827; background: #f9fafb; outline: none; transition: border-color .15s; }
        .pr-date-input:focus { border-color: #9ca3af; background: #fff; }
        .pr-date-sep { color: #d1d5db; font-size: 18px; padding-bottom: 8px; }

        .pr-preview { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f0fdf4; border: 1px solid #abefc6; border-radius: 8px; margin-top: 14px; }
        .pr-preview-label { font-size: 13px; font-weight: 700; color: #027a48; }
        .pr-preview-code { font-size: 11px; color: #6b7280; font-family: 'Courier New', monospace; }
        .pr-preview-empty { padding: 10px 14px; background: #f9fafb; border: 1px dashed #e5e7eb; border-radius: 8px; margin-top: 14px; font-size: 12px; color: #d1d5db; text-align: center; }

        .pr-trigger-btn { width: 100%; margin-top: 16px; padding: 11px 20px; border-radius: 8px; background: #fef2f2; border: 1px solid #fca5a5; color: #b42318; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background .15s; }
        .pr-trigger-btn:hover:not(:disabled) { background: #b42318; color: #ffffff; text-align: center;}
        .pr-trigger-btn:disabled { opacity: .45; cursor: not-allowed; }

        /* ── Active job banners — now using CleanerDashboard red warning palette ── */
        .pr-active-banner { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; font-weight: 600; }
        .pr-active-banner.warning { background: #fef2f2; border: 1px solid #fca5a5; color: #b42318; }
        .pr-active-banner.danger  { background: #fef2f2; border: 1px solid #fca5a5; color: #b42318; }
        .pr-active-banner i { font-size: 16px; }
        .pr-resume-btn { margin-left: auto; padding: 6px 14px; border-radius: 6px; border: 1px solid currentColor; background: transparent; font-size: 12px; font-weight: 700; cursor: pointer; color: inherit; }

        .pr-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
        .pr-summary-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fafafa; }
        .pr-summary-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .pr-summary-icon.blue   { background: #eff6ff; color: #1d4ed8; }
        .pr-summary-icon.purple { background: #f5f3ff; color: #7c3aed; }
        .pr-summary-icon.green  { background: #f0fdf4; color: #16a34a; }
        .pr-summary-icon.orange { background: #fff7ed; color: #ea580c; }
        .pr-summary-icon.red    { background: #fef2f2; color: #dc2626; }
        .pr-summary-icon.gray   { background: #f9fafb; color: #6b7280; }
        .pr-summary-icon.teal   { background: #f0fdfa; color: #0d9488; }
        .pr-summary-value { font-size: 20px; font-weight: 700; color: #111827; line-height: 1; }
        .pr-summary-label { font-size: 11px; color: #9ca3af; font-weight: 500; margin-top: 2px; }
        .pr-summary-empty { font-size: 12px; color: #d1d5db; text-align: center; padding: 16px; grid-column: span 3; }

        .pr-total-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; margin-top: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; }
        .pr-total-label { font-size: 13px; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 8px; }
        .pr-total-value { font-size: 22px; font-weight: 800; color: #111827; }

        .pr-history-wrap { max-height: 420px; overflow: auto; border-radius: 10px; }
        .pr-history-wrap .modern-table thead th { position: sticky; top: 0; z-index: 5; background: #fff; box-shadow: inset 0 -1px 0 #eef0f3; }
        .pr-history-row { transition: background .15s; }
        .pr-history-row:hover { background: #fafbff; }
        .pr-period-label { font-weight: 700; color: #111827; font-family: 'Courier New', monospace; letter-spacing: .04em; font-size: 12px; }
        .pr-period-range { font-size: 11px; color: #9ca3af; margin-top: 2px; }

        .status-pill-ux { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; font-size: 12px; font-weight: 700; padding: 4px 10px; border: 1px solid transparent; white-space: nowrap; }
        .status-pill-ux.pill-success { background: #ecfdf3; color: #027a48; border-color: #abefc6; }

        /* ── Warning/in-progress pill — red palette from CleanerDashboard ── */
        .status-pill-ux.pill-warning { background: #fef2f2; color: #b42318; border-color: #fca5a5; }
        .status-pill-ux.pill-danger  { background: #fef2f2; color: #b42318; border-color: #fca5a5; }

        /* ── Info banner — red palette from CleanerDashboard ── */
        .pr-banner { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border: 1px solid #fca5a5; border-radius: 8px; background: #fca5a5; margin-bottom: 20px; font-size: 13px; color: #000; line-height: 1.5; }
        .pr-banner i { color: #000; font-size: 15px; margin-top: 1px; flex-shrink: 0; }

        .pr-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; }
        .pr-modal { background: #fff; border-radius: 12px; width: 100%; max-width: 500px; border: 1px solid #fca5a5; box-shadow: 0 20px 40px rgba(0,0,0,.12); overflow: hidden; max-height: 90vh; overflow-y: auto; }
        .pr-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; background: #fca5a5; position: sticky; top: 0; z-index: 1; }
        .pr-modal-title { font-size: 14px; font-weight: 700; color: #111827; display: flex; align-items: center; }
        .pr-modal-close { border: none; background: none; font-size: 18px; color: #6b7280; cursor: pointer; }
        .pr-modal-close:hover { color: #111827; }
        .pr-modal-body { padding: 20px; }
        .pr-modal-desc { font-size: 13.5px; color: #4b5563; line-height: 1.6; margin-bottom: 12px; }
        .pr-modal-counts { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .pr-modal-count-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; }
        .pr-modal-count-row:last-of-type { border-bottom: none; }
        .pr-modal-count-total { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 2px; font-size: 13px; font-weight: 700; color: #111827; border-top: 2px solid #e5e7eb; margin-top: 4px; }
        .pr-impact-list { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 6px; }
        .pr-impact-list li { font-size: 12.5px; color: #374151; display: flex; align-items: center; }
        .pr-confirm-box { display: flex; flex-direction: column; gap: 6px; }
        .pr-confirm-label { font-size: 12px; color: #6b7280; font-weight: 500; }
        .pr-code { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 1px 5px; font-size: 12px; color: #111827; font-family: 'Courier New', monospace; }
        .pr-confirm-input { padding: 9px 11px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; font-family: 'Courier New', monospace; outline: none; transition: border-color .15s; background: #f9fafb; width: 100%; }
        .pr-confirm-input:focus { border-color: #9ca3af; background: #fff; }
        .pr-input-error { border-color: #fca5a5 !important; }
        .pr-input-ok   { border-color: #86efac !important; }
        .pr-modal-footer { padding: 12px 20px; border-top: 1px solid #f3f4f6; display: flex; justify-content: flex-end; gap: 8px; }
        .pr-btn-cancel { padding: 8px 16px; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 13px; font-weight: 500; cursor: pointer; }
        .pr-btn-cancel:hover { background: #f9fafb; }
        .pr-btn-confirm { padding: 8px 20px; border-radius: 6px; border: none; background: #fca5a5; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; transition: background .15s, opacity .15s; }
        .pr-btn-confirm:hover:not(:disabled) { background: #b42318; color: #fff;}
        .pr-btn-confirm:disabled { opacity: .35; cursor: not-allowed; }
        .pr-empty { text-align: center; padding: 40px 20px; color: #9ca3af; }
        .pr-empty i { font-size: 32px; display: block; margin-bottom: 10px; }
        .pr-empty-text { font-size: 13px; }
        
      `}</style>

      <div className="pb-4">
        <h2 className="page-title">Period Rollover</h2>
        <p className="page-subtitle">Archive the current period's data and start fresh. Historical data saved to agelka-history-db.</p>
      </div>

      <div className="pr-banner">
        <i className="bi bi-info-circle" />
        Period rollover archives transactional data within the selected date range — invoices, GRNs, returns, ledgers, and payments.
        Item stock levels carry forward. SalesRep stocks reset to zero. This action is irreversible.
      </div>

      {!statusLoading && activeJob && (
        <div className={`pr-active-banner ${activeJob.status === "failed" ? "danger" : "warning"}`}>
          <i className={`bi ${activeJob.status === "failed" ? "bi-x-circle-fill" : "bi-hourglass-split"}`} />
          {activeJob.status === "failed"
            ? `Rollover for "${activeJob.label}" failed: ${activeJob.failureReason}`
            : `Rollover for "${activeJob.label}" is currently in progress — ${activeJob.status}…`}
          {activeJob.status === "failed" && (
            <button className="pr-resume-btn">
              <i className="bi bi-arrow-repeat me-1" />Resume
            </button>
          )}
        </div>
      )}

      <div className="pr-grid">
        {/* ── Left: Trigger ── */}
        <div className="pr-panel">
          <div className="pr-panel-title"><i className="bi bi-archive" />Close Current Period</div>
          <div className="pr-panel-sub">Select the date range of data to archive.</div>

          <div className="pr-label">Select Type</div>
          <div className="pr-mode-tabs">
            {[
              { key: "single",      label: "Single Month" },
              { key: "month-range", label: "Month Range" },
              { key: "date-range",  label: "Date Range" },
            ].map(({ key, label }) => (
              <button key={key} className={`pr-mode-tab ${mode === key ? "active" : ""}`} onClick={() => handleModeChange(key)}>
                {label}
              </button>
            ))}
          </div>

          {mode === "single" && (
            <MonthYearSelect label="Month" month={fromMonth} year={fromYear} onMonthChange={setFromMonth} onYearChange={setFromYear} />
          )}

          {mode === "month-range" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <MonthYearSelect label="From" month={fromMonth} year={fromYear} onMonthChange={setFromMonth} onYearChange={setFromYear} />
              <MonthYearSelect label="To"   month={toMonth}   year={toYear}   onMonthChange={setToMonth}   onYearChange={setToYear} />
            </div>
          )}

          {mode === "date-range" && (
            <div className="pr-date-row">
              <div className="pr-date-field">
                <div className="pr-label">From</div>
                <input type="date" className="pr-date-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <span className="pr-date-sep">—</span>
              <div className="pr-date-field">
                <div className="pr-label">To</div>
                <input type="date" className="pr-date-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          )}

          {/* Preview */}
          {selection ? (
            <div className="pr-preview">
              <span className="pr-preview-label"><i className="bi bi-calendar-check me-2" />{selection.displayLabel}</span>
              <span className="pr-preview-code">{selection.label}</span>
            </div>
          ) : (
            <div className="pr-preview-empty">Period label will appear once you complete the selection</div>
          )}

          <button className="pr-trigger-btn" onClick={handleOpenModal} disabled={loading || !selection}>
            {loading
              ? <><span className="spinner-border spinner-border-sm" />Processing…</>
              : <><i className="bi bi-archive" />Close Period</>}
          </button>

          {/* Live counts */}
          <div className="pr-label" style={{ marginTop: 24 }}>
            What Gets Archived
            {selection && <span style={{ fontWeight: 400, marginLeft: 6 }}>({selection.fromDate} → {selection.toDate})</span>}
          </div>

          {!selection ? (
            <div className="pr-summary-grid">
              <div className="pr-summary-empty" style={{ color: "#d1d5db", fontSize: 12 }}>
                Select a date range to see counts
              </div>
            </div>
          ) : (
            <>
              <div className="pr-summary-grid">
                <SummaryCard icon="bi-receipt-cutoff"    label="Invoices"       color="blue"   value={counts?.salesInvoices}    loading={countsLoading} />
                <SummaryCard icon="bi-arrow-return-left" label="Returns"        color="purple" value={counts?.salesReturns}     loading={countsLoading} />
                <SummaryCard icon="bi-box-seam"          label="GRNs"           color="green"  value={counts?.grns}             loading={countsLoading} />
                <SummaryCard icon="bi-journal-text"      label="Ledger Entries" color="orange" value={totalLedger}              loading={countsLoading} />
                <SummaryCard icon="bi-cash-stack"        label="Payments"       color="red"    value={counts?.customerPayments} loading={countsLoading} />
                <SummaryCard icon="bi-arrow-left-right"  label="Adjustments"    color="gray"   value={counts?.stockAdjustments} loading={countsLoading} />
              </div>
              <div className="pr-total-row">
                <span className="pr-total-label"><i className="bi bi-database" />Total Records</span>
                <span className="pr-total-value">
                  {countsLoading ? <span className="spinner-border spinner-border-sm" /> : (counts?.total ?? 0)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Right: History ── */}
        <div className="pr-panel">
          <div className="pr-panel-title"><i className="bi bi-clock-history" />Closed Periods</div>
          <div className="pr-panel-sub">All previously closed periods with their archived counts.</div>

          {statusLoading ? (
            <div className="text-center text-muted py-4"><span className="spinner-border spinner-border-sm me-2" />Loading…</div>
          ) : closedPeriods.length === 0 ? (
            <div className="pr-empty"><i className="bi bi-inbox" /><div className="pr-empty-text">No periods closed yet.</div></div>
          ) : (
            <div className="pr-history-wrap">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Closed At</th>
                    <th>Invoices</th>
                    <th>GRNs</th>
                    <th>Ledgers</th>
                  </tr>
                </thead>
                <tbody>
                  {closedPeriods.map((p) => {
                    const meta = getStatusMeta(p.status || "completed");
                    const ledgers = (p.summary?.salesLedger||0)+(p.summary?.purchaseLedger||0)+(p.summary?.stockLedger||0);
                    return (
                      <tr key={p._id} className="pr-history-row">
                        <td>
                          <div className="pr-period-label">{p.label}</div>
                          {p.fromDate && p.toDate && (
                            <div className="pr-period-range">
                              {new Date(p.fromDate).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                              {" — "}
                              {new Date(p.toDate).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                            </div>
                          )}
                          <span className={`status-pill-ux ${meta.className}`} style={{ marginTop: 4 }}>
                            <i className={`bi ${meta.icon}`} />{meta.label}
                          </span>
                        </td>
                        <td><div style={{ fontSize: 13 }}>{formatDate(p.closedAt)}</div></td>
                        <td><div style={{ fontWeight: 600 }}>{p.summary?.salesInvoices ?? 0}</div></td>
                        <td><div style={{ fontWeight: 600 }}>{p.summary?.grns ?? 0}</div></td>
                        <td><div style={{ fontWeight: 600 }}>{ledgers}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && selection && (
        <ConfirmRolloverModal
          selection={selection}
          counts={counts}
          onClose={() => setModalOpen(false)}
          onConfirmed={handleConfirmed}
        />
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default PeriodRolloverDashboard;