// src/pages/finance/PaymentCreateModal.jsx

import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import { Modal, Button } from "react-bootstrap";
import { toast, ToastContainer } from "react-toastify";

import { useAuth } from "../../context/AuthContext";

import {
  createCustomerPayment,
  updateCustomerPayment,
  getCustomerOutstanding,
  getCustomerOpenInvoices,
} from "../../lib/api/finance.api";

import { getCustomers, getSalesReps } from "../../lib/api/users.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

// ------------------------------------------------------------
// Generate Payment No
// ------------------------------------------------------------
const generatePaymentNo = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `CPAY-${yyyy}-${mm}-${dd}-${rand}`;
};

// ------------------------------------------------------------
// Money helpers
// ------------------------------------------------------------
const toCents = (n) => Math.round((Number(n) || 0) * 100);
const centsToNum = (c) => (Number(c) || 0) / 100;
const formatMoney = (v) => `Rs. ${Number(v || 0).toFixed(2)}`;

const formatDateText = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
};

const PaymentCreateModal = ({
  show,
  mode = "create", // "create" | "edit" | "view"
  payment,
  onClose,
  onSuccess,
}) => {
  const isView = mode === "view";
  const isCreate = mode === "create";
  const isEdit = mode === "edit";

  // true when the form fields should be editable
  const isEditable = isCreate || isEdit;

  // ------------------------------------------------------------
  // RBAC
  // ------------------------------------------------------------
  const { user } = useAuth();

  const actorType = user?.actorType;
  const role = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");

  const isSalesRep = actorType === "SalesRep" || role === "SalesRep";

  const loggedInSalesRepId =
    user?.id ||
    user?._id ||
    user?.salesRep?._id ||
    user?.salesRepId ||
    user?.actorId ||
    "";

  const loggedInSalesRepLabel =
    user?.name || user?.fullName || user?.email || "Sales Rep";

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  const [outstanding, setOutstanding] = useState(null);

  // Each row: { invoice: {...}, amountInput: "12.34" }
  const [allocPreview, setAllocPreview] = useState([]);

  const [form, setForm] = useState({
    paymentNo: "",
    paymentDate: new Date().toISOString().substring(0, 10),
    customer: "",
    amount: "",
    method: "",
    referenceNo: "",
    collectedBy: "",
    remarks: "",
  });

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const resetForm = () => {
    setForm({
      paymentNo: generatePaymentNo(),
      paymentDate: new Date().toISOString().substring(0, 10),
      customer: "",
      amount: "",
      method: "",
      referenceNo: "",
      collectedBy: isSalesRep ? loggedInSalesRepId : "",
      remarks: "",
    });

    setAllocPreview([]);
    setOutstanding(null);
    setLoading(false);
    setLoadingInvoices(false);
  };

  const populateViewEditForm = (p) => {
    setForm({
      paymentNo: p.paymentNo || "",
      paymentDate: p.paymentDate
        ? p.paymentDate.substring(0, 10)
        : new Date().toISOString().substring(0, 10),
      customer: p.customer?._id || p.customer || "",
      amount: p.amount || "",
      method: p.method || "",
      referenceNo: p.referenceNo || "",
      collectedBy: p.collectedBy?._id || p.collectedBy || "",
      remarks: p.remarks || "",
    });

    const allocs = Array.isArray(p.allocations) ? p.allocations : [];
    setAllocPreview(
      allocs.map((a) => ({
        invoice: a.invoice || a,
        amountInput:
          a?.amount !== undefined && a?.amount !== null
            ? Number(a.amount).toFixed(2)
            : "",
      }))
    );
  };

  const getMethodLabel = (m) =>
    (
      {
        cash: "Cash",
        cheque: "Cheque",
        "bank-transfer": "Bank Transfer",
        other: "Other",
      }[m] || m
    );

  // ------------------------------------------------------------
  // Init / Reset on open-close
  // ------------------------------------------------------------
  useEffect(() => {
    if (!show) return;

    loadDropdowns();

    if ((isView || isEdit) && payment) {
      populateViewEditForm(payment);

      // For edit mode: also load outstanding so the info chip is populated
      if (isEdit) {
        const customerId = payment.customer?._id || payment.customer;
        if (customerId) {
          getCustomerOutstanding(customerId)
            .then((res) => {
              const out = typeof res === "number" ? res : res?.outstanding ?? 0;
              setOutstanding(out);
            })
            .catch(() => setOutstanding(null));
        }
      }
      return;
    }

    if (isCreate) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, mode, payment]);

  // Keep collectedBy locked to logged-in SalesRep in create mode
  useEffect(() => {
    if (!show) return;
    if (!isCreate) return;
    if (isSalesRep && loggedInSalesRepId) {
      setForm((f) => ({ ...f, collectedBy: loggedInSalesRepId }));
    }
  }, [show, isCreate, isSalesRep, loggedInSalesRepId]);

  // ------------------------------------------------------------
  // Dropdowns
  // ------------------------------------------------------------
  const loadDropdowns = async () => {
    try {
      const [custRes, repRes] = await Promise.all([
        getCustomers(),
        isAdminOrDataEntry ? getSalesReps() : Promise.resolve([]),
      ]);

      const custList = custRes?.data || custRes || [];
      const repList = repRes?.data || repRes || [];

      setCustomers(Array.isArray(custList) ? custList : []);
      setSalesReps(Array.isArray(repList) ? repList : []);
    } catch (err) {
      console.error("Failed to load dropdown lists:", err);
      toast.error("Failed loading customers or sales reps");
    }
  };

  // ------------------------------------------------------------
  // Customer change → outstanding + open invoices
  // ------------------------------------------------------------
  const handleCustomerChange = async (id) => {
    if (isView) return;

    setForm((f) => ({ ...f, customer: id || "" }));
    setAllocPreview([]);
    setOutstanding(null);

    if (!id) return;

    try {
      const res = await getCustomerOutstanding(id);
      const out = typeof res === "number" ? res : res?.outstanding ?? 0;
      setOutstanding(out);
    } catch {
      setOutstanding(null);
    }

    setLoadingInvoices(true);
    try {
      const data = await getCustomerOpenInvoices(id);
      const invoices = Array.isArray(data?.invoices) ? data.invoices : [];

      setAllocPreview(
        invoices.map((inv) => ({
          invoice: inv,
          amountInput: "",
        }))
      );
    } catch (err) {
      console.error("Load open invoices failed:", err);
      toast.error("Failed to load open invoices");
      setAllocPreview([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // ------------------------------------------------------------
  // Basic field changes
  // ------------------------------------------------------------
  const handleChange = (e) => {
    if (isView) return;
    const { name, value } = e.target;
    // amount is always auto-calculated in create/edit modes
    if (name === "amount") return;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // ------------------------------------------------------------
  // Allocation input change (create & edit modes)
  // ------------------------------------------------------------
  const handleAllocAmountChange = (index, value) => {
    if (!isEditable) return;

    const ok = value === "" || /^\d*(\.\d{0,2})?$/.test(value);
    if (!ok) return;

    setAllocPreview((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const inv = row.invoice || {};
        const total = Number(inv.totalBalanceValue || 0);
        const paid = Number(inv.paidAmount || 0);
        const max = Number(inv.balance ?? Math.max(0, total - paid));

        const parsed = value === "" ? 0 : parseFloat(value);
        const numVal = Number.isFinite(parsed) ? parsed : 0;

        if (numVal > max) return { ...row, amountInput: Number(max).toFixed(2) };
        if (numVal < 0) return { ...row, amountInput: "0.00" };

        return { ...row, amountInput: value };
      })
    );
  };

  const normalizeAllocOnBlur = (index) => {
    if (!isEditable) return;

    setAllocPreview((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const inv = row.invoice || {};
        const total = Number(inv.totalBalanceValue || 0);
        const paid = Number(inv.paidAmount || 0);
        const max = Number(inv.balance ?? Math.max(0, total - paid));

        const raw = row.amountInput ?? "";
        if (raw === "") return row;

        const n = parseFloat(raw);
        if (!Number.isFinite(n)) return { ...row, amountInput: "" };

        const clamped = Math.min(Math.max(n, 0), max);
        return { ...row, amountInput: clamped.toFixed(2) };
      })
    );
  };

  // ------------------------------------------------------------
  // Derived totals
  // ------------------------------------------------------------
  const totalAllocated = useMemo(() => {
    const cents = allocPreview.reduce((sum, row) => {
      const raw = row?.amountInput ?? "";
      const v = raw === "" ? 0 : parseFloat(raw);
      return sum + toCents(Number.isFinite(v) ? v : 0);
    }, 0);

    return centsToNum(cents);
  }, [allocPreview]);

  const hasAnyAllocation = useMemo(
    () =>
      allocPreview.some((row) => {
        const raw = row?.amountInput ?? "";
        const v = raw === "" ? 0 : parseFloat(raw);
        return Number.isFinite(v) && v > 0;
      }),
    [allocPreview]
  );

  // In view mode show stored amount; in create/edit auto-calculate from allocations
  const displayAmount = isView ? Number(form.amount || 0) : Number(totalAllocated || 0);

  // ------------------------------------------------------------
  // Derived labels
  // ------------------------------------------------------------
  const selectedCustomerObj = useMemo(
    () => customers.find((c) => String(c._id) === String(form.customer)),
    [customers, form.customer]
  );

  const selectedCustomerLabel = selectedCustomerObj
    ? `${selectedCustomerObj.customerCode ? selectedCustomerObj.customerCode + " — " : ""}${
        selectedCustomerObj.name || "Customer"
      }`
    : "Not selected";

  const selectedCollectedByLabel = useMemo(() => {
    if (isSalesRep) return loggedInSalesRepLabel;

    const rep = salesReps.find((r) => String(r._id) === String(form.collectedBy));
    return (
      rep?.name ||
      rep?.fullName ||
      rep?.email ||
      payment?.collectedBy?.name ||
      payment?.collectedBy?.repCode ||
      "Not selected"
    );
  }, [isSalesRep, loggedInSalesRepLabel, salesReps, form.collectedBy, payment]);

  const collectedByOptions = isAdminOrDataEntry
    ? salesReps.map((r) => ({
        label: `${r.repCode ? `${r.repCode} — ` : ""}${r.name || r.fullName || r.email}`,
        value: r._id,
      }))
    : isSalesRep
    ? [{ label: loggedInSalesRepLabel, value: loggedInSalesRepId }]
    : [];

  const collectedByValue = form.collectedBy
    ? isAdminOrDataEntry
      ? {
          label:
            salesReps.find((r) => String(r._id) === String(form.collectedBy))?.name ||
            salesReps.find((r) => String(r._id) === String(form.collectedBy))?.fullName ||
            salesReps.find((r) => String(r._id) === String(form.collectedBy))?.email ||
            payment?.collectedBy?.name ||
            payment?.collectedBy?.repCode ||
            "Select",
          value: form.collectedBy,
        }
      : {
          label:
            payment?.collectedBy?.name ||
            payment?.collectedBy?.repCode ||
            loggedInSalesRepLabel,
          value: form.collectedBy,
        }
    : null;

  // ------------------------------------------------------------
  // Title / subtitle per mode
  // ------------------------------------------------------------
  const titleText = isView
    ? `View Payment ${payment?.paymentNo || ""}`
    : isEdit
    ? `Edit Payment ${payment?.paymentNo || ""}`
    : "Record Customer Payment";

  const subtitleText = isView
    ? "View payment details and invoice allocations."
    : isEdit
    ? "Update allocation amounts. Payment total is auto-calculated."
    : "Enter allocation amounts per invoice. Payment amount is auto-calculated from allocations.";

  const modeBadge = isView
    ? { label: "View", cls: "bg-light text-dark border" }
    : isEdit
    ? { label: "Edit", cls: "bg-warning-subtle text-warning-emphasis border border-warning-subtle" }
    : { label: "Create", cls: "bg-success-subtle text-success-emphasis border border-success-subtle" };

  // ------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return;

    if (!form.customer) {
      toast.error("Please select a customer");
      return;
    }

    if (!form.method) {
      toast.error("Please select a payment method");
      return;
    }

    if (!hasAnyAllocation) {
      toast.error("Please allocate the payment to at least one invoice");
      return;
    }

    if (!Number.isFinite(displayAmount) || displayAmount <= 0) {
      toast.error("Total payment amount must be greater than 0");
      return;
    }

    if (isAdminOrDataEntry && !form.collectedBy) {
      toast.error("Please select Collected By");
      return;
    }

    try {
      setLoading(true);

      const cleanedAllocations = allocPreview
        .map((row) => {
          const raw = row?.amountInput ?? "";
          const v = raw === "" ? 0 : parseFloat(raw);
          const num = Number.isFinite(v) ? v : 0;

          return {
            invoice: row.invoice?._id || row.invoice,
            amount: centsToNum(toCents(num)),
            _raw: num,
          };
        })
        .filter((x) => x._raw > 0)
        .map(({ _raw, ...rest }) => rest);

      const payload = {
        paymentNo: form.paymentNo,
        paymentDate: form.paymentDate,
        customer: form.customer,
        amount: centsToNum(toCents(displayAmount)),
        method: form.method,
        referenceNo: form.referenceNo,
        remarks: form.remarks,
        allocations: cleanedAllocations,
        ...(form.collectedBy ? { collectedBy: form.collectedBy } : {}),
      };

      if (isEdit) {
        await updateCustomerPayment(payment._id, payload);
        toast.success("Payment updated successfully");
      } else {
        await createCustomerPayment(payload);
        toast.success("Payment recorded successfully");
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error("Save payment failed:", err);
      toast.error(err?.response?.data?.message || "Failed to save payment");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // Select styles
  // ------------------------------------------------------------
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "46px",
      borderRadius: 10,
      backgroundColor: "#fff",
      borderColor: state.isFocused ? "#5c3e94" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 1px #5c3e94" : "none",
      "&:hover": { borderColor: "#5c3e94" },
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

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="payment-modal"
    >
      <style>{`
        .payment-modal {
          max-width: 96vw !important;
          width: 96vw;
        }

        .payment-modal .modal-content {
          height: 92vh;
          border-radius: 16px;
          overflow: hidden;
        }

        .payment-modal .modal-header {
          border-bottom: 1px solid #eef0f4;
          padding: 14px 18px;
          background: rgb(25, 25, 25);
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .payment-modal .modal-body {
          background: #f8fafc;
          overflow: auto;
          padding: 14px 16px 0 16px;
        }

        .payment-section-card {
          background: #fff;
          border: 1px solid #e9edf3;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
        }

        .payment-section-title {
          font-size: 0.86rem;
          font-weight: 700;
          color: #475467;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .payment-summary-strip {
          border: 1px solid #e9edf3;
          border-radius: 12px;
          background: #fbfcfe;
          padding: 10px 12px;
          margin-bottom: 12px;
        }

        .payment-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .payment-chip {
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

        .payment-chip.edit-mode {
          border-color: #fde68a;
          background: #fffbeb;
          color: #92400e;
        }

        .payment-table-wrap {
          border: 1px solid #e9edf3;
          border-radius: 12px;
          overflow: auto;
          max-height: 40vh;
          background: #fff;
        }

        .payment-table {
          width: 100%;
          min-width: 900px;
          border-collapse: separate;
          border-spacing: 0;
        }

        .payment-table thead th {
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

        .payment-table tbody td {
          border-bottom: 1px solid #f1f3f7;
          padding: 8px;
          vertical-align: middle;
          background: #fff;
        }

        .payment-summary-bar {
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

        .payment-footer-bar {
          position: sticky;
          bottom: 0;
          z-index: 10;
          background: #fff;
          border-top: 1px solid #eef0f4;
          padding: 12px 16px;
          margin: 0 -16px;
        }

        .payment-history-card {
          background: #fff;
          border: 1px solid #e9edf3;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
        }

        .payment-history-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .payment-history-table th {
          background: #f8fafc;
          font-size: 12px;
          color: #6b7280;
          font-weight: 700;
          border-bottom: 1px solid #e9edf3;
          padding: 8px;
          white-space: nowrap;
        }

        .payment-history-table td {
          border-bottom: 1px solid #f1f3f7;
          padding: 8px;
          font-size: 13px;
        }
      `}</style>

      <Modal.Header closeButton>
        <div className="d-flex justify-content-between align-items-start w-100 gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <h2 className="page-title-modal mb-0">{titleText}</h2>
              <span className={`badge rounded-pill ${modeBadge.cls}`}>
                {modeBadge.label}
              </span>
            </div>
            <p className="page-subtitle-modal mb-0">{subtitleText}</p>
          </div>

          <div className="text-end me-3">
            <div
              className="px-3 py-2 rounded-3 border"
              style={{ background: "#f8fafc", minWidth: "220px" }}
            >
              <div className="fw-bold text-dark">Payment No</div>
              <div className="small text-muted">{form.paymentNo || "-"}</div>
            </div>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit}>
          {/* Top Summary Strip */}
          <div className="payment-summary-strip">
            <div className="payment-chip-row">
              <span className="payment-chip">
                <i className="bi bi-upc-scan" />
                Payment: {form.paymentNo || "-"}
              </span>

              <span className="payment-chip">
                <i className="bi bi-person" />
                Customer: {selectedCustomerObj?.name || "Not selected"}
              </span>

              <span className="payment-chip">
                <i className="bi bi-calendar-event" />
                Date: {formatDateText(form.paymentDate)}
              </span>

              <span className="payment-chip">
                <i className="bi bi-wallet2" />
                Method: {form.method ? getMethodLabel(form.method) : "Not selected"}
              </span>

              {(isAdminOrDataEntry || isSalesRep || isView) && (
                <span className="payment-chip">
                  <i className="bi bi-person-badge" />
                  Collected By: {selectedCollectedByLabel}
                </span>
              )}

              {outstanding !== null && isEditable && (
                <span className="payment-chip">
                  <i className="bi bi-cash-stack" />
                  Outstanding: {formatMoney(outstanding)}
                </span>
              )}

              {isSalesRep && isEditable && (
                <span className="payment-chip">
                  <i className="bi bi-lock" />
                  Sales Rep auto-filled
                </span>
              )}

              {isEdit && (
                <span className="payment-chip edit-mode">
                  <i className="bi bi-pencil-square" />
                  Editing — changes will update this payment
                </span>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div className="payment-section-card mb-3">
            <div className="payment-section-title">
              <i className="bi bi-credit-card-2-front" />
              Payment Details
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="paymentNo"
                    className="form-control"
                    value={form.paymentNo}
                    onChange={handleChange}
                    readOnly
                    disabled
                  />
                  <label>Payment Number</label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="date"
                    id="paymentDateInput"
                    name="paymentDate"
                    className="form-control"
                    value={form.paymentDate}
                    onChange={handleChange}
                    readOnly={isView}
                    required
                  />
                  <label htmlFor="paymentDateInput">Payment Date</label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    // In edit mode, customer is locked (payments are tied to a customer)
                    isDisabled={isView || isEdit}
                    options={customers.map((c) => ({
                      label: `${c.customerCode} — ${c.name}`,
                      value: c._id,
                    }))}
                    value={
                      form.customer
                        ? {
                            label: selectedCustomerLabel,
                            value: form.customer,
                          }
                        : null
                    }
                    onChange={(opt) => handleCustomerChange(opt?.value)}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder=""
                  />
                  <label>Customer {isEdit && <span className="text-muted">(locked)</span>}</label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="amount"
                    className="form-control"
                    value={Number(displayAmount || 0).toFixed(2)}
                    readOnly
                    disabled
                  />
                  <label>Amount (Auto)</label>
                  {isEditable && (
                    <small className="text-muted d-block mt-1">
                      Auto-calculated from allocations below.
                    </small>
                  )}
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    options={[
                      { label: "Cash", value: "cash" },
                      { label: "Cheque", value: "cheque" },
                      { label: "Bank Transfer", value: "bank-transfer" },
                      { label: "Other", value: "other" },
                    ]}
                    value={
                      form.method
                        ? { label: getMethodLabel(form.method), value: form.method }
                        : null
                    }
                    onChange={(opt) =>
                      !isView && setForm((f) => ({ ...f, method: opt?.value || "" }))
                    }
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder=""
                  />
                  <label>Method</label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="referenceNo"
                    className="form-control"
                    value={form.referenceNo}
                    onChange={handleChange}
                    readOnly={isView}
                  />
                  <label>Reference / Cheque No</label>
                </div>
              </div>

              {(isAdminOrDataEntry || isSalesRep || isView) && (
                <div className="col-md-6">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView || isSalesRep}
                      isClearable={!isSalesRep}
                      options={collectedByOptions}
                      value={collectedByValue}
                      onChange={(opt) =>
                        !isView &&
                        setForm((f) => ({ ...f, collectedBy: opt?.value || "" }))
                      }
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder=""
                    />
                    <label>Collected By</label>
                  </div>
                  <small className="text-muted d-block mt-1">
                    {isSalesRep
                      ? "Auto-filled from your account."
                      : "Select a Sales Rep."}
                  </small>
                </div>
              )}

              <div className="col-md-6">
                <div className="form-floating">
                  <textarea
                    name="remarks"
                    className="form-control"
                    style={{ minHeight: "58px" }}
                    value={form.remarks}
                    onChange={handleChange}
                    readOnly={isView}
                  />
                  <label>Remarks</label>
                </div>
              </div>
            </div>
          </div>

          {/* Allocation */}
          <div className="payment-section-card mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="payment-section-title mb-0">
                <i className="bi bi-journal-check" />
                {isView ? "Allocations" : "Manual Allocation"}
              </div>
            </div>

            {loadingInvoices ? (
              <div className="text-muted py-2">Loading open invoices...</div>
            ) : allocPreview && allocPreview.length ? (
              <>
                <div className="payment-table-wrap">
                  <table className="payment-table">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th className="text-end">Total</th>
                        <th className="text-end">Paid</th>
                        <th className="text-end">Balance</th>
                        <th className="text-end">Allocated</th>
                      </tr>
                    </thead>

                    <tbody>
                      {allocPreview.map((a, i) => {
                        const inv = a.invoice || {};
                        const total = Number(inv.totalBalanceValue || 0);
                        const paid = Number(inv.paidAmount || 0);
                        const balance = Number(
                          inv.balance ?? Math.max(0, total - paid)
                        );

                        const raw = a.amountInput ?? "";
                        const parsed = raw === "" ? 0 : parseFloat(raw);
                        const allocatedSafe = Number.isFinite(parsed) ? parsed : 0;

                        return (
                          <tr key={i}>
                            <td>{inv.invoiceNo || "-"}</td>
                            <td>
                              {inv.invoiceDate
                                ? new Date(inv.invoiceDate).toLocaleDateString()
                                : "-"}
                            </td>
                            <td className="text-end">{total.toFixed(2)}</td>
                            <td className="text-end">{paid.toFixed(2)}</td>
                            <td className="text-end">{balance.toFixed(2)}</td>
                            <td
                              className="text-end"
                              style={{ minWidth: "140px" }}
                            >
                              {isEditable ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="form-control form-control-sm text-end"
                                  placeholder="0.00"
                                  value={raw}
                                  onChange={(e) =>
                                    handleAllocAmountChange(i, e.target.value)
                                  }
                                  onBlur={() => normalizeAllocOnBlur(i)}
                                />
                              ) : (
                                <strong>{Number(allocatedSafe).toFixed(2)}</strong>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Grand Total */}
                <div className="payment-summary-bar">
                  <div className="d-flex justify-content-end align-items-center">
                    <div className="text-end">
                      <div className="small text-muted">Grand Total</div>
                      <div
                        className="fw-bold"
                        style={{ fontSize: "1rem", color: "#111827" }}
                      >
                        {formatMoney(isView ? displayAmount : totalAllocated)}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted py-2">
                {isView
                  ? "No allocations recorded for this payment."
                  : form.customer
                  ? "No open invoices found for this customer."
                  : "Select a customer to load open invoices."}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="payment-footer-bar">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="small text-muted">
                {isView
                  ? "Read-only view"
                  : isEdit
                  ? "Modify allocation amounts — total updates automatically."
                  : "Allocate invoice amounts and the payment total updates automatically."}
              </div>

              <div className="d-flex align-items-center gap-2">
                <Button
                  type="button"
                  variant="light"
                  onClick={onClose}
                  disabled={loading}
                  style={{ border: "1px solid #e5e7eb" }}
                >
                  {isView ? "Close" : "Cancel"}
                </Button>

                {!isView && (
                  <Button
                    className="action-btn-modal"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        {isEdit ? "Updating..." : "Recording..."}
                      </>
                    ) : isEdit ? (
                      <>
                        <i className="bi bi-pencil-square me-2" />
                        Update Payment
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-2" />
                        Record Payment
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Payment History (View mode only) */}
        {isView && allocPreview.length > 0 && (
          <div className="payment-history-card mt-3 mb-3">
            <div className="payment-section-title mb-2">
              <i className="bi bi-clock-history" />
              Payment History for Allocated Invoices
            </div>

            {allocPreview.map((a, i) => {
              const inv = a.invoice;
              const history = inv?.paymentAllocations || [];

              return (
                <div key={i} className="mb-4">
                  <h6 className="mb-2">
                    Invoice {inv?.invoiceNo || "-"} — {history.length} payment(s)
                  </h6>

                  {history.length === 0 ? (
                    <div className="text-muted">No previous payments.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="payment-history-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Reference</th>
                            <th>Collected By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h, idx) => (
                            <tr key={idx}>
                              <td>
                                {h.date
                                  ? new Date(h.date).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td>{Number(h.amount || 0).toFixed(2)}</td>
                              <td>{h.method || "-"}</td>
                              <td>{h.referenceNo || "-"}</td>
                              <td>
                                {h.collectedBy?.name ||
                                  h.collectedBy?.repCode ||
                                  "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal.Body>

      <ToastContainer position="top-right" autoClose={2000} />
    </Modal>
  );
};

export default PaymentCreateModal;