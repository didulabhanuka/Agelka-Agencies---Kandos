// src/pages/transactions/GRNCreateModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { getItemsBySupplier } from "../../../lib/api/inventory.api";
import { listBranches } from "../../../lib/api/settings.api";
import { createGRN, updateGRN } from "../../../lib/api/purchases.api";
import { getSuppliers, getSalesReps } from "../../../lib/api/users.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

import { PDFDownloadLink } from "@react-pdf/renderer";
import GRNPDF from "../../../components/pdf/GRNPDF";

function generateGRNNo() {
  const now = new Date();
  return `GRN-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}-${Math.floor(
    10000 + Math.random() * 90000
  )}`;
}

// Fresh empty line item
const buildEmptyRow = () => ({
  item: "",
  primaryQty: 0,
  baseQty: 0,
  factorToBase: 1,
  avgCostBase: 0,
  avgCostPrimary: 0,
  discountPerUnit: 0,
  lineTotal: 0,
});

// Fresh empty form
const buildEmptyForm = () => ({
  grnNo: generateGRNNo(),
  branch: "",
  supplier: "",
  salesRep: "",
  supplierInvoiceNo: "",
  supplierInvoiceDate: "",
  receivedDate: new Date().toISOString().split("T")[0],
  items: [buildEmptyRow()],
});

const GRNCreateModal = ({
  show,
  mode = "create",
  selectedGRN,
  onClose,
  onSuccess,
}) => {
  // Mode flags
  const isView = mode === "view";
  const isCreate = mode === "create";
  const isEdit = mode === "edit";

  // Auth / RBAC
  const { user } = useAuth();
  const actorType = user?.actorType;
  const role = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  const isSalesRep = actorType === "SalesRep";

  const loggedInSalesRepId =
    user?.id ||
    user?._id ||
    user?.salesRep?._id ||
    user?.salesRepId ||
    user?.actorId ||
    "";

  // State
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [items, setItems] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [form, setForm] = useState(buildEmptyForm);
  const [hoveredRowIndex, setHoveredRowIndex] = useState(null);

  // Helpers
  const computeLineTotal = (row) => {
    const baseQty = Number(row.baseQty) || 0;
    const primaryQty = Number(row.primaryQty) || 0;
    const avgBase = Number(row.avgCostBase) || 0;
    const avgPrimary = Number(row.avgCostPrimary) || 0;
    const discount = Number(row.discountPerUnit) || 0;
    return baseQty * avgBase + primaryQty * avgPrimary - discount;
  };

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    return `Rs. ${new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)}`;
  };

  const formatDateText = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => String(s._id) === String(form.supplier)),
    [suppliers, form.supplier]
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b._id) === String(form.branch)),
    [branches, form.branch]
  );

  const selectedSupplierLabel = selectedSupplier?.name || "Not selected";
  const selectedBranchLabel = selectedBranch?.name || "-";

  const modeLabel = isView ? "View" : isEdit ? "Edit" : "Create";

  // Optional selected GRN status badge (if available)
  const currentStatus = selectedGRN?.status || (isCreate ? "draft" : "");
  const statusLabel =
    currentStatus === "waiting_for_approval"
      ? "Waiting for Approval"
      : currentStatus === "approved"
      ? "Approved"
      : currentStatus === "cancelled"
      ? "Cancelled"
      : currentStatus === "draft"
      ? "Draft"
      : currentStatus || "-";

  // Count rows with item selected
  const selectedRowCount = useMemo(
    () => (form.items || []).filter((r) => r.item).length,
    [form.items]
  );

  // Load base dropdown data
  useEffect(() => {
    if (!show) return;

    (async () => {
      try {
        setLoading(true);

        const [brRes, supRes, salesRes] = await Promise.all([
          listBranches(),
          getSuppliers(),
          isAdminOrDataEntry || isSalesRep ? getSalesReps() : Promise.resolve([]),
        ]);

        setBranches(brRes?.data || brRes || []);
        setSuppliers(supRes || []);
        setSalesReps(salesRes?.data || salesRes || []);
      } catch (err) {
        console.error("Failed to load initial GRN data:", err);
        toast.error("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    })();
  }, [show, isAdminOrDataEntry, isSalesRep]);

  // Reset create mode
  useEffect(() => {
    if (!show) return;

    if (isCreate) {
      setForm({
        ...buildEmptyForm(),
        salesRep: isSalesRep ? loggedInSalesRepId : "",
      });
      setTotalValue(0);
      setItems([]);
      setHoveredRowIndex(null);
    }
  }, [show, isCreate, isSalesRep, loggedInSalesRepId]);

  // Force sales rep for SalesRep actor
  useEffect(() => {
    if (!show) return;
    if (isSalesRep && loggedInSalesRepId) {
      setForm((prev) => ({ ...prev, salesRep: loggedInSalesRepId }));
    }
  }, [show, isSalesRep, loggedInSalesRepId]);

  // Load supplier items
  useEffect(() => {
    if (!form.supplier) {
      setItems([]);
      return;
    }

    (async () => {
      try {
        const res = await getItemsBySupplier(form.supplier);
        setItems(res || []);
        if (!isView) toast.info("Item list refreshed for selected supplier");
      } catch (err) {
        console.error("Failed to load supplier items:", err);
        toast.error("Failed to load supplier items");
        setItems([]);
      }
    })();
  }, [form.supplier, isView]);

  // Recalculate total
  useEffect(() => {
    const total = (form.items || []).reduce((sum, row) => {
      const lt = Number(row.lineTotal) || computeLineTotal(row);
      return sum + lt;
    }, 0);
    setTotalValue(total);
  }, [form.items]);

  // Populate form for view/edit
  useEffect(() => {
    if (!show) return;
    if (!(isView || isEdit) || !selectedGRN) return;

    const mappedItems = (selectedGRN.items || []).map((i) => {
      const primaryQty = Number(i.primaryQty) || 0;
      const baseQty = Number(i.baseQty) || 0;
      const avgCostBase = Number(i.avgCostBase) || 0;
      const avgCostPrimary = Number(i.avgCostPrimary) || 0;
      const discountPerUnit = Number(i.discountPerUnit || 0);
      const lineTotal =
        baseQty * avgCostBase + primaryQty * avgCostPrimary - discountPerUnit;

      return {
        item: i.item?._id || i.item,
        primaryQty,
        baseQty,
        factorToBase: Number(i.factorToBase) || 1,
        avgCostBase,
        avgCostPrimary,
        discountPerUnit,
        lineTotal,
      };
    });

    setForm({
      grnNo: selectedGRN.grnNo || generateGRNNo(),
      branch: selectedGRN.branch?._id || selectedGRN.branch || "",
      supplier: selectedGRN.supplier?._id || selectedGRN.supplier || "",
      salesRep: selectedGRN.salesRep?._id || selectedGRN.salesRep || "",
      supplierInvoiceNo: selectedGRN.supplierInvoiceNo || "",
      supplierInvoiceDate: selectedGRN.supplierInvoiceDate?.split("T")[0] || "",
      receivedDate:
        selectedGRN.receivedDate?.split("T")[0] ||
        new Date().toISOString().split("T")[0],
      items: mappedItems.length ? mappedItems : [buildEmptyRow()],
    });

    setTotalValue(
      Number(selectedGRN.totalValue) ||
        mappedItems.reduce((sum, row) => sum + (row.lineTotal || 0), 0)
    );
  }, [show, isView, isEdit, selectedGRN]);

  // Generic row updater
  const updateRow = (rowIndex, patch) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      const nextRow = { ...nextItems[rowIndex], ...patch };
      nextRow.lineTotal = computeLineTotal(nextRow);
      nextItems[rowIndex] = nextRow;
      return { ...prev, items: nextItems };
    });
  };

  // Add row
  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, buildEmptyRow()],
    }));
  };

  // Remove row
  const removeItem = (index) => {
    if (form.items.length === 1) return;
    setForm((prev) => {
      const nextItems = [...prev.items];
      nextItems.splice(index, 1);
      return { ...prev, items: nextItems };
    });
  };

  // Duplicate row
  const duplicateItem = (index) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      const source = nextItems[index] || buildEmptyRow();
      const copy = {
        ...source,
        primaryQty: 0,
        baseQty: 0,
        lineTotal: 0,
      };
      nextItems.splice(index + 1, 0, copy);
      return { ...prev, items: nextItems };
    });
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return onClose?.();

    if (!form.branch) return toast.warning("Select branch.");
    if (!form.supplier) return toast.warning("Select supplier.");

    if (isSalesRep && !loggedInSalesRepId) {
      return toast.error("Unable to identify your Sales Rep account. Please re-login.");
    }

    if (isAdminOrDataEntry && !form.salesRep) {
      return toast.warning("Sales Rep is required.");
    }

    if (
      !form.items.length ||
      form.items.some(
        (i) =>
          !i.item ||
          ((Number(i.primaryQty) || 0) <= 0 && (Number(i.baseQty) || 0) <= 0)
      )
    ) {
      return toast.warning("Add at least one valid item (primary or base qty > 0).");
    }

    try {
      setLoading(true);

      const payload = {
        grnNo: form.grnNo,
        branch: form.branch,
        supplier: form.supplier,
        supplierInvoiceNo: form.supplierInvoiceNo || null,
        supplierInvoiceDate: form.supplierInvoiceDate || null,
        receivedDate: form.receivedDate,
        totalValue,
        items: form.items.map((i) => ({
          item: i.item,
          primaryQty: Number(i.primaryQty) || 0,
          baseQty: Number(i.baseQty) || 0,
          avgCostBase: Number(i.avgCostBase) || 0,
          avgCostPrimary: Number(i.avgCostPrimary) || 0,
          factorToBase: Number(i.factorToBase) || 1,
          discountPerUnit:
            i.discountPerUnit === "" || i.discountPerUnit == null
              ? 0
              : Number(i.discountPerUnit || 0),
        })),
        ...(isAdminOrDataEntry ? { salesRep: form.salesRep } : {}),
      };

      if (isEdit) {
        const res = await updateGRN(selectedGRN._id, payload);
        toast.success(`GRN ${res?.grnNo || form.grnNo} updated successfully`);
      } else {
        const res = await createGRN(payload);
        toast.success(`GRN ${res?.grnNo || form.grnNo} created successfully`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error("Failed to save GRN:", err);
      toast.error(err?.response?.data?.message || "Failed to save GRN");
    } finally {
      setLoading(false);
    }
  };

  // Select styles (matching SalesInvoiceCreateModal feel)
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: "#fff",
      borderColor: state.isFocused ? "#5c3e94" : "#d1d5db",
      minHeight: "46px",
      boxShadow: state.isFocused ? "0 0 0 1px #5c3e94" : "none",
      "&:hover": { borderColor: "#5c3e94" },
      borderRadius: 10,
      fontSize: "0.9rem",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      borderRadius: 10,
      overflow: "hidden",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#f3ecff" : "#fff",
      color: "#111827",
      cursor: "pointer",
      fontSize: "0.9rem",
    }),
    singleValue: (b) => ({ ...b, color: "#374151" }),
  };

  // Dropdown options
  const branchOptions = branches.map((b) => ({ label: b.name, value: b._id }));
  const supplierOptions = suppliers.map((s) => ({ label: s.name, value: s._id }));

  const salesRepOptions = isAdminOrDataEntry
    ? salesReps.map((sr) => ({
        label: sr.name || sr.fullName || sr.email || "Sales Rep",
        value: sr._id,
      }))
    : [
        {
          label: user?.name || "Sales Rep",
          value: loggedInSalesRepId,
        },
      ];

  const selectedSalesRepOption =
    form.salesRep && (isAdminOrDataEntry || isSalesRep)
      ? isAdminOrDataEntry
        ? {
            label:
              salesReps.find((sr) => String(sr._id) === String(form.salesRep))?.name ||
              salesReps.find((sr) => String(sr._id) === String(form.salesRep))?.fullName ||
              salesReps.find((sr) => String(sr._id) === String(form.salesRep))?.email ||
              "",
            value: form.salesRep,
          }
        : { label: user?.name || "Sales Rep", value: form.salesRep }
      : null;

  const modeBadgeClass = isView
    ? "bg-light text-dark border"
    : isEdit
    ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
    : "bg-success-subtle text-success-emphasis border border-success-subtle";

  const statusBadgeClass =
    currentStatus === "approved"
      ? "bg-success-subtle text-success-emphasis border border-success-subtle"
      : currentStatus === "cancelled"
      ? "bg-danger-subtle text-danger-emphasis border border-danger-subtle"
      : "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="grn-create-modal"
    >
      <style>{`
        .grn-create-modal {
          max-width: 96vw !important;
          width: 96vw;
        }
        .grn-create-modal .modal-content {
          height: 92vh;
          border-radius: 16px;
          overflow: hidden;
        }
        .grn-create-modal .modal-header {
          border-bottom: 1px solid #eef0f4;
          padding: 14px 18px;
          background: rgb(25, 25, 25);
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .grn-create-modal .modal-body {
          background: #f8fafc;
          overflow: auto;
          padding: 14px 16px 0 16px;
        }

        .grn-section-card {
          background: #fff;
          border: 1px solid #e9edf3;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
        }
        .grn-section-title {
          font-size: 0.86rem;
          font-weight: 700;
          color: #475467;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .grn-inline-note {
          margin-top: 4px;
          font-size: 11px;
          color: #6b7280;
        }

        .grn-table-wrap {
          border: 1px solid #e9edf3;
          border-radius: 12px;
          overflow: auto;
          max-height: 43vh;
          background: #fff;
        }

        .grn-table {
          width: 100%;
          min-width: 1250px;
          border-collapse: separate;
          border-spacing: 0;
        }

        .grn-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #f8fafc;
          border-bottom: 1px solid #e9edf3;
          color: #475467;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .02em;
          padding: 10px 8px;
          white-space: nowrap;
        }

        .grn-table tbody td {
          border-bottom: 1px solid #f1f3f7;
          padding: 8px;
          vertical-align: top;
          background: #fff;
        }

        .grn-table tbody tr.row-hover td {
          background: #faf7ff;
        }
        .grn-table tbody tr.row-active td {
          background: #f4efff;
        }

        .grn-line-total {
          font-weight: 700;
          color: #1f2937;
          white-space: nowrap;
          text-align: right;
          padding-top: 10px;
        }

        .grn-muted-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          margin-top: 5px;
        }

        .icon-btn-modern {
          border: 1px solid #e5e7eb;
          background: #fff;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all .15s ease;
        }
        .icon-btn-modern:hover {
          transform: translateY(-1px);
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .icon-btn-add {
          color: #15803d;
          border-color: #bbf7d0;
          background: #f0fdf4;
        }
        .icon-btn-copy {
          color: #1d4ed8;
          border-color: #bfdbfe;
          background: #eff6ff;
        }
        .icon-btn-remove {
          color: #b91c1c;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .grn-summary-bar {
          position: sticky;
          bottom: 0;
          z-index: 8;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(6px);
          border: 1px solid #e9edf3;
          border-radius: 12px;
          padding: 10px 12px;
          margin-top: 10px;
        }

        .grn-footer-bar {
          position: sticky;
          bottom: 0;
          z-index: 10;
          background: #fff;
          border-top: 1px solid #eef0f4;
          padding: 12px 16px;
          margin: 0 -16px;
        }

        .grn-na-field {
          background-color: #f3f4f6 !important;
          color: #9ca3af !important;
          border-color: #e5e7eb !important;
          cursor: not-allowed;
        }
          
        .grn-summary-strip {
          border: 1px solid #e9ecef;
          border-radius: 12px;
          background: #fbfcfe;
          padding: 10px 12px;
          margin-bottom: 12px;
        }

        .grn-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .grn-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #475467;
          font-size: 12px;
          font-weight: 600;
        }          
      `}</style>

      <Modal.Header closeButton>
        <div className="d-flex justify-content-between align-items-start w-100 gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <h2 className="page-title-modal mb-0">
                {isView
                  ? "View Goods Received Note"
                  : isEdit
                  ? "Edit Goods Received Note"
                  : "Create Goods Received Note"}
              </h2>

              <span className={`badge rounded-pill ${modeBadgeClass}`}>
                {modeLabel}
              </span>

              {!!currentStatus && !isCreate && (
                <span className={`badge rounded-pill ${statusBadgeClass}`}>
                  {statusLabel}
                </span>
              )}
            </div>

            <p className="page-subtitle-modal mb-0">
              {isView
                ? "View all recorded details of this GRN."
                : isEdit
                ? "Modify and update GRN details before approval."
                : "Record and manage received items."}
            </p>

            {(isView || isEdit) && (
              <div className="small text-muted mt-1">
                {selectedSupplier?.name || selectedGRN?.supplier?.name || "-"} •{" "}
                {selectedBranchLabel !== "-" ? selectedBranchLabel : selectedGRN?.branch?.name || "-"} •{" "}
                {formatDateText(form.receivedDate)}
              </div>
            )}
          </div>

          <div className="text-end me-3">
            <div
              className="px-3 py-2 rounded-3 border"
              style={{ background: "#f8fafc", minWidth: "220px" }}
            >
              <div className="fw-bold text-dark">GRN No</div>
              <div className="small text-muted">{form.grnNo}</div>
            </div>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit}>

        {/* Summary strip */}
        <div className="grn-summary-strip">
          <div className="grn-chip-row">
            <span className="grn-chip">
              <i className="bi bi-upc-scan" />
              GRN: {form.grnNo}
            </span>

            <span className="grn-chip">
              <i className="bi bi-truck" />
              Supplier: {selectedSupplierLabel}
            </span>

            <span className="grn-chip">
              <i className="bi bi-diagram-3" />
              Branch: {selectedBranchLabel}
            </span>

            <span className="grn-chip">
              <i className="bi bi-box-seam" />
              Items: {selectedRowCount}
            </span>

            <span className="grn-chip">
              <i className="bi bi-calendar-event" />
              Received: {formatDateText(form.receivedDate)}
            </span>

            {isSalesRep && (
              <span className="grn-chip">
                <i className="bi bi-lock" />
                Sales Rep auto-filled
              </span>
            )}
          </div>
        </div>       
           
          {!form.supplier && !isView && (
            <div className="alert alert-info py-2 mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle" />
              <span>Select a supplier first to load supplier-specific items.</span>
            </div>
          )}

          {/* Invoice Details section */}
          <div className="grn-section-card mb-3">
            <div className="grn-section-title">
              <i className="bi bi-journal-check" />
              GRN Details
            </div>

            <div className="row g-3">
              {/* Branch */}
              <div className="col-md-4">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    isClearable
                    options={branchOptions}
                    value={
                      form.branch
                        ? {
                            label:
                              branches.find((b) => String(b._id) === String(form.branch))?.name || "",
                            value: form.branch,
                          }
                        : null
                    }
                    onChange={(opt) =>
                      setForm((prev) => ({ ...prev, branch: opt ? opt.value : "" }))
                    }
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder=""
                  />
                  <label>Branch</label>
                </div>
              </div>

              {/* Supplier */}
              <div className="col-md-4">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    isClearable
                    options={supplierOptions}
                    value={
                      form.supplier
                        ? {
                            label:
                              suppliers.find((s) => String(s._id) === String(form.supplier))?.name || "",
                            value: form.supplier,
                          }
                        : null
                    }
                    onChange={(opt) =>
                      setForm((prev) => ({
                        ...prev,
                        supplier: opt ? opt.value : "",
                        items: [buildEmptyRow()],
                      }))
                    }
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder=""
                  />
                  <label>Supplier</label>
                </div>
              </div>

              {/* Sales Rep */}
              {(isAdminOrDataEntry || isSalesRep) && (
                <div className="col-md-4">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView || isSalesRep}
                      isClearable={!isSalesRep}
                      options={salesRepOptions}
                      value={selectedSalesRepOption}
                      onChange={(opt) =>
                        setForm((prev) => ({
                          ...prev,
                          salesRep: opt ? opt.value : "",
                        }))
                      }
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder=""
                    />
                    <label>Sales Rep</label>
                  </div>
                  <small className="text-muted">
                    {isSalesRep ? "Auto-filled from your account." : "Select a Sales Rep."}
                  </small>
                </div>
              )}

              {/* Supplier Invoice No */}
              <div className="col-md-4">
                <div className="form-floating">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Supplier Invoice No"
                    value={form.supplierInvoiceNo}
                    readOnly={isView}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierInvoiceNo: e.target.value,
                      }))
                    }
                  />
                  <label>Supplier Invoice No</label>
                </div>
              </div>

              {/* Supplier Invoice Date */}
              <div className="col-md-4">
                <div className="form-floating">
                  <input
                    type="date"
                    className="form-control"
                    id="supplierInvoiceDateInput"
                    value={form.supplierInvoiceDate}
                    readOnly={isView}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierInvoiceDate: e.target.value,
                      }))
                    }
                  />
                  <label htmlFor="supplierInvoiceDateInput">Supplier Invoice Date</label>
                </div>
              </div>

              {/* Received Date */}
              <div className="col-md-4">
                <div className="form-floating">
                  <input
                    type="date"
                    className="form-control"
                    id="receivedDateInput"
                    value={form.receivedDate}
                    readOnly={isView}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        receivedDate: e.target.value,
                      }))
                    }
                  />
                  <label htmlFor="receivedDateInput">Received Date</label>
                </div>
              </div>
            </div>
          </div>

          {/* Items & Pricing section */}
          <div className="grn-section-card mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="grn-section-title mb-0">
                <i className="bi bi-box-seam" />
                Items & Pricing
              </div>
            </div>

            <div className="grn-table-wrap">
              <table className="grn-table">
                <thead>
                  <tr>
                    <th style={{ width: "28%" }}>Item</th>
                    <th className="text-end" style={{ width: "9%" }}>
                      Primary Qty
                    </th>
                    <th className="text-end" style={{ width: "11%" }}>
                      Cost (Primary)
                    </th>
                    <th className="text-end" style={{ width: "9%" }}>
                      Base Qty
                    </th>
                    <th className="text-end" style={{ width: "11%" }}>
                      Cost (Base)
                    </th>
                    <th className="text-end" style={{ width: "10%" }}>
                      Discount
                    </th>
                    <th className="text-end" style={{ width: "12%" }}>
                      Line Total
                    </th>
                    {!isView && (
                      <th className="text-center" style={{ width: "10%" }}>
                        Action
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {form.items.map((row, i) => {
                    const selectedItem = items.find((it) => String(it._id) === String(row.item));
                    const hasBaseUOM = !!selectedItem?.baseUom;

                    const primaryUom = selectedItem?.primaryUom || "Primary";
                    const baseUom = selectedItem?.baseUom || "Base";
                    const factorToBase = Number(
                      row.factorToBase || selectedItem?.factorToBase || 1
                    );

                    const rowClass = [
                      hoveredRowIndex === i ? "row-hover" : "",
                      !isView && hoveredRowIndex === i ? "row-active" : "",
                    ]
                      .join(" ")
                      .trim();

                    return (
                      <tr
                        key={i}
                        className={rowClass}
                        onMouseEnter={() => setHoveredRowIndex(i)}
                        onMouseLeave={() => setHoveredRowIndex(null)}
                      >
                        <td>
                          <Select
                            isDisabled={isView || !form.supplier}
                            options={items.map((it) => ({
                              label: it.name,
                              value: it._id,
                            }))}
                            value={
                              row.item
                                ? {
                                    label: selectedItem?.name || "",
                                    value: row.item,
                                  }
                                : null
                            }
                            onChange={(opt) => {
                              if (isView) return;
                              const sel = items.find((it) => String(it._id) === String(opt?.value));

                              if (!opt) {
                                updateRow(i, buildEmptyRow());
                                return;
                              }

                              updateRow(i, {
                                item: opt.value,
                                primaryQty: 0,
                                baseQty: 0,
                                avgCostBase: Number(sel?.avgCostBase || 0),
                                avgCostPrimary: Number(sel?.avgCostPrimary || 0),
                                factorToBase: Number(sel?.factorToBase || 1),
                                discountPerUnit: 0,
                              });
                            }}
                            styles={{
                              ...selectStyles,
                              control: (base, state) => ({
                                ...selectStyles.control(base, state),
                                minHeight: "40px",
                                fontSize: "0.85rem",
                              }),
                            }}
                            menuPortalTarget={document.body}
                            placeholder={form.supplier ? "Select Item" : "Select supplier first"}
                          />

                          {selectedItem ? (
                            <div className="grn-inline-note">
                              <div>
                                Primary: <strong>{primaryUom}</strong>
                                {hasBaseUOM ? (
                                  <>
                                    {" "}
                                    • Base: <strong>{baseUom}</strong>
                                  </>
                                ) : (
                                  <> • Single UOM</>
                                )}
                              </div>
                              {hasBaseUOM && (
                                <div>
                                  1 {primaryUom} = {factorToBase} {baseUom}
                                </div>
                              )}
                            </div>
                          ) : null}

                          {row.item && !hasBaseUOM && (
                            <div className="grn-muted-chip">
                              <i className="bi bi-info-circle" />
                              Primary-only item
                            </div>
                          )}
                        </td>

                        {/* Primary Qty */}
                        <td>
                          <input
                            type="number"
                            className="form-control text-end"
                            value={row.primaryQty === 0 ? "" : row.primaryQty}
                            readOnly={isView}
                            placeholder="Qty"
                            onChange={(e) =>
                              updateRow(i, {
                                primaryQty:
                                  e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                          />
                        </td>

                        {/* Cost Primary */}
                        <td>
                          <input
                            type="number"
                            className="form-control text-end"
                            value={
                              row.avgCostPrimary === 0 ||
                              row.avgCostPrimary === "" ||
                              row.avgCostPrimary == null
                                ? ""
                                : row.avgCostPrimary
                            }
                            readOnly={isView}
                            placeholder="Cost"
                            onChange={(e) =>
                              updateRow(i, {
                                avgCostPrimary:
                                  e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                          />
                        </td>

                        {/* Base Qty */}
                        <td>
                          <input
                            type="number"
                            className={`form-control text-end ${!hasBaseUOM ? "grn-na-field" : ""}`}
                            value={
                              !hasBaseUOM
                                ? ""
                                : row.baseQty === 0 || row.baseQty === "" || row.baseQty == null
                                ? ""
                                : row.baseQty
                            }
                            readOnly={isView || !hasBaseUOM}
                            disabled={isView || !hasBaseUOM}
                            placeholder={hasBaseUOM ? "Qty" : "N/A"}
                            onChange={(e) => {
                              if (!hasBaseUOM) return;
                              updateRow(i, {
                                baseQty: e.target.value === "" ? "" : Number(e.target.value),
                              });
                            }}
                          />
                        </td>

                        {/* Cost Base */}
                        <td>
                          <input
                            type="number"
                            className={`form-control text-end ${!hasBaseUOM ? "grn-na-field" : ""}`}
                            value={
                              !hasBaseUOM
                                ? ""
                                : row.avgCostBase === 0 ||
                                  row.avgCostBase === "" ||
                                  row.avgCostBase == null
                                ? ""
                                : row.avgCostBase
                            }
                            readOnly={isView || !hasBaseUOM}
                            disabled={isView || !hasBaseUOM}
                            placeholder={hasBaseUOM ? "Cost" : "N/A"}
                            onChange={(e) => {
                              if (!hasBaseUOM) return;
                              updateRow(i, {
                                avgCostBase:
                                  e.target.value === "" ? "" : Number(e.target.value),
                              });
                            }}
                          />
                        </td>

                        {/* Discount */}
                        <td>
                          <input
                            type="number"
                            className="form-control text-end"
                            value={
                              row.discountPerUnit === 0 ||
                              row.discountPerUnit === "" ||
                              row.discountPerUnit == null
                                ? ""
                                : row.discountPerUnit
                            }
                            readOnly={isView}
                            placeholder="Discount"
                            onChange={(e) =>
                              updateRow(i, {
                                discountPerUnit:
                                  e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                          />
                        </td>

                        {/* Line total */}
                        <td className="grn-line-total">
                          {formatCurrency(row.lineTotal || computeLineTotal(row))}
                        </td>

                        {/* Action column */}
                        {!isView && (
                          <td className="text-center">
                            <div className="d-flex justify-content-center gap-1">
                              <button
                                type="button"
                                className="icon-btn-modern icon-btn-add"
                                title="Add row"
                                onClick={addItem}
                              >
                                <i className="bi bi-plus-lg" />
                              </button>

                              <button
                                type="button"
                                className="icon-btn-modern icon-btn-copy"
                                title="Duplicate row"
                                onClick={() => duplicateItem(i)}
                              >
                                <i className="bi bi-files" />
                              </button>

                              <button
                                type="button"
                                className="icon-btn-modern icon-btn-remove"
                                title="Remove row"
                                onClick={() => removeItem(i)}
                                disabled={form.items.length === 1}
                                style={
                                  form.items.length === 1
                                    ? { opacity: 0.5, cursor: "not-allowed" }
                                    : {}
                                }
                              >
                                <i className="bi bi-dash-lg" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          {/* Summary bar */}
          <div className="grn-summary-bar">
            <div className="d-flex justify-content-end align-items-center">
              <div className="text-end">
                <div className="small text-muted">Grand Total</div>
                <div className="fw-bold" style={{ fontSize: "1rem", color: "#111827" }}>
                  {formatCurrency(totalValue)}
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Footer actions */}
          <div className="grn-footer-bar">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="small text-muted">
                {isView
                  ? "Read-only view"
                  : "Tip: Select supplier first to load supplier-specific items."}
              </div>

              <div className="d-flex align-items-center gap-2">
                {isView ? (
                  <>
                    {selectedGRN && selectedGRN.items && selectedGRN.items.length > 0 && (
                      <PDFDownloadLink
                        document={<GRNPDF grn={selectedGRN} />}
                        fileName={`${selectedGRN?.grnNo || "GRN"}.pdf`}
                        style={{ textDecoration: "none" }}
                      >
                        {({ loading: pdfLoading }) => (
                          <Button className="action-btn-modal">
                            {pdfLoading ? (
                              "Preparing PDF..."
                            ) : (
                              <>
                                <i className="bi bi-file-earmark-pdf me-2" />
                                Export PDF
                              </>
                            )}
                          </Button>
                        )}
                      </PDFDownloadLink>
                    )}
                  </>
                ) : (
                  <Button type="submit" className="action-btn-modal" disabled={loading}>
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        {isEdit ? "Updating..." : "Creating..."}
                      </>
                    ) : isEdit ? (
                      <>
                        <i className="bi bi-check2-circle me-2" />
                        Update GRN
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-circle me-2" />
                        Create GRN
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </Modal.Body>

      <ToastContainer position="top-right" autoClose={2000} />
    </Modal>
  );
};

export default GRNCreateModal;