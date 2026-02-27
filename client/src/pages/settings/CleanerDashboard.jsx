// src/pages/settings/CleanerDashboard.jsx
import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import {
  deleteSalesInvoicesAndReturns,
  deleteStockAdjustments,
  deleteSalesRepStock,
  deleteGRNs,
  deleteLedgers,
} from "../../lib/api/settings.api";
import { getSalesReps } from "../../lib/api/users.api";
import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

// ─── Confirm Modal ────────────────────────────────────────────────────────────
const ConfirmCleanModal = ({ config, onClose, onConfirmed }) => {
  const [typedValue, setTypedValue] = useState("");
  const [loading, setLoading] = useState(false);

  if (!config) return null;

  const isMatch = typedValue.trim().toLowerCase() === config.confirmWord.toLowerCase();

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await onConfirmed();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cl-overlay" onClick={onClose}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-header">
          <div className="cl-modal-title">Confirm Deletion</div>
          <button className="cl-modal-close" onClick={onClose}>
            <i className="bi bi-x" />
          </button>
        </div>

        <div className="cl-modal-body">
          <p className="cl-modal-desc">
            {config.deleteAll ? (
              <>All <strong>{config.label}</strong> records</>
            ) : (
              <>
                All <strong>{config.label}</strong> records from{" "}
                <strong>{config.startDate}</strong> to <strong>{config.endDate}</strong>
              </>
            )}
            {config.salesRepName ? (
              <> for <strong>{config.salesRepName}</strong></>
            ) : (
              <> for <strong>all sales reps</strong></>
            )}{" "}
            will be permanently deleted. This cannot be undone.
          </p>

          <div className="cl-confirm-box">
            <label className="cl-confirm-label">
              Type <code className="cl-code">{config.confirmWord}</code> to confirm
            </label>
            <input
              autoFocus
              type="text"
              className={`cl-confirm-input ${typedValue && !isMatch ? "cl-input-error" : ""} ${isMatch ? "cl-input-ok" : ""}`}
              placeholder={config.confirmWord}
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isMatch && handleConfirm()}
            />
          </div>
        </div>

        <div className="cl-modal-footer">
          <button className="cl-btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="cl-btn-delete"
            disabled={!isMatch || loading}
            onClick={handleConfirm}
          >
            {loading ? (
              <><span className="spinner-border spinner-border-sm me-2" />Deleting…</>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Cleaner Card ─────────────────────────────────────────────────────────────
const CleanerCard = ({ icon, label, description, confirmWord, badges, salesReps, onClean }) => {
  const [deleteAll, setDeleteAll] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedRep, setSelectedRep] = useState("");
  const [modalConfig, setModalConfig] = useState(null);

  const selectedRepName = salesReps?.find((r) => r._id === selectedRep)?.name || null;

  const handleOpenModal = () => {
    if (!deleteAll) {
      if (!startDate || !endDate) {
        toast.warning("Please select both a start and end date.");
        return;
      }
      if (new Date(endDate) < new Date(startDate)) {
        toast.warning("End date must be after start date.");
        return;
      }
    }
    setModalConfig({
      label,
      icon,
      confirmWord: deleteAll ? `delete all ${confirmWord}` : confirmWord,
      startDate,
      endDate,
      deleteAll,
      salesRepName: selectedRepName,
    });
  };

  const handleConfirmed = async () => {
    try {
      const scope = selectedRep ? { salesRep: selectedRep } : {};
      const payload = deleteAll
        ? { scope }
        : { startDate, endDate, scope };

      const result = await onClean(payload);

      const countFields = [
        "deletedInvoices",
        "deletedReturns",
        "deletedPayments",
        "deletedAdjustments",
        "deletedSalesRepStocks",
        "deletedGRNs",
        "deletedSalesLedgers",
        "deletedPurchaseLedgers",
        "deletedStockLedgers",
      ];

      const parts = countFields
        .filter((f) => result?.[f] != null && result[f] > 0)
        .map((f) => {
          const name = f.replace("deleted", "").replace(/([A-Z])/g, " $1").trim();
          return `${result[f]} ${name}`;
        });

      toast.success(
        parts.length > 0
          ? `${label} — ${parts.join(", ")} deleted.`
          : `${label} cleaned successfully.`
      );
      setStartDate("");
      setEndDate("");
      setSelectedRep("");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || `Failed to clean ${label}.`);
      throw err;
    }
  };

  return (
    <>
      <div className={`cl-card ${deleteAll ? "cl-card--danger" : ""}`}>
        <div className="cl-card-top">
          <div className="cl-card-meta">
            <i className={`bi ${icon} cl-card-icon`} />
            <div>
              <div className="cl-card-label">{label}</div>
              <div className="cl-card-desc">{description}</div>
              {badges?.length > 0 && (
                <div className="cl-badges">
                  {badges.map((b) => (
                    <span key={b} className="cl-badge">{b}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Toggle */}
          <label className="cl-toggle" title="Toggle delete all">
            <input
              type="checkbox"
              checked={deleteAll}
              onChange={() => {
                setDeleteAll((p) => !p);
                setStartDate("");
                setEndDate("");
              }}
            />
            <span className="cl-toggle-track">
              <span className="cl-toggle-thumb" />
            </span>
            <span className="cl-toggle-label">{deleteAll ? "All" : "Range"}</span>
          </label>
        </div>

        {/* SalesRep filter — shown on all cards */}
        <div className="cl-rep-field">
          <label className="cl-date-label">Sales Rep</label>
          <div className="cl-rep-select-wrap">
            <i className="bi bi-person cl-rep-icon" />
            <select
              className="cl-rep-select"
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
            >
              <option value="">All Sales Reps</option>
              {salesReps?.map((rep) => (
                <option key={rep._id} value={rep._id}>
                  {rep.name}
                </option>
              ))}
            </select>
            <i className="bi bi-chevron-down cl-rep-chevron" />
          </div>
        </div>

        {!deleteAll ? (
          <div className="cl-dates">
            <div className="cl-date-field">
              <label className="cl-date-label">From</label>
              <input
                type="date"
                className="cl-date-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <span className="cl-date-sep">—</span>
            <div className="cl-date-field">
              <label className="cl-date-label">To</label>
              <input
                type="date"
                className="cl-date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="cl-all-notice">
            <i className="bi bi-exclamation-triangle me-2" />
            {selectedRepName
              ? `All records for ${selectedRepName} will be deleted with no date filter.`
              : "All records will be deleted with no date filter."}
          </div>
        )}

        <button className="cl-delete-btn" onClick={handleOpenModal}>
          <i className="bi bi-trash3 me-2" />
          {deleteAll ? "Delete All" : "Delete Range"}
        </button>
      </div>

      {modalConfig && (
        <ConfirmCleanModal
          config={modalConfig}
          onClose={() => setModalConfig(null)}
          onConfirmed={handleConfirmed}
        />
      )}
    </>
  );
};

// ─── Cleaner entries ──────────────────────────────────────────────────────────
const CLEANERS = [
  {
    icon: "bi-receipt-cutoff",
    label: "Sales Invoices & Returns",
    description: "Remove invoices and cascade-delete their linked returns and customer payments.",
    confirmWord: "invoices",
    badges: ["Invoices", "Returns", "Payments"],
    onClean: (payload) => deleteSalesInvoicesAndReturns(payload),
  },
  {
    icon: "bi-arrow-left-right",
    label: "Stock Adjustments",
    description: "Purge stock adjustment records.",
    confirmWord: "adjustments",
    badges: ["Adjustments"],
    onClean: (payload) => deleteStockAdjustments(payload),
  },
  {
    icon: "bi-person-lines-fill",
    label: "SalesRep Stock",
    description: "Delete sales rep stock allocation records.",
    confirmWord: "repstock",
    badges: ["SalesRep Stock"],
    onClean: (payload) => deleteSalesRepStock(payload),
  },
  {
    icon: "bi-box-seam",
    label: "GRNs",
    description: "Delete Goods Receipt Notes and supplier references.",
    confirmWord: "grns",
    badges: ["GRNs"],
    onClean: (payload) => deleteGRNs(payload),
  },
  {
    icon: "bi-journal-text",
    label: "Ledgers",
    description: "Wipe sales, purchase, and stock ledger entries.",
    confirmWord: "ledgers",
    badges: ["Sales Ledger", "Purchase Ledger", "Stock Ledger"],
    // Ledgers are global — scope is intentionally omitted
    onClean: ({ startDate, endDate } = {}) =>
      startDate && endDate
        ? deleteLedgers({ fromDate: startDate, toDate: endDate })
        : deleteLedgers({}),
  },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────
const CleanerDashboard = () => {
  const [salesReps, setSalesReps] = useState([]);

  useEffect(() => {
    getSalesReps()
      .then((data) => setSalesReps(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(() => toast.error("Failed to load sales reps."));
  }, []);

  return (
    <div className="container-fluid py-4 px-5">
      <style>{`
        /* ── Cards grid ── */
        .cl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 12px;
        }

        /* ── Card ── */
        .cl-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: border-color .15s;
        }
        .cl-card:hover { border-color: #d1d5db; }
        .cl-card--danger { border-color: #fca5a5; background: #fffafa; }

        .cl-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .cl-card-meta {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .cl-card-icon { font-size: 18px; color: #6b7280; margin-top: 2px; flex-shrink: 0; }
        .cl-card--danger .cl-card-icon { color: #ef4444; }
        .cl-card-label { font-size: 14px; font-weight: 600; color: #111827; line-height: 1.3; }
        .cl-card-desc { font-size: 12px; color: #9ca3af; margin-top: 2px; line-height: 1.4; }

        /* ── Badges ── */
        .cl-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .cl-badge {
          font-size: 10px; font-weight: 600; color: #6b7280;
          background: #f3f4f6; border: 1px solid #e5e7eb;
          border-radius: 4px; padding: 1px 6px; letter-spacing: .02em;
        }
        .cl-card--danger .cl-badge { color: #ef4444; background: #fef2f2; border-color: #fecaca; }

        /* ── Toggle ── */
        .cl-toggle {
          display: flex; align-items: center; gap: 6px;
          cursor: pointer; flex-shrink: 0; user-select: none;
        }
        .cl-toggle input { display: none; }
        .cl-toggle-track {
          width: 34px; height: 18px; border-radius: 999px;
          background: #e5e7eb; position: relative; transition: background .2s; flex-shrink: 0;
        }
        .cl-toggle input:checked ~ .cl-toggle-track { background: #ef4444; }
        .cl-toggle-thumb {
          position: absolute; top: 2px; left: 2px;
          width: 14px; height: 14px; border-radius: 50%;
          background: #fff; transition: transform .2s;
          box-shadow: 0 1px 2px rgba(0,0,0,.15);
        }
        .cl-toggle input:checked ~ .cl-toggle-track .cl-toggle-thumb { transform: translateX(16px); }
        .cl-toggle-label { font-size: 11px; font-weight: 600; color: #9ca3af; min-width: 32px; }
        .cl-toggle input:checked ~ .cl-toggle-label { color: #ef4444; }

        /* ── SalesRep select ── */
        .cl-rep-field { display: flex; flex-direction: column; gap: 4px; }
        .cl-rep-select-wrap { position: relative; }
        .cl-rep-icon {
          position: absolute; left: 9px; top: 50%;
          transform: translateY(-50%); font-size: 13px;
          color: #9ca3af; pointer-events: none; z-index: 1;
        }
        .cl-rep-chevron {
          position: absolute; right: 9px; top: 50%;
          transform: translateY(-50%); font-size: 11px;
          color: #9ca3af; pointer-events: none; z-index: 1;
        }
        .cl-rep-select {
          width: 100%; padding: 7px 28px 7px 28px;
          border: 1px solid #e5e7eb; border-radius: 6px;
          font-size: 12.5px; color: #374151; background: #f9fafb;
          outline: none; appearance: none; cursor: pointer;
          transition: border-color .15s;
        }
        .cl-rep-select:focus { border-color: #9ca3af; background: #fff; }
        .cl-card--danger .cl-rep-select { border-color: #fecaca; background: #fff8f8; }
        .cl-card--danger .cl-rep-select:focus { border-color: #fca5a5; }

        /* ── Date row ── */
        .cl-dates { display: flex; align-items: flex-end; gap: 8px; }
        .cl-date-field { flex: 1; }
        .cl-date-label {
          display: block; font-size: 11px; font-weight: 600; color: #9ca3af;
          text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px;
        }
        .cl-date-input {
          width: 100%; padding: 7px 9px; border: 1px solid #e5e7eb;
          border-radius: 6px; font-size: 12.5px; color: #374151;
          background: #f9fafb; outline: none; transition: border-color .15s;
        }
        .cl-date-input:focus { border-color: #9ca3af; background: #fff; }
        .cl-date-sep { color: #d1d5db; font-size: 14px; padding-bottom: 8px; flex-shrink: 0; }

        /* ── Delete all notice ── */
        .cl-all-notice {
          font-size: 12px; color: #ef4444;
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 6px; padding: 8px 12px;
          display: flex; align-items: center;
        }

        /* ── Delete button ── */
        .cl-delete-btn {
          width: 100%; padding: 8px 14px; border-radius: 7px;
          border: 1px solid #e5e7eb; background: #f9fafb; color: #374151;
          font-size: 13px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .15s, border-color .15s, color .15s;
        }
        .cl-delete-btn:hover { background: #111827; border-color: #111827; color: #fff; }
        .cl-card--danger .cl-delete-btn { border-color: #fca5a5; background: #fef2f2; color: #ef4444; }
        .cl-card--danger .cl-delete-btn:hover { background: #ef4444; border-color: #ef4444; color: #fff; }

        /* ── Warning banner ── */
        .cl-banner {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 16px; border: 1px solid #fca5a5;
          border-radius: 8px; background: #fca5a5;
          margin-bottom: 20px; font-size: 13px; color: #000; line-height: 1.5;
        }
        .cl-banner i { color: #000; font-size: 15px; margin-top: 1px; flex-shrink: 0; }

        /* ── Modal ── */
        .cl-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; padding: 16px;
        }
        .cl-modal {
          background: #fff; border-radius: 10px; width: 100%; max-width: 400px;
          border: 1px solid #fca5a5; box-shadow: 0 20px 40px rgba(0,0,0,.1); overflow: hidden;
        }
        .cl-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid #fca5a5; background: #fca5a5;
        }
        .cl-modal-title { font-size: 14px; font-weight: 700; color: #000; }
        .cl-modal-close {
          border: none; background: none; font-size: 18px;
          color: #000; cursor: pointer; line-height: 1; padding: 0;
        }
        .cl-modal-close:hover { color: #374151; }
        .cl-modal-body { padding: 20px; }
        .cl-modal-desc { font-size: 13.5px; color: #4b5563; line-height: 1.6; margin-bottom: 16px; }
        .cl-confirm-box { display: flex; flex-direction: column; gap: 6px; }
        .cl-confirm-label { font-size: 12px; color: #6b7280; font-weight: 500; }
        .cl-code {
          background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px;
          padding: 1px 5px; font-size: 12px; color: #111827;
          font-family: 'Courier New', monospace;
        }
        .cl-confirm-input {
          padding: 9px 11px; border: 1px solid #e5e7eb; border-radius: 6px;
          font-size: 13px; font-family: 'Courier New', monospace;
          outline: none; transition: border-color .15s; background: #f9fafb;
        }
        .cl-confirm-input:focus { border-color: #9ca3af; background: #fff; }
        .cl-input-error { border-color: #fca5a5 !important; }
        .cl-input-ok { border-color: #86efac !important; }
        .cl-modal-footer {
          padding: 12px 20px; border-top: 1px solid #f3f4f6;
          display: flex; justify-content: flex-end; gap: 8px;
        }
        .cl-btn-cancel {
          padding: 8px 16px; border-radius: 6px; border: 1px solid #e5e7eb;
          background: #fff; color: #374151; font-size: 13px; font-weight: 500; cursor: pointer;
        }
        .cl-btn-cancel:hover { background: #f9fafb; }
        .cl-btn-delete {
          padding: 8px 16px; border-radius: 6px; border: none;
          background: #fca5a5; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer; display: inline-flex; align-items: center;
          transition: background .15s, opacity .15s;
        }
        .cl-btn-delete:hover:not(:disabled) { background: #ef4444; }
        .cl-btn-delete:disabled { opacity: .35; cursor: not-allowed; }
      `}</style>

      {/* Page header */}
      <div className="pb-4">
        <h2 className="page-title">Data Cleaner</h2>
        <p className="page-subtitle">
          Permanently remove records by date range or delete all at once.
        </p>
      </div>

      {/* Warning banner */}
      <div className="cl-banner">
        <i className="bi bi-info-circle" />
        Deleted records cannot be recovered. Ensure you have a database backup before proceeding.
        All deletions are permanent and will remove linked references.
      </div>

      {/* Cards */}
      <div className="cl-grid">
        {CLEANERS.map((c) => (
          <CleanerCard key={c.confirmWord} {...c} salesReps={salesReps} />
        ))}
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default CleanerDashboard;