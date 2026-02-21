// src/pages/inventory/StockAdjustmentCreateModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

import {
  createAdjustment,
  updateAdjustment,
  getStockLedger,
} from "../../../lib/api/inventory.api";
import { listBranches } from "../../../lib/api/settings.api";
import { getSalesReps } from "../../../lib/api/users.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function generateAdjustmentNo() {
  const now = new Date();
  return `ADJ-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}-${Math.floor(
    10000 + Math.random() * 90000
  )}`;
}

function readAuthUser() {
  const keys = ["auth", "user", "profile", "currentUser"];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.user) return parsed.user;
      if (parsed?.data?.user) return parsed.data.user;
      if (parsed?.email || parsed?._id) return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

const EMPTY_ROW = {
  item: "",
  primaryQty: 0,
  baseQty: 0,
  avgCostBase: null,
  sellingPriceBase: null,
  avgCostPrimary: null,
  sellingPricePrimary: null,
  itemTotalValue: 0,
};

const ADJUSTMENT_TYPE_OPTIONS = [
  { label: "Sale (Stock Out)", value: "adj-sale" },
  { label: "Sales Return (Stock In)", value: "adj-sales-return" },
  { label: "Goods Receive (Stock In)", value: "adj-goods-receive" },
  { label: "Goods Return (Stock Out)", value: "adj-goods-return" },
];

const ADJ_TYPE_LABEL_MAP = {
  "adj-sale": "Sale (Stock Out)",
  "adj-sales-return": "Sales Return (Stock In)",
  "adj-goods-receive": "Goods Receive (Stock In)",
  "adj-goods-return": "Goods Return (Stock Out)",
};

function formatCurrency(v) {
  return `Rs. ${Number(v || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

function getItemOptionLabel(it) {
  if (!it) return "";
  return `${it.itemCode || "ITEM"} — ${it.itemName || ""}`;
}

function hasBaseUnit(row) {
  // if both base prices are null => likely no base UOM tracked
  // keep existing behavior, but more explicit
  return !(row.avgCostBase == null && row.sellingPriceBase == null);
}

function recalcLineTotalByType(row, type) {
  const qtyPrimary = Number(row.primaryQty ?? 0);
  const qtyBase = Number(row.baseQty ?? 0);

  const spP = Number(row.sellingPricePrimary ?? 0);
  const spB = Number(row.sellingPriceBase ?? 0);
  const acP = Number(row.avgCostPrimary ?? 0);
  const acB = Number(row.avgCostBase ?? 0);

  const isSalesType = type === "adj-sale" || type === "adj-sales-return";
  const isGoodsType = type === "adj-goods-receive" || type === "adj-goods-return";

  if (isSalesType) return spP * qtyPrimary + spB * qtyBase;
  if (isGoodsType) return acP * qtyPrimary + acB * qtyBase;
  return 0;
}

function statusPillClass(status) {
  switch (status) {
    case "approved":
      return "status-approved";
    case "cancelled":
      return "status-cancelled";
    case "draft":
    case "waiting_for_approval":
    default:
      return "status-pending";
  }
}

const StockAdjustmentCreateModal = ({
  show,
  mode = "create",
  selectedAdjustment,
  onClose,
  onSuccess,
  actorType: actorTypeProp,
  salesRepId: salesRepIdProp,
}) => {
  const isView = mode === "view";
  const isCreate = mode === "create";
  const isEdit = mode === "edit";

  // --------------------------------------------------
  // RBAC
  // --------------------------------------------------
  const authUserLocal = useMemo(() => readAuthUser(), []);
  const authCtx = (() => {
    try {
      return useAuth?.() || {};
    } catch {
      return {};
    }
  })();

  const user = authCtx?.user || authUserLocal;

  const actorType = actorTypeProp || user?.actorType || null;
  const role = user?.role || null;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  const isSalesRepActor =
    actorType === "SalesRep" ||
    role === "SalesRep" ||
    String(actorType || "").toLowerCase().includes("salesrep");

  const loggedInSalesRepId =
    salesRepIdProp ||
    user?.id ||
    user?._id ||
    user?.actorId ||
    user?.salesRepId ||
    user?.salesRep?._id ||
    user?.salesRep ||
    (isSalesRepActor ? user?._id : null) ||
    null;

  const loggedInSalesRepLabel =
    user?.name || user?.fullName || user?.email || "Sales Rep";

  // View access check (sales rep can only view/edit own adjustment)
  const adjSalesRepId =
    selectedAdjustment?.salesRep?._id || selectedAdjustment?.salesRep || "";
  const hasAccess =
    !isSalesRepActor ||
    !loggedInSalesRepId ||
    String(adjSalesRepId) === String(loggedInSalesRepId);

  // --------------------------------------------------
  // State
  // --------------------------------------------------
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [ledgerItems, setLedgerItems] = useState([]);
  const [totalValue, setTotalValue] = useState(0);

  const [form, setForm] = useState({
    adjustmentNo: generateAdjustmentNo(),
    branch: "",
    salesRep: "",
    type: "",
    adjustmentDate: new Date().toISOString().split("T")[0],
    items: [{ ...EMPTY_ROW }],
    remarks: "",
  });

  const isSalesType =
    form.type === "adj-sale" || form.type === "adj-sales-return";
  const isGoodsType =
    form.type === "adj-goods-receive" || form.type === "adj-goods-return";

  const canLoadLedger = Boolean(
    form.branch && (isSalesRepActor ? true : form.salesRep)
  );

  // --------------------------------------------------
  // Reset on open
  // --------------------------------------------------
  useEffect(() => {
    if (!show) return;

    if (isCreate) {
      setForm({
        adjustmentNo: generateAdjustmentNo(),
        branch: "",
        salesRep: isSalesRepActor ? loggedInSalesRepId || "" : "",
        type: "",
        adjustmentDate: new Date().toISOString().split("T")[0],
        items: [{ ...EMPTY_ROW }],
        remarks: "",
      });

      setLedgerItems([]);
      setTotalValue(0);
    }
  }, [show, isCreate, isSalesRepActor, loggedInSalesRepId]);

  // Keep SalesRep auto-bound
  useEffect(() => {
    if (!show) return;
    if (!(isCreate || isEdit)) return;
    if (isSalesRepActor && loggedInSalesRepId) {
      setForm((p) => ({ ...p, salesRep: loggedInSalesRepId }));
    }
  }, [show, isCreate, isEdit, isSalesRepActor, loggedInSalesRepId]);

  // --------------------------------------------------
  // Load branches / sales reps
  // --------------------------------------------------
  useEffect(() => {
    if (!show) return;

    (async () => {
      setLoading(true);
      try {
        const br = await listBranches();
        setBranches(br?.data || br || []);
      } catch {
        toast.error("Failed to load branches");
      } finally {
        setLoading(false);
      }
    })();
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (!isAdminOrDataEntry) {
      setSalesReps([]);
      return;
    }

    (async () => {
      try {
        const reps = await getSalesReps();
        const list = reps?.data || reps || [];
        setSalesReps(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("❌ Failed to load sales reps:", err);
        toast.error("Failed to load sales reps");
        setSalesReps([]);
      }
    })();
  }, [show, isAdminOrDataEntry]);

  // --------------------------------------------------
  // Load stock ledger items by scope
  // --------------------------------------------------
  useEffect(() => {
    if (!form.branch) {
      setLedgerItems([]);
      return;
    }

    if (!isSalesRepActor && !form.salesRep) {
      setLedgerItems([]);
      return;
    }

    (async () => {
      try {
        const res = await getStockLedger({
          branch: form.branch,
          ...(isSalesRepActor ? {} : { salesRep: form.salesRep }),
        });
        setLedgerItems(res?.data || res || []);
      } catch {
        toast.error("Failed to load stock items");
        setLedgerItems([]);
      }
    })();
  }, [form.branch, form.salesRep, isSalesRepActor]);

  // --------------------------------------------------
  // Total value recalc
  // --------------------------------------------------
  useEffect(() => {
    const total = (form.items || []).reduce(
      (sum, i) => sum + Number(i.itemTotalValue || 0),
      0
    );
    setTotalValue(total);
  }, [form.items]);

  // --------------------------------------------------
  // Populate for view/edit
  // --------------------------------------------------
  useEffect(() => {
    if (!(isView || isEdit) || !selectedAdjustment) return;

    setForm({
      adjustmentNo: selectedAdjustment.adjustmentNo || "",
      branch: selectedAdjustment.branch?._id || selectedAdjustment.branch || "",
      salesRep:
        selectedAdjustment.salesRep?._id || selectedAdjustment.salesRep || "",
      type: selectedAdjustment.type || "",
      adjustmentDate: selectedAdjustment.adjustmentDate?.split("T")[0] || "",
      remarks: selectedAdjustment.remarks || "",
      items:
        (selectedAdjustment.items || []).map((i) => ({
          item: i.item?._id || i.item || "",
          primaryQty: i.primaryQty ?? 0,
          baseQty: i.baseQty ?? 0,
          avgCostBase: i.avgCostBase !== undefined ? i.avgCostBase : null,
          sellingPriceBase:
            i.sellingPriceBase !== undefined ? i.sellingPriceBase : null,
          avgCostPrimary: i.avgCostPrimary !== undefined ? i.avgCostPrimary : null,
          sellingPricePrimary:
            i.sellingPricePrimary !== undefined ? i.sellingPricePrimary : null,
          itemTotalValue: Number(i.itemTotalValue || 0),
        })) || [{ ...EMPTY_ROW }],
    });

    setTotalValue(Number(selectedAdjustment.totalValue || 0));
  }, [isView, isEdit, selectedAdjustment]);

  // --------------------------------------------------
  // Access denied
  // --------------------------------------------------
  if ((isView || isEdit) && show && selectedAdjustment && !hasAccess) {
    return (
      <Modal show={show} onHide={onClose} size="lg" centered backdrop="static">
        <Modal.Header closeButton>
          <h5 className="mb-0">Access denied</h5>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted">
            You don’t have permission to access this stock adjustment.
          </div>
          <div className="text-end mt-4">
            <Button className="action-btn-modal" onClick={onClose}>
              Close
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  // --------------------------------------------------
  // Row actions
  // --------------------------------------------------
  const addItem = () =>
    setForm((p) => ({
      ...p,
      items: [...p.items, { ...EMPTY_ROW }],
    }));

  const removeItem = (idx) => {
    if (form.items.length === 1) return;
    const next = [...form.items];
    next.splice(idx, 1);
    setForm((p) => ({ ...p, items: next }));
  };

  const recalcItem = (rowIndex, field, value) => {
    const updated = [...form.items];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    updated[rowIndex].itemTotalValue = recalcLineTotalByType(updated[rowIndex], form.type);
    setForm((p) => ({ ...p, items: updated }));
  };

  const handleSelectItem = (rowIndex, itemId) => {
    const updated = [...form.items];
    const sel = ledgerItems.find((it) => String(it.itemId) === String(itemId));
    const current = { ...updated[rowIndex] };

    current.item = itemId || "";

    if (isGoodsType) {
      current.avgCostBase = sel?.avgCostBase ?? null;
      current.avgCostPrimary = sel?.avgCostPrimary ?? null;
      // clear sales prices to avoid mixed mode confusion
      current.sellingPriceBase = null;
      current.sellingPricePrimary = null;
    }

    if (isSalesType) {
      current.sellingPriceBase = sel?.sellingPriceBase ?? null;
      current.sellingPricePrimary = sel?.sellingPricePrimary ?? null;
      // clear avg costs to avoid mixed mode confusion
      current.avgCostBase = null;
      current.avgCostPrimary = null;
    }

    current.primaryQty = 0;
    current.baseQty = 0;
    current.itemTotalValue = recalcLineTotalByType(current, form.type);

    updated[rowIndex] = current;
    setForm((p) => ({ ...p, items: updated }));
  };

  // --------------------------------------------------
  // Submit
  // --------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return onClose?.();

    if (!form.branch) return toast.warning("Select branch");
    if (!form.type) return toast.warning("Select adjustment type");

    if (!isSalesRepActor && !form.salesRep) {
      return toast.warning("Sales Rep is required for Stock Adjustments");
    }

    if (!form.items.length) {
      return toast.warning("Add at least one item");
    }

    const hasInvalidRow = form.items.some((i) => {
      const p = Number(i.primaryQty ?? 0);
      const b = Number(i.baseQty ?? 0);

      if (!i.item) return true;
      if (p <= 0 && b <= 0) return true;

      return false;
    });

    if (hasInvalidRow) {
      return toast.warning("Each row must have an item + Primary or Base qty (> 0)");
    }

    // Optional validation: for entered qty, matching price/cost must exist
    const hasMissingRate = form.items.some((i) => {
      const p = Number(i.primaryQty ?? 0);
      const b = Number(i.baseQty ?? 0);

      if (isSalesType) {
        if (p > 0 && Number(i.sellingPricePrimary ?? 0) <= 0) return true;
        if (b > 0 && Number(i.sellingPriceBase ?? 0) <= 0) return true;
      }

      if (isGoodsType) {
        if (p > 0 && Number(i.avgCostPrimary ?? 0) <= 0) return true;
        if (b > 0 && Number(i.avgCostBase ?? 0) <= 0) return true;
      }

      return false;
    });

    if (hasMissingRate) {
      return toast.warning(
        isSalesType
          ? "Entered quantities require valid selling prices."
          : "Entered quantities require valid average costs."
      );
    }

    try {
      setLoading(true);

      const payload = {
        adjustmentNo: form.adjustmentNo,
        branch: form.branch,
        type: form.type,
        adjustmentDate: form.adjustmentDate,
        remarks: form.remarks,
        items: form.items.map((i) => ({
          item: i.item,
          primaryQty: Number(i.primaryQty ?? 0),
          baseQty: Number(i.baseQty ?? 0),
          avgCostBase: i.avgCostBase !== null ? Number(i.avgCostBase) : null,
          sellingPriceBase:
            i.sellingPriceBase !== null ? Number(i.sellingPriceBase) : null,
          avgCostPrimary:
            i.avgCostPrimary !== null ? Number(i.avgCostPrimary) : null,
          sellingPricePrimary:
            i.sellingPricePrimary !== null ? Number(i.sellingPricePrimary) : null,
          itemTotalValue: Number(i.itemTotalValue || 0),
        })),
        totalValue: Number(totalValue || 0),
        ...(isAdminOrDataEntry ? { salesRep: form.salesRep } : {}),
      };

      if (isCreate) {
        const res = await createAdjustment(payload);
        toast.success(`Adjustment ${res?.adjustmentNo || form.adjustmentNo} created`);
      } else if (isEdit && selectedAdjustment?._id) {
        const res = await updateAdjustment(selectedAdjustment._id, payload);
        toast.success(`Adjustment ${res?.adjustmentNo || form.adjustmentNo} updated`);
      }

      onClose?.();
      onSuccess?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save Stock Adjustment");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Select styling
  // --------------------------------------------------
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: "#fff",
      borderColor: state.isFocused ? "#5c3e94" : "#d1d5db",
      minHeight: "48px",
      boxShadow: state.isFocused ? "0 0 0 1px #5c3e94" : "none",
      "&:hover": { borderColor: "#5c3e94" },
    }),
    singleValue: (b) => ({ ...b, color: "#374151" }),
    menu: (b) => ({ ...b, zIndex: 9999 }),
  };

  // --------------------------------------------------
  // Sales Rep select configs
  // --------------------------------------------------
  const salesRepOptions = useMemo(
    () =>
      (salesReps || []).map((sr) => ({
        label: `${sr.repCode ? `${sr.repCode} — ` : ""}${
          sr.name || sr.fullName || sr.email || "Sales Rep"
        }`,
        value: sr._id,
      })),
    [salesReps]
  );

  const selectedSalesRepOptionAdmin = useMemo(() => {
    if (!form.salesRep) return null;
    return (
      salesRepOptions.find((o) => String(o.value) === String(form.salesRep)) || null
    );
  }, [form.salesRep, salesRepOptions]);

  const salesRepSelfOption = useMemo(() => {
    if (!loggedInSalesRepId) return null;
    return { label: loggedInSalesRepLabel, value: loggedInSalesRepId };
  }, [loggedInSalesRepId, loggedInSalesRepLabel]);

  const salesRepSelectOptions = useMemo(() => {
    if (isAdminOrDataEntry) return salesRepOptions;
    if (isSalesRepActor && salesRepSelfOption) return [salesRepSelfOption];
    return [];
  }, [isAdminOrDataEntry, isSalesRepActor, salesRepOptions, salesRepSelfOption]);

  const salesRepSelectValue = useMemo(() => {
    if (!form.salesRep) return null;
    if (isAdminOrDataEntry) return selectedSalesRepOptionAdmin;
    return {
      label: salesRepSelfOption?.label || "Sales Rep",
      value: form.salesRep,
    };
  }, [
    form.salesRep,
    isAdminOrDataEntry,
    selectedSalesRepOptionAdmin,
    salesRepSelfOption,
  ]);

  // --------------------------------------------------
  // Branch / type / stats derived
  // --------------------------------------------------
  const selectedBranch = branches.find((b) => String(b._id) === String(form.branch));
  const selectedTypeLabel = ADJ_TYPE_LABEL_MAP[form.type] || "-";

  const rowStats = useMemo(() => {
    const rows = form.items || [];
    const filled = rows.filter((r) => !!r.item).length;
    const qtyRows = rows.filter(
      (r) => Number(r.primaryQty || 0) > 0 || Number(r.baseQty || 0) > 0
    ).length;
    const totalPrimary = rows.reduce((s, r) => s + Number(r.primaryQty || 0), 0);
    const totalBase = rows.reduce((s, r) => s + Number(r.baseQty || 0), 0);

    return { total: rows.length, filled, qtyRows, totalPrimary, totalBase };
  }, [form.items]);

  return (
    <>
      <style>{`
        .stock-adjustment-modal {
          max-width: 96vw !important;
          width: 96vw;
        }

        .stock-adjustment-modal .modal-dialog {
          max-width: 96vw !important;
          width: 96vw !important;
        }

        .stock-adjustment-modal .modal-content {
          height: 92vh;
          border-radius: 14px;
          overflow: hidden;
        }

        .stock-adjustment-modal .modal-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
        }

        .stock-adjustment-modal .modal-body {
          overflow-y: auto;
          background: #f8fafc;
        }

        .sa-sticky-footer {
          position: sticky;
          bottom: 0;
          background: #fff;
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
          margin-top: 14px;
          z-index: 10;
        }

        .sa-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .sa-stat-card {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        .sa-stat-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 2px;
        }

        .sa-stat-value {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }

        .sa-table-wrap {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: auto;
          background: #fff;
          max-height: 52vh;
        }

        .sa-table-wrap .modern-table-modal {
          margin-bottom: 0;
          min-width: 1150px;
        }

        .sa-table-wrap thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }

        .sa-item-meta {
          display: block;
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }

        @media (max-width: 992px) {
          .sa-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <Modal
        show={show}
        onHide={onClose}
        size="xl"
        centered
        backdrop="static"
        dialogClassName="stock-adjustment-modal"
      >
        <Modal.Header closeButton>
          <div className="d-flex justify-content-between w-100 align-items-start">
            <div>
              <h2 className="page-title-modal mb-0">
                {isView
                  ? "View Stock Adjustment"
                  : isEdit
                  ? "Edit Stock Adjustment"
                  : "Create Stock Adjustment"}
              </h2>
              <p className="page-subtitle-modal mb-0">
                {isView
                  ? "Detailed view of this adjustment."
                  : isEdit
                  ? "Modify the stock adjustment."
                  : "Record changes to branch stock."}
              </p>
            </div>

            <div className="text-end me-4">
              <small className="d-block fw-semibold">ADJ No: {form.adjustmentNo}</small>
              {!!form.adjustmentDate && (
                <small className="text-muted d-block">
                  {formatDate(form.adjustmentDate)}
                </small>
              )}
              {(isView || isEdit) && selectedAdjustment?.status && (
                <small className="d-block mt-1">
                  <span
                    className={`status-pill ${statusPillClass(
                      selectedAdjustment.status
                    )}`}
                  >
                    {String(selectedAdjustment.status).replaceAll("_", " ")}
                  </span>
                </small>
              )}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body>
          <div className="card-container-modal">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                {/* Branch */}
                <div className="col-md-6">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView}
                      options={branches.map((b) => ({
                        label: b.name,
                        value: b._id,
                      }))}
                      value={
                        form.branch
                          ? {
                              label: selectedBranch?.name || "",
                              value: form.branch,
                            }
                          : null
                      }
                      onChange={(opt) =>
                        setForm((p) => ({
                          ...p,
                          branch: opt?.value || "",
                          items: [{ ...EMPTY_ROW }],
                        }))
                      }
                      styles={selectStyles}
                      placeholder=""
                    />
                    <label>Branch</label>
                  </div>
                </div>

                {/* Sales Rep */}
                {(isAdminOrDataEntry || isSalesRepActor) && (
                  <div className="col-md-6">
                    <div className="form-floating react-select-floating">
                      <Select
                        classNamePrefix="react-select"
                        isDisabled={isView || isSalesRepActor}
                        isClearable={!isSalesRepActor && !isView}
                        options={salesRepSelectOptions}
                        value={salesRepSelectValue}
                        onChange={(opt) => {
                          const srId = opt?.value || "";
                          setForm((p) => ({
                            ...p,
                            salesRep: srId,
                            items: [{ ...EMPTY_ROW }],
                          }));
                          setLedgerItems([]);
                        }}
                        styles={selectStyles}
                        placeholder=""
                      />
                      <label>Sales Rep</label>

                      <small className="text-muted d-block">
                        {isSalesRepActor
                          ? "Auto-filled from your account."
                          : "Select a Sales Rep."}
                      </small>

                      {isAdminOrDataEntry && !form.salesRep && (
                        <small className="text-muted d-block">
                          Required: stock ledger is tracked by Sales Rep.
                        </small>
                      )}
                    </div>
                  </div>
                )}

                {/* Adjustment Type */}
                <div className="col-md-6">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView}
                      options={ADJUSTMENT_TYPE_OPTIONS}
                      value={
                        form.type
                          ? {
                              label: ADJ_TYPE_LABEL_MAP[form.type],
                              value: form.type,
                            }
                          : null
                      }
                      onChange={(opt) => {
                        const newType = opt?.value || "";

                        const nextRows = (form.items || []).map((it) => {
                          const next = { ...it };

                          if (newType.startsWith("adj-sale")) {
                            next.avgCostBase = null;
                            next.avgCostPrimary = null;
                          }

                          if (newType.startsWith("adj-goods")) {
                            next.sellingPriceBase = null;
                            next.sellingPricePrimary = null;
                          }

                          next.itemTotalValue = recalcLineTotalByType(next, newType);
                          return next;
                        });

                        setForm((p) => ({ ...p, type: newType, items: nextRows }));
                      }}
                      styles={selectStyles}
                      placeholder=""
                    />
                    <label>Adjustment Type</label>
                  </div>
                </div>

                {/* Date */}
                <div className="col-md-6">
                  <div className="form-floating">
                    <input
                      type="date"
                      className="form-control"
                      id="adjustmentDateInput"
                      value={form.adjustmentDate || ""}
                      readOnly={isView}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          adjustmentDate: e.target.value,
                        }))
                      }
                    />
                    <label htmlFor="adjustmentDateInput">Date</label>
                  </div>
                </div>

                {/* Remarks */}
                <div className="col-md-12">
                  <div className="form-floating">
                    <input
                      className="form-control"
                      type="text"
                      value={form.remarks || ""}
                      readOnly={isView}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          remarks: e.target.value,
                        }))
                      }
                    />
                    <label>Remarks</label>
                  </div>
                </div>

                {/* Scope summary / stats */}
                <div className="col-12 mt-1">
                  <div className="sa-stats-grid">
                    <div className="sa-stat-card">
                      <div className="sa-stat-label">Branch</div>
                      <div className="sa-stat-value" style={{ fontSize: 14 }}>
                        {selectedBranch?.name || "-"}
                      </div>
                    </div>

                    <div className="sa-stat-card">
                      <div className="sa-stat-label">Type</div>
                      <div className="sa-stat-value" style={{ fontSize: 14 }}>
                        {selectedTypeLabel}
                      </div>
                    </div>

                    <div className="sa-stat-card">
                      <div className="sa-stat-label">Rows with Qty</div>
                      <div className="sa-stat-value">
                        {rowStats.qtyRows}/{rowStats.total}
                      </div>
                    </div>

                    <div className="sa-stat-card">
                      <div className="sa-stat-label">Total</div>
                      <div className="sa-stat-value">{formatCurrency(totalValue)}</div>
                    </div>
                  </div>

                  {!canLoadLedger && !isView && (
                    <small className="text-muted d-block mb-2">
                      Select Branch
                      {!isSalesRepActor ? " and Sales Rep" : ""}
                      {" "}to load stock ledger items.
                    </small>
                  )}
                </div>

                {/* Items Table */}
                <div className="col-12 mt-0">
                  <div className="sa-table-wrap">
                    <table className="modern-table-modal">
                      <thead>
                        <tr>
                          <th style={{ width: "28%" }}>Item</th>
                          <th className="text-end">Primary Qty</th>
                          {isGoodsType && <th className="text-end">Avg Cost Primary</th>}
                          {isSalesType && <th className="text-end">Selling Price Primary</th>}
                          <th className="text-end">Base Qty</th>
                          {isGoodsType && <th className="text-end">Avg Cost Base</th>}
                          {isSalesType && <th className="text-end">Selling Price Base</th>}
                          <th className="text-end">Line Total</th>
                          {!isView && <th style={{ width: 52 }}></th>}
                        </tr>
                      </thead>

                      <tbody>
                        {(form.items || []).map((row, i) => {
                          const selectedLedgerItem = ledgerItems.find(
                            (it) => String(it.itemId) === String(row.item)
                          );

                          const rowHasBase = hasBaseUnit(row);
                          const noTypeSelected = !form.type;

                          return (
                            <tr key={i}>
                              <td>
                                <Select
                                  classNamePrefix="react-select"
                                  isDisabled={
                                    isView ||
                                    (isAdminOrDataEntry && !form.salesRep) ||
                                    !form.branch
                                  }
                                  options={ledgerItems.map((it) => ({
                                    label: getItemOptionLabel(it),
                                    value: it.itemId,
                                  }))}
                                  value={
                                    row.item
                                      ? {
                                          label:
                                            getItemOptionLabel(selectedLedgerItem) ||
                                            ledgerItems.find(
                                              (it) => String(it.itemId) === String(row.item)
                                            )?.itemName ||
                                            "",
                                          value: row.item,
                                        }
                                      : null
                                  }
                                  onChange={(opt) => handleSelectItem(i, opt?.value || "")}
                                  styles={selectStyles}
                                  placeholder={
                                    !form.branch
                                      ? "Select Branch first"
                                      : isAdminOrDataEntry && !form.salesRep
                                      ? "Select Sales Rep first"
                                      : "Select Item"
                                  }
                                />

                                {selectedLedgerItem && (
                                  <small className="sa-item-meta">
                                    {selectedLedgerItem.branchName
                                      ? `Branch: ${selectedLedgerItem.branchName}`
                                      : ""}
                                    {selectedLedgerItem.salesRepName
                                      ? ` • Rep: ${selectedLedgerItem.salesRepName}`
                                      : ""}
                                  </small>
                                )}
                              </td>

                              {/* Primary Qty */}
                              <td>
                                <input
                                  type="number"
                                  className="form-control text-end"
                                  value={row.primaryQty ?? 0}
                                  readOnly={isView}
                                  min={0}
                                  onChange={(e) =>
                                    recalcItem(
                                      i,
                                      "primaryQty",
                                      Math.max(0, Number(e.target.value || 0))
                                    )
                                  }
                                  disabled={isView || noTypeSelected}
                                />
                              </td>

                              {/* Avg Cost Primary */}
                              {isGoodsType && (
                                <td>
                                  <input
                                    type="number"
                                    className="form-control text-end"
                                    value={row.avgCostPrimary ?? ""}
                                    readOnly={isView}
                                    min={0}
                                    onChange={(e) =>
                                      recalcItem(
                                        i,
                                        "avgCostPrimary",
                                        e.target.value === ""
                                          ? null
                                          : Math.max(0, Number(e.target.value))
                                      )
                                    }
                                    disabled={isView}
                                  />
                                </td>
                              )}

                              {/* Selling Price Primary */}
                              {isSalesType && (
                                <td>
                                  <input
                                    type="number"
                                    className="form-control text-end"
                                    value={row.sellingPricePrimary ?? ""}
                                    readOnly={isView}
                                    min={0}
                                    onChange={(e) =>
                                      recalcItem(
                                        i,
                                        "sellingPricePrimary",
                                        e.target.value === ""
                                          ? null
                                          : Math.max(0, Number(e.target.value))
                                      )
                                    }
                                    disabled={isView}
                                  />
                                </td>
                              )}

                              {/* Base Qty */}
                              <td>
                                <input
                                  type="number"
                                  className="form-control text-end"
                                  value={row.baseQty ?? 0}
                                  readOnly={isView}
                                  min={0}
                                  onChange={(e) =>
                                    recalcItem(
                                      i,
                                      "baseQty",
                                      Math.max(0, Number(e.target.value || 0))
                                    )
                                  }
                                  disabled={isView || !rowHasBase || noTypeSelected}
                                />
                              </td>

                              {/* Avg Cost Base */}
                              {isGoodsType && (
                                <td>
                                  <input
                                    type="number"
                                    className="form-control text-end"
                                    value={row.avgCostBase ?? ""}
                                    readOnly={isView}
                                    min={0}
                                    onChange={(e) =>
                                      recalcItem(
                                        i,
                                        "avgCostBase",
                                        e.target.value === ""
                                          ? null
                                          : Math.max(0, Number(e.target.value))
                                      )
                                    }
                                    disabled={isView || row.avgCostBase == null}
                                  />
                                </td>
                              )}

                              {/* Selling Price Base */}
                              {isSalesType && (
                                <td>
                                  <input
                                    type="number"
                                    className="form-control text-end"
                                    value={row.sellingPriceBase ?? ""}
                                    readOnly={isView}
                                    min={0}
                                    onChange={(e) =>
                                      recalcItem(
                                        i,
                                        "sellingPriceBase",
                                        e.target.value === ""
                                          ? null
                                          : Math.max(0, Number(e.target.value))
                                      )
                                    }
                                    disabled={isView || row.sellingPriceBase == null}
                                  />
                                </td>
                              )}

                              {/* Line Total */}
                              <td className="text-end fw-semibold">
                                {formatCurrency(row.itemTotalValue)}
                              </td>

                              {/* Add / Remove */}
                              {!isView && (
                                <td className="text-center">
                                  {i === form.items.length - 1 ? (
                                    <i
                                      className="bi bi-plus-circle text-success fs-5"
                                      role="button"
                                      title="Add row"
                                      onClick={addItem}
                                    />
                                  ) : (
                                    <i
                                      className="bi bi-dash-circle text-danger fs-5"
                                      role="button"
                                      title="Remove row"
                                      onClick={() => removeItem(i)}
                                    />
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <h5 className="text-end text-info mt-3 mb-0">
                    Total: {formatCurrency(totalValue)}
                  </h5>
                </div>
              </div>

              {/* Footer */}
              <div className="col-12 text-end sa-sticky-footer">
                {isView ? (
                  <Button type="button" className="action-btn-modal" onClick={onClose}>
                    Close
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="action-btn-modal"
                    disabled={loading}
                  >
                    {loading
                      ? isEdit
                        ? "Updating..."
                        : "Saving..."
                      : isEdit
                      ? "Update Adjustment"
                      : "Create Adjustment"}
                  </Button>
                )}
              </div>
            </form>
          </div>

          <ToastContainer position="top-right" autoClose={2000} />
        </Modal.Body>
      </Modal>
    </>
  );
};

export default StockAdjustmentCreateModal;