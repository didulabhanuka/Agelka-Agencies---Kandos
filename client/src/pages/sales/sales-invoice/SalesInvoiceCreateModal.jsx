// src/pages/sales/SalesInvoiceCreateModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

import {
  createSalesInvoice,
  updateSalesInvoice,
  deleteSalesInvoice,
  listAvailableSaleItems,
} from "../../../lib/api/sales.api";
import { listBranches } from "../../../lib/api/settings.api";
import { getCustomers, getSalesReps } from "../../../lib/api/users.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateInvoiceNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `INV-${yyyy}-${mm}-${dd}-${rand}`;
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function computeLineTotal(row) {
  const baseQty = Number(row.baseQty || 0);
  const primaryQty = Number(row.primaryQty || 0);
  const sellingPriceBase = Number(row.sellingPriceBase || 0);
  const sellingPricePrimary = Number(row.sellingPricePrimary || 0);
  const discount = Number(row.discountPerUnit || 0);
  return baseQty * sellingPriceBase + primaryQty * sellingPricePrimary - discount;
}

// ─── Stock validation ────────────────────────────────────────────────────────
//
// Primary-only item (baseUom = null / factorToBase = 1):
//   primaryQty ≤ qtyOnHand.primaryQty
//
// Dual-UOM item (baseUom present, factorToBase > 1):
//   primaryQty ≤ qtyOnHand.primaryQty          ← can't break open more packs than exist
//   baseQty    is NOT capped by qtyOnHand.baseQty  ← loose pieces can come from breaking packs
//   (primaryQty × factorToBase) + baseQty ≤ runningBalance   ← hard combined cap
//
function validateQtyChange({ field, newValue, currentRow, meta }) {
  if (!meta) return { valid: true };

  const hasBaseUom = !!meta.baseUom;
  const factorToBase = Number(meta.factorToBase || 1);
  const runningBalance = Number(meta.runningBalance ?? 0);
  const maxPrimary = Number(meta.qtyOnHand?.primaryQty ?? 0);

  const val = Number(newValue || 0);

  // ── Primary-only ──────────────────────────────────────────────────────────
  if (!hasBaseUom) {
    if (field === "primaryQty" && val > maxPrimary) {
      return {
        valid: false,
        capped: maxPrimary,
        message: `Only ${maxPrimary} ${meta.primaryUom || "units"} in stock.`,
      };
    }
    return { valid: true };
  }

  // ── Dual-UOM ──────────────────────────────────────────────────────────────
  // Snapshot of the OTHER qty (the one not being changed right now)
  const otherPrimary = field === "primaryQty" ? Number(currentRow.primaryQty || 0) : val === 0 ? 0 : Number(currentRow.primaryQty || 0);
  const otherBase    = field === "baseQty"    ? Number(currentRow.baseQty    || 0) : val === 0 ? 0 : Number(currentRow.baseQty    || 0);

  const incomingPrimary = field === "primaryQty" ? val : Number(currentRow.primaryQty || 0);
  const incomingBase    = field === "baseQty"    ? val : Number(currentRow.baseQty    || 0);

  // 1. Primary cap: can't exceed whole packs in stock
  if (field === "primaryQty" && val > maxPrimary) {
    return {
      valid: false,
      capped: maxPrimary,
      message: `Only ${maxPrimary} ${meta.primaryUom || "packs"} available. Cannot exceed whole-pack stock.`,
    };
  }

  // 2. Combined running-balance cap
  const consumed = incomingPrimary * factorToBase + incomingBase;
  if (consumed > runningBalance) {
    if (field === "baseQty") {
      const maxBase = runningBalance - incomingPrimary * factorToBase;
      return {
        valid: false,
        capped: Math.max(0, maxBase),
        message: `Max ${Math.max(0, maxBase)} ${meta.baseUom || "units"} allowed (running balance: ${runningBalance} ${meta.baseUom}, ${incomingPrimary} ${meta.primaryUom} already uses ${incomingPrimary * factorToBase}).`,
      };
    } else {
      const maxPrimaryByBalance = Math.floor((runningBalance - incomingBase) / factorToBase);
      return {
        valid: false,
        capped: Math.max(0, maxPrimaryByBalance),
        message: `Max ${Math.max(0, maxPrimaryByBalance)} ${meta.primaryUom || "packs"} allowed (running balance: ${runningBalance} ${meta.baseUom}, ${incomingBase} loose ${meta.baseUom} already reserved).`,
      };
    }
  }

  return { valid: true };
}

// ─── Row / form builders ─────────────────────────────────────────────────────

const buildEmptyItemRow = () => ({
  item: "",
  baseQty: 0,
  primaryQty: 0,
  sellingPriceBase: 0,
  sellingPricePrimary: 0,
  discountPerUnit: 0,
  lineTotal: 0,
});

const buildEmptyForm = () => ({
  invoiceNo: generateInvoiceNo(),
  branch: "",
  customer: "",
  salesRep: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  items: [buildEmptyItemRow()],
  remarks: "",
});

// ─── Component ───────────────────────────────────────────────────────────────

const SalesInvoiceCreateModal = ({
  show,
  mode = "create",
  selectedInvoice,
  onClose,
  onSuccess,
}) => {
  const isView   = mode === "view";
  const isCreate = mode === "create";
  const isEdit   = mode === "edit";

  // RBAC
  const { user } = useAuth();
  const actorType = user?.actorType;
  const role      = user?.role;

  const isAdminOrDataEntry =
    actorType === "User" && (role === "Admin" || role === "DataEntry");
  const isSalesRep = actorType === "SalesRep";

  const loggedInSalesRepId =
    user?.id || user?._id || user?.salesRep?._id || user?.salesRepId || user?.actorId || "";

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading]       = useState(false);
  const [branches, setBranches]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [salesReps, setSalesReps]   = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);
  const [stockInfo, setStockInfo]   = useState({});
  const [totalValue, setTotalValue] = useState(0);
  const [form, setForm]             = useState(buildEmptyForm);
  const [hoveredRowIndex, setHoveredRowIndex] = useState(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c._id) === String(form.customer)),
    [customers, form.customer]
  );
  const isCustomerBlocked = selectedCustomer?.creditStatus === "blocked";

  const titleText = isView ? "View Sales Invoice" : isEdit ? "Edit Sales Invoice" : "Create Sales Invoice";
  const subtitleText = isView
    ? "View all recorded details of this sales invoice."
    : isEdit
    ? "Modify and update the invoice details before approval."
    : "Record and manage customer sales invoices across branches.";

  const currentStatus = selectedInvoice?.status || (isCreate ? "draft" : "");
  const statusLabel =
    currentStatus === "waiting_for_approval" ? "Waiting for Approval"
    : currentStatus === "approved"  ? "Approved"
    : currentStatus === "cancelled" ? "Cancelled"
    : currentStatus === "draft"     ? "Draft"
    : currentStatus || "-";

  // ── Load base data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!show) return;
    (async () => {
      setLoading(true);
      try {
        const [brRes, custRes, salesRes] = await Promise.all([
          listBranches(),
          getCustomers(),
          isAdminOrDataEntry || isSalesRep ? getSalesReps() : Promise.resolve([]),
        ]);
        setBranches(brRes.data || brRes || []);
        setCustomers(custRes || []);
        setSalesReps(salesRes?.data || salesRes || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    })();
  }, [show, isAdminOrDataEntry, isSalesRep]);

  // Reset on create
  useEffect(() => {
    if (!show || !isCreate) return;
    setForm({ ...buildEmptyForm(), salesRep: isSalesRep ? loggedInSalesRepId : "" });
    setTotalValue(0);
    setStockInfo({});
    setItemsMaster([]);
    setHoveredRowIndex(null);
  }, [show, isCreate, isSalesRep, loggedInSalesRepId]);

  // Auto-fill sales rep
  useEffect(() => {
    if (!show || !isSalesRep || !loggedInSalesRepId) return;
    setForm((p) => ({ ...p, salesRep: loggedInSalesRepId }));
  }, [show, isSalesRep, loggedInSalesRepId]);

  // ── Load available items ───────────────────────────────────────────────────
  const loadAvailableItemsForBranch = async (branchId, salesRepId = null) => {
    try {
      const params = { branch: branchId };
      if (salesRepId) params.salesRep = salesRepId;

      const res  = await listAvailableSaleItems(params);
      const rows = res?.data || [];

      // Store full item data including stock fields needed for validation
      const mapped = rows.map((item) => ({
        value:               item.itemId,
        label:               `${item.itemCode} — ${item.itemName}`,
        itemId:              item.itemId,
        itemCode:            item.itemCode,
        itemName:            item.itemName,
        qtyDisplay:          item.qtyDisplay,
        sellingPriceBase:    Number(item.sellingPriceBase  ?? 0),
        sellingPricePrimary: Number(item.sellingPricePrimary ?? 0),
        avgCostBase:         Number(item.avgCostBase   ?? 0),
        avgCostPrimary:      Number(item.avgCostPrimary ?? 0),
        factorToBase:        item.factorToBase ?? 1,
        baseUom:             item.baseUom,
        primaryUom:          item.primaryUom,
        // ── stock validation fields ──
        runningBalance:      Number(item.runningBalance ?? 0),
        qtyOnHand:           item.qtyOnHand ?? { baseQty: 0, primaryQty: 0 },
      }));

      setItemsMaster(mapped);

      const stockMap = {};
      rows.forEach((item) => {
        stockMap[item.itemId] = {
          qtyDisplay:  item.qtyDisplay,
          baseUom:     item.baseUom,
          primaryUom:  item.primaryUom,
        };
      });
      setStockInfo(stockMap);
    } catch (err) {
      console.error("Failed to load available items", err);
      toast.error("Failed to load available items");
      setItemsMaster([]);
      setStockInfo({});
    }
  };

  // Populate edit/view
  useEffect(() => {
    if (!show || !selectedInvoice || (!isView && !isEdit)) return;

    const mappedItems = (selectedInvoice.items || []).map((i) => {
      const priceBase    = Number(i.sellingPriceBase    || 0);
      const pricePrimary = Number(i.sellingPricePrimary || 0);
      const baseQty      = Number(i.baseQty    || 0);
      const primaryQty   = Number(i.primaryQty || 0);
      const discount     = Number(i.discountPerUnit || 0);
      return {
        item:               i.item?._id || i.item,
        baseQty,
        primaryQty,
        sellingPriceBase:    priceBase,
        sellingPricePrimary: pricePrimary,
        discountPerUnit:     discount,
        lineTotal:           baseQty * priceBase + primaryQty * pricePrimary - discount,
      };
    });

    const invoiceDate = selectedInvoice.invoiceDate
      ? selectedInvoice.invoiceDate.split("T")[0]
      : new Date().toISOString().split("T")[0];

    setForm({
      invoiceNo:  selectedInvoice.invoiceNo || generateInvoiceNo(),
      branch:     selectedInvoice.branch?._id   || "",
      customer:   selectedInvoice.customer?._id  || "",
      salesRep:   selectedInvoice.salesRep?._id  || selectedInvoice.salesRep || "",
      invoiceDate,
      items:      mappedItems.length > 0 ? mappedItems : [buildEmptyItemRow()],
      remarks:    selectedInvoice.remarks || "",
    });

    const total =
      typeof selectedInvoice.totalValue === "number"
        ? selectedInvoice.totalValue
        : mappedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    setTotalValue(total);

    const branchId = selectedInvoice.branch?._id;
    if (branchId) {
      const repId = selectedInvoice.salesRep?._id || selectedInvoice.salesRep || null;
      loadAvailableItemsForBranch(branchId, repId);
    }
  }, [show, isView, isEdit, selectedInvoice]);

  // Recalculate total
  useEffect(() => {
    setTotalValue(form.items.reduce((sum, i) => sum + computeLineTotal(i), 0));
  }, [form.items]);

  // ── Row helpers ────────────────────────────────────────────────────────────
  const updateItemRow = (index, patch) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], ...patch };
      nextItems[index].lineTotal = computeLineTotal(nextItems[index]);
      return { ...prev, items: nextItems };
    });
  };

  /**
   * Handles qty changes with stock validation.
   * - Clamps the value to the allowed max and shows a toast warning if exceeded.
   */
  const handleQtyChange = (rowIndex, field, rawValue) => {
    const row  = form.items[rowIndex];
    const meta = row.item ? itemsMaster.find((it) => it.value === row.item) : null;

    const numVal = rawValue === "" ? 0 : Number(rawValue);

    const result = validateQtyChange({ field, newValue: numVal, currentRow: row, meta });

    if (!result.valid) {
      toast.warning(result.message, { toastId: `stock-warn-${rowIndex}-${field}` });
      // Clamp to max allowed
      updateItemRow(rowIndex, { [field]: result.capped });
      return;
    }

    updateItemRow(rowIndex, { [field]: numVal });
  };

  const addItem = () =>
    setForm((p) => ({ ...p, items: [...p.items, buildEmptyItemRow()] }));

  const removeItem = (index) => {
    if (form.items.length === 1) return;
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm((p) => ({ ...p, items: newItems }));
  };

  // ── Delete eligibility ─────────────────────────────────────────────────────
  const canDelete =
    !isCreate &&
    selectedInvoice &&
    ["draft", "waiting_for_approval"].includes(selectedInvoice.status);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return onClose?.();

    if (isSalesRep && !loggedInSalesRepId) {
      toast.error("Unable to identify your Sales Rep account. Please re-login.");
      return;
    }
    if (isAdminOrDataEntry && !form.salesRep) {
      toast.warning("Sales Rep is required");
      return;
    }
    if (!form.branch || !form.customer) {
      toast.warning("Please select both branch and customer");
      return;
    }

    const cust = customers.find((c) => String(c._id) === String(form.customer));
    if (cust?.creditStatus === "blocked") {
      toast.error("This customer is BLOCKED — invoice cannot be created.");
      return;
    }
    if (!form.items.length) {
      toast.warning("Please add at least one item");
      return;
    }

    const hasInvalidLines = form.items.some((i) => {
      if (!i.item) return true;
      const meta = itemsMaster.find((it) => it.value === i.item);
      const hasBaseUom = !!meta?.baseUom;
      const baseQty    = +i.baseQty    || 0;
      const primaryQty = +i.primaryQty || 0;
      const priceBase  = +i.sellingPriceBase    || 0;
      const pricePrimary = +i.sellingPricePrimary || 0;
      if (hasBaseUom) {
        if (baseQty <= 0 && primaryQty <= 0) return true;
        if (baseQty    > 0 && priceBase    <= 0) return true;
        if (primaryQty > 0 && pricePrimary <= 0) return true;
        return false;
      }
      return primaryQty <= 0 || pricePrimary <= 0;
    });

    if (hasInvalidLines) {
      toast.warning(
        "Please check item lines: ensure qty > 0 and a price is set for each qty used."
      );
      return;
    }

    // Final stock check on all rows before submitting
    let stockError = false;
    form.items.forEach((row, idx) => {
      const meta = row.item ? itemsMaster.find((it) => it.value === row.item) : null;
      if (!meta) return;

      const primaryCheck = validateQtyChange({ field: "primaryQty", newValue: row.primaryQty, currentRow: row, meta });
      const baseCheck    = validateQtyChange({ field: "baseQty",    newValue: row.baseQty,    currentRow: row, meta });

      if (!primaryCheck.valid) {
        toast.error(`Row ${idx + 1}: ${primaryCheck.message}`);
        stockError = true;
      } else if (!baseCheck.valid) {
        toast.error(`Row ${idx + 1}: ${baseCheck.message}`);
        stockError = true;
      }
    });
    if (stockError) return;

    const payloadItems = form.items.map((i) => {
      const meta = itemsMaster.find((it) => it.value === i.item);
      const hasBaseUom = !!meta?.baseUom;
      return {
        item:               i.item,
        baseQty:            +i.baseQty    || 0,
        primaryQty:         +i.primaryQty || 0,
        sellingPriceBase:   hasBaseUom ? +i.sellingPriceBase : null,
        sellingPricePrimary: +i.sellingPricePrimary > 0 ? +i.sellingPricePrimary : null,
        discountPerUnit:
          i.discountPerUnit === "" || i.discountPerUnit == null || +i.discountPerUnit === 0
            ? null
            : +i.discountPerUnit,
      };
    });

    const payload = {
      invoiceNo:   form.invoiceNo,
      branch:      form.branch,
      customer:    form.customer,
      invoiceDate: form.invoiceDate,
      items:       payloadItems,
      remarks:     form.remarks,
      totalValue,
      ...(isAdminOrDataEntry ? { salesRep: form.salesRep } : {}),
    };

    try {
      setLoading(true);
      if (isEdit && selectedInvoice?._id) {
        const res = await updateSalesInvoice(selectedInvoice._id, payload);
        toast.success(res.message || `Sales Invoice ${res.invoice?.invoiceNo || form.invoiceNo} updated successfully`);
      } else {
        const res = await createSalesInvoice(payload);
        toast.success(res.message || `Sales Invoice ${res.invoice?.invoiceNo || form.invoiceNo} created successfully`);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save Sales Invoice");
    } finally {
      setLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedInvoice?._id) return;
    if (!window.confirm(`Are you sure you want to delete Invoice ${selectedInvoice.invoiceNo}?`)) return;
    try {
      setLoading(true);
      const res = await deleteSalesInvoice(selectedInvoice._id);
      toast.success(res?.message || `Invoice ${selectedInvoice.invoiceNo} deleted successfully`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to delete Sales Invoice");
    } finally {
      setLoading(false);
    }
  };

  // ── Select styles ──────────────────────────────────────────────────────────
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
    menu:       (base) => ({ ...base, zIndex: 9999, borderRadius: 10, overflow: "hidden" }),
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

  // ── Badge helpers ──────────────────────────────────────────────────────────
  const modeBadgeClass = isView
    ? "bg-light text-dark border"
    : isEdit
    ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
    : "bg-success-subtle text-success-emphasis border border-success-subtle";

  const statusBadgeClass =
    currentStatus === "approved"  ? "bg-success-subtle text-success-emphasis border border-success-subtle"
    : currentStatus === "cancelled" ? "bg-danger-subtle text-danger-emphasis border border-danger-subtle"
    : "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";

  // ── Derived options ────────────────────────────────────────────────────────
  const customerOptions = customers.map((c) => ({
    value: c._id,
    label: c.creditStatus ? `${c.name} — ${c.creditStatus}` : c.name,
    creditStatus: c.creditStatus,
  }));

  const selectedCustomerOption =
    customerOptions.find((opt) => String(opt.value) === String(form.customer)) || null;

  const selectedSalesRepOption =
    form.salesRep && (isAdminOrDataEntry || isSalesRep)
      ? isAdminOrDataEntry
        ? {
            label:
              salesReps.find((sr) => sr._id === form.salesRep)?.name ||
              salesReps.find((sr) => sr._id === form.salesRep)?.fullName ||
              salesReps.find((sr) => sr._id === form.salesRep)?.email || "",
            value: form.salesRep,
          }
        : { label: user?.name || "Sales Rep", value: form.salesRep }
      : null;

  const selectedBranchName = branches.find((b) => b._id === form.branch)?.name || "-";

  const selectedSalesRepLabel =
    isSalesRep
      ? user?.name || "Sales Rep"
      : salesReps.find((sr) => String(sr._id) === String(form.salesRep))?.name ||
        salesReps.find((sr) => String(sr._id) === String(form.salesRep))?.fullName ||
        salesReps.find((sr) => String(sr._id) === String(form.salesRep))?.email ||
        "Not selected";

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal show={show} onHide={onClose} centered backdrop="static" dialogClassName="sales-invoice-modal">
      <style>{`
        .sales-invoice-modal { max-width: 96vw !important; width: 96vw; }
        .sales-invoice-modal .modal-content { height: 92vh; border-radius: 16px; overflow: hidden; }
        .sales-invoice-modal .modal-header {
          border-bottom: 1px solid #eef0f4; padding: 14px 18px;
          background: rgb(25, 25, 25); position: sticky; top: 0; z-index: 20;
        }
        .sales-invoice-modal .modal-body { background: #f8fafc; overflow: auto; padding: 14px 16px 0 16px; }

        .invoice-section-card {
          background: #fff; border: 1px solid #e9edf3; border-radius: 14px;
          padding: 14px; box-shadow: 0 2px 8px rgba(16,24,40,.04);
        }
        .invoice-section-title {
          font-size: .86rem; font-weight: 700; color: #475467;
          margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
        }
        .invoice-table-wrap {
          border: 1px solid #e9edf3; border-radius: 12px;
          overflow: auto; max-height: 43vh; background: #fff;
        }
        .invoice-table { width: 100%; min-width: 1200px; border-collapse: separate; border-spacing: 0; }
        .invoice-table thead th {
          position: sticky; top: 0; z-index: 5; background: #f8fafc;
          border-bottom: 1px solid #e9edf3; color: #475467;
          font-size: .78rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .02em; padding: 10px 8px; white-space: nowrap;
        }
        .invoice-table tbody td {
          border-bottom: 1px solid #f1f3f7; padding: 8px;
          vertical-align: top; background: #fff;
        }
        .invoice-table tbody tr.row-hover td  { background: #faf7ff; }
        .invoice-table tbody tr.row-active td { background: #f4efff; }

        .invoice-line-total { font-weight: 700; color: #1f2937; white-space: nowrap; text-align: right; padding-top: 10px; }

        .invoice-stock-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe;
          border-radius: 999px; padding: 2px 8px; font-size: 11px; margin-top: 5px;
        }
        .invoice-muted-chip {
          display: inline-flex; align-items: center;
          background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb;
          border-radius: 999px; padding: 2px 8px; font-size: 11px; margin-top: 5px;
        }

        /* Stock warning highlight on qty inputs */
        .qty-input-warn {
          border-color: #f59e0b !important;
          background: #fffbeb !important;
        }

        /* Stock availability hint below qty inputs */
        .stock-hint {
          font-size: 10px; margin-top: 3px;
          display: flex; align-items: center; gap: 3px;
          justify-content: flex-end;
        }
        .stock-hint.ok     { color: #15803d; }
        .stock-hint.warn   { color: #b45309; }
        .stock-hint.danger { color: #b91c1c; }

        .icon-btn-modern {
          border: 1px solid #e5e7eb; background: #fff; width: 32px; height: 32px;
          border-radius: 8px; display: inline-flex; align-items: center;
          justify-content: center; transition: all .15s ease;
        }
        .icon-btn-modern:hover { transform: translateY(-1px); border-color: #cbd5e1; background: #f8fafc; }
        .icon-btn-add    { color: #15803d; border-color: #bbf7d0; background: #f0fdf4; }
        .icon-btn-remove { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }

        .invoice-summary-bar {
          position: sticky; bottom: 0; z-index: 8;
          background: rgba(255,255,255,.95); backdrop-filter: blur(6px);
          border: 1px solid #e9edf3; border-radius: 12px;
          padding: 10px 12px; margin-top: 10px;
        }
        .invoice-footer-bar {
          position: sticky; bottom: 0; z-index: 10; background: #fff;
          border-top: 1px solid #eef0f4; padding: 12px 16px; margin: 0 -16px;
        }
        .invoice-summary-strip {
          border: 1px solid #e9edf3; border-radius: 12px;
          background: #fbfcfe; padding: 10px 12px; margin-bottom: 12px;
        }
        .invoice-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .invoice-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 999px;
          border: 1px solid #e5e7eb; background: #f8fafc;
          color: #475467; font-size: 12px; font-weight: 600;
        }
      `}</style>

      {/* ── Header ── */}
      <Modal.Header closeButton>
        <div className="d-flex justify-content-between align-items-start w-100 gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <h2 className="page-title-modal mb-0">{titleText}</h2>
              <span className={`badge rounded-pill ${modeBadgeClass}`}>
                {isView ? "View" : isEdit ? "Edit" : "Create"}
              </span>
              {!!currentStatus && !isCreate && (
                <span className={`badge rounded-pill ${statusBadgeClass}`}>{statusLabel}</span>
              )}
            </div>
            <p className="page-subtitle-modal mb-0">{subtitleText}</p>
            {(isView || isEdit) && (
              <div className="small text-muted mt-1">
                {selectedCustomer?.name || selectedInvoice?.customer?.name || "-"} •{" "}
                {selectedBranchName !== "-" ? selectedBranchName : selectedInvoice?.branch?.name || "-"} •{" "}
                {formatDisplayDate(form.invoiceDate)}
              </div>
            )}
          </div>
          <div className="text-end me-3">
            <div className="px-3 py-2 rounded-3 border" style={{ background: "#f8fafc", minWidth: "220px" }}>
              <div className="fw-bold text-dark">Invoice No</div>
              <div className="small text-muted">{form.invoiceNo}</div>
            </div>
          </div>
        </div>
      </Modal.Header>

      {/* ── Body ── */}
      <Modal.Body>
        <form onSubmit={handleSubmit}>

          {/* Summary strip */}
          <div className="invoice-summary-strip">
            <div className="invoice-chip-row">
              <span className="invoice-chip"><i className="bi bi-upc-scan" />Invoice: {form.invoiceNo}</span>
              <span className="invoice-chip"><i className="bi bi-building" />Branch: {selectedBranchName}</span>
              <span className="invoice-chip"><i className="bi bi-person" />Customer: {selectedCustomer?.name || "Not selected"}</span>
              <span className="invoice-chip"><i className="bi bi-calendar-event" />Date: {formatDisplayDate(form.invoiceDate)}</span>
              {(isAdminOrDataEntry || isSalesRep) && (
                <span className="invoice-chip"><i className="bi bi-person-badge" />Sales Rep: {selectedSalesRepLabel}</span>
              )}
              {isSalesRep && (
                <span className="invoice-chip"><i className="bi bi-lock" />Sales Rep auto-filled</span>
              )}
              {selectedCustomer?.creditStatus && (
                <span className="invoice-chip"><i className="bi bi-shield-check" />Credit: {selectedCustomer.creditStatus}</span>
              )}
            </div>
          </div>

          {/* Warnings */}
          {!form.branch && !isView && (
            <div className="alert alert-info py-2 mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle" />
              <span>Select a branch and sales rep to load sales rep–specific items.</span>
            </div>
          )}
          {isCustomerBlocked && !isView && (
            <div className="alert alert-danger py-2 mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>Blocked customer selected — invoice cannot be created/updated.</span>
            </div>
          )}

          {/* Invoice details card */}
          <div className="invoice-section-card mb-3">
            <div className="invoice-section-title"><i className="bi bi-receipt-cutoff" />Invoice Details</div>
            <div className="row g-3">

              {/* Branch */}
              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select" isDisabled={isView} isClearable
                    options={branches.map((b) => ({ label: b.name, value: b._id }))}
                    value={form.branch ? { label: branches.find((b) => b._id === form.branch)?.name || "", value: form.branch } : null}
                    onChange={async (opt) => {
                      const branchId = opt ? opt.value : "";
                      setForm((p) => ({ ...p, branch: branchId, items: p.items.map(() => buildEmptyItemRow()) }));
                      setStockInfo({});
                      setItemsMaster([]);
                      if (branchId) {
                        const repId = isSalesRep ? loggedInSalesRepId : form.salesRep || null;
                        await loadAvailableItemsForBranch(branchId, repId);
                      }
                    }}
                    styles={selectStyles} menuPortalTarget={document.body} placeholder=""
                  />
                  <label>Branch</label>
                </div>
              </div>

              {/* Sales Rep */}
              {(isAdminOrDataEntry || isSalesRep) && (
                <div className="col-md-6">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView || isSalesRep}
                      isClearable={!isSalesRep}
                      options={
                        isAdminOrDataEntry
                          ? salesReps.map((sr) => ({ label: sr.name || sr.fullName || sr.email || "Sales Rep", value: sr._id }))
                          : [{ label: user?.name || "Sales Rep", value: loggedInSalesRepId }]
                      }
                      value={selectedSalesRepOption}
                      onChange={(opt) => {
                        const newRepId = opt ? opt.value : "";
                        setForm((p) => ({ ...p, salesRep: newRepId }));
                        if (form.branch) {
                          setStockInfo({});
                          setItemsMaster([]);
                          loadAvailableItemsForBranch(form.branch, newRepId || null);
                        }
                      }}
                      styles={selectStyles} menuPortalTarget={document.body} placeholder=""
                    />
                    <label>Sales Rep</label>
                  </div>
                  <small className="text-muted">
                    {isSalesRep ? "Auto-filled from your account." : "Select a Sales Rep."}
                  </small>
                </div>
              )}

              {/* Customer */}
              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select" isDisabled={isView} isClearable
                    options={customerOptions} value={selectedCustomerOption}
                    onChange={(opt) => {
                      if (opt?.creditStatus === "blocked") toast.error("This customer is BLOCKED from credit sales!");
                      setForm((p) => ({ ...p, customer: opt ? opt.value : "" }));
                    }}
                    styles={selectStyles} menuPortalTarget={document.body} placeholder=""
                  />
                  <label>Customer</label>
                </div>
                {selectedCustomer && (
                  <div className="mt-1">
                    <span className={`badge rounded-pill ${
                      isCustomerBlocked
                        ? "bg-danger-subtle text-danger-emphasis border border-danger-subtle"
                        : "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle"
                    }`}>
                      Credit Status: {selectedCustomer.creditStatus || "N/A"}
                    </span>
                  </div>
                )}
              </div>

              {/* Invoice date */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="date" className="form-control" id="invoiceDateInput"
                    value={form.invoiceDate} readOnly={isView}
                    onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))}
                  />
                  <label htmlFor="invoiceDateInput">Invoice Date</label>
                </div>
              </div>

              {/* Remarks */}
              <div className="col-12">
                <div className="form-floating">
                  <textarea
                    className="form-control" style={{ minHeight: "70px" }}
                    value={form.remarks} readOnly={isView} name="remarks" placeholder="Remarks"
                    onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  />
                  <label>Remarks (Optional)</label>
                </div>
              </div>
            </div>
          </div>

          {/* Items card */}
          <div className="invoice-section-card mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="invoice-section-title mb-0"><i className="bi bi-box-seam" />Items & Pricing</div>
            </div>

            <div className="invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: "28%" }}>Item</th>
                    <th className="text-end" style={{ width: "9%" }}>Base Qty</th>
                    <th className="text-end" style={{ width: "9%" }}>Primary Qty</th>
                    <th className="text-end" style={{ width: "12%" }}>Selling Price (Base)</th>
                    <th className="text-end" style={{ width: "12%" }}>Selling Price (Primary)</th>
                    <th className="text-end" style={{ width: "10%" }}>Discount</th>
                    <th className="text-end" style={{ width: "12%" }}>Line Total</th>
                    {!isView && <th className="text-center" style={{ width: "8%" }}>Action</th>}
                  </tr>
                </thead>

                <tbody>
                  {form.items.map((row, i) => {
                    const meta        = row.item ? itemsMaster.find((it) => it.value === row.item) : null;
                    const hasBaseUom  = !!meta?.baseUom;
                    const stockMeta   = row.item ? stockInfo[row.item] : null;
                    const lineTotal   = Number(row.lineTotal || 0);

                    // ── Per-field remaining stock hints ──────────────────────
                    const runningBalance  = Number(meta?.runningBalance ?? 0);
                    const factorToBase    = Number(meta?.factorToBase   ?? 1);
                    const maxPrimary      = Number(meta?.qtyOnHand?.primaryQty ?? 0);

                    const enteredPrimary  = Number(row.primaryQty || 0);
                    const enteredBase     = Number(row.baseQty    || 0);

                    // Remaining base units after accounting for both qtys entered
                    const usedByPrimary    = enteredPrimary * factorToBase;
                    const remainingBase    = runningBalance - usedByPrimary - enteredBase;

                    // Remaining primary packs = min of:
                    //   a) hard cap from whole-pack stock (qtyOnHand.primaryQty)
                    //   b) how many full packs still fit in the running balance after base qty is consumed
                    const remainingByBalance = hasBaseUom
                      ? Math.floor((runningBalance - enteredBase) / factorToBase) - enteredPrimary
                      : maxPrimary - enteredPrimary;
                    const remainingPrimary   = hasBaseUom
                      ? Math.min(maxPrimary - enteredPrimary, remainingByBalance)
                      : maxPrimary - enteredPrimary;

                    const primaryWarn = meta && remainingPrimary <= 0 && enteredPrimary > 0;
                    const baseWarn    = meta && hasBaseUom && remainingBase <= 0 && enteredBase > 0;

                    const rowClass = [
                      hoveredRowIndex === i ? "row-hover"  : "",
                      !isView && hoveredRowIndex === i ? "row-active" : "",
                    ].join(" ").trim();

                    return (
                      <tr
                        key={i} className={rowClass}
                        onMouseEnter={() => setHoveredRowIndex(i)}
                        onMouseLeave={() => setHoveredRowIndex(null)}
                      >
                        {/* Item select */}
                        <td>
                          <Select
                            isDisabled={isView || !form.branch}
                            options={itemsMaster}
                            value={row.item ? itemsMaster.find((it) => it.value === row.item) || null : null}
                            onChange={(opt) => {
                              if (isView) return;
                              const sel = itemsMaster.find((it) => it.value === opt?.value);
                              if (!sel) return;
                              updateItemRow(i, {
                                item:               opt.value,
                                sellingPriceBase:    Number(sel.sellingPriceBase    || 0),
                                sellingPricePrimary: Number(sel.sellingPricePrimary || 0),
                                baseQty:            0,
                                primaryQty:         0,
                                discountPerUnit:    0,
                              });
                            }}
                            styles={{
                              ...selectStyles,
                              control: (base, state) => ({ ...selectStyles.control(base, state), minHeight: "40px", fontSize: "0.85rem" }),
                            }}
                            menuPortalTarget={document.body}
                            placeholder={form.branch ? "Select Item" : "Select a branch first"}
                          />

                          {row.item && stockMeta?.qtyDisplay && (
                            <div className="invoice-stock-chip">
                              <i className="bi bi-box" />
                              Stock: {stockMeta.qtyDisplay}
                            </div>
                          )}
                          {row.item && !hasBaseUom && (
                            <div className="invoice-muted-chip">
                              <i className="bi bi-info-circle" />
                              Primary-only item
                            </div>
                          )}
                        </td>

                        {/* Base Qty */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            className={`form-control text-end ${!hasBaseUom ? "" : baseWarn ? "qty-input-warn" : ""}`}
                            value={hasBaseUom ? (row.baseQty || "") : ""}
                            readOnly={isView}
                            disabled={isView || !hasBaseUom}
                            placeholder={hasBaseUom ? "0" : "N/A"}
                            style={!hasBaseUom ? { backgroundColor: "#f3f4f6" } : {}}
                            onChange={(e) => hasBaseUom && handleQtyChange(i, "baseQty", e.target.value)}
                          />
                          {hasBaseUom && meta && !isView && (
                            <div className={`stock-hint justify-content-end ${remainingBase > 5 ? "ok" : remainingBase > 0 ? "warn" : "danger"}`}>
                              <i className={`bi ${remainingBase > 0 ? "bi-check-circle" : "bi-exclamation-circle"}`} />
                              {remainingBase >= 0 ? `${remainingBase} ${meta.baseUom} left` : "Exceeds stock"}
                            </div>
                          )}
                        </td>

                        {/* Primary Qty */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            className={`form-control text-end ${meta && primaryWarn ? "qty-input-warn" : ""}`}
                            value={row.primaryQty || ""}
                            readOnly={isView}
                            placeholder="0"
                            onChange={(e) => handleQtyChange(i, "primaryQty", e.target.value)}
                          />
                          {meta && !isView && (
                            <div className={`stock-hint justify-content-end ${remainingPrimary > 2 ? "ok" : remainingPrimary > 0 ? "warn" : "danger"}`}>
                              <i className={`bi ${remainingPrimary > 0 ? "bi-check-circle" : "bi-exclamation-circle"}`} />
                              {remainingPrimary >= 0 ? `${remainingPrimary} ${meta.primaryUom} left` : "Exceeds stock"}
                            </div>
                          )}
                        </td>

                        {/* Selling Price Base */}
                        <td>
                          <input
                            type="number"
                            className="form-control text-end"
                            value={hasBaseUom ? (row.sellingPriceBase || "") : ""}
                            readOnly={isView}
                            disabled={isView || !hasBaseUom}
                            placeholder={hasBaseUom ? "0" : "N/A"}
                            style={!hasBaseUom ? { backgroundColor: "#f3f4f6" } : {}}
                            onChange={(e) => updateItemRow(i, { sellingPriceBase: Number(e.target.value || 0) })}
                          />
                        </td>

                        {/* Selling Price Primary */}
                        <td>
                          <input
                            type="number"
                            className="form-control text-end"
                            value={row.sellingPricePrimary || ""}
                            readOnly={isView}
                            placeholder="0"
                            onChange={(e) => updateItemRow(i, { sellingPricePrimary: Number(e.target.value || 0) })}
                          />
                        </td>

                        {/* Discount */}
                        <td>
                          <input
                            type="number"
                            className="form-control text-end"
                            value={row.discountPerUnit || ""}
                            readOnly={isView}
                            placeholder="0"
                            onChange={(e) => updateItemRow(i, { discountPerUnit: Number(e.target.value || 0) })}
                          />
                        </td>

                        {/* Line total */}
                        <td className="invoice-line-total">{formatCurrency(lineTotal)}</td>

                        {/* Row action */}
                        {!isView && (
                          <td className="text-center">
                            <div className="d-flex justify-content-center gap-1">
                              <button type="button" className="icon-btn-modern icon-btn-add" title="Add row" onClick={addItem}>
                                <i className="bi bi-plus-lg" />
                              </button>
                              <button
                                type="button" className="icon-btn-modern icon-btn-remove" title="Remove row"
                                onClick={() => removeItem(i)}
                                disabled={form.items.length === 1}
                                style={form.items.length === 1 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
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
            <div className="invoice-summary-bar">
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

          {/* Footer */}
          <div className="invoice-footer-bar">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                {!isView && canDelete && (
                  <Button type="button" className="delete-btn-modal" onClick={handleDelete} disabled={loading}>
                    <i className="bi bi-trash me-2" />Delete Invoice
                  </Button>
                )}
              </div>
              <div className="d-flex align-items-center gap-2">
                {!isView && (
                  <Button type="submit" className="action-btn-modal" disabled={loading}>
                    {loading ? (
                      <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />{isEdit ? "Updating..." : "Creating..."}</>
                    ) : isEdit ? (
                      <><i className="bi bi-check2-circle me-2" />Update Invoice</>
                    ) : (
                      <><i className="bi bi-plus-circle me-2" />Create Invoice</>
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

export default SalesInvoiceCreateModal;