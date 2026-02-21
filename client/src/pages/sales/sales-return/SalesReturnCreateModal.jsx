// src/pages/sales/SalesReturnCreateModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

import {
  createSalesReturn,
  listSalesInvoices,
  getSalesInvoice,
} from "../../../lib/api/sales.api";
import { listBranches } from "../../../lib/api/settings.api";
import { getCustomers, getSalesReps } from "../../../lib/api/users.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

// Helpers
function generateReturnNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `SRET-${yyyy}-${mm}-${dd}-${rand}`;
}

function toTotalBase({ primary = 0, base = 0, factorToBase = 1 }) {
  const f = Math.max(1, Math.trunc(Number(factorToBase) || 1));
  const p = Math.trunc(Number(primary) || 0);
  const b = Math.trunc(Number(base) || 0);
  return Math.max(0, p * f + b);
}

function splitFromTotalBase(totalBase, factorToBase = 1) {
  const f = Math.max(1, Math.trunc(Number(factorToBase) || 1));
  const t = Math.max(0, Math.trunc(Number(totalBase) || 0));
  return {
    primary: Math.floor(t / f),
    base: t % f,
    totalBase: t,
  };
}

const buildEmptyForm = () => ({
  returnNo: generateReturnNo(),
  branch: "",
  customer: "",
  salesRep: "",
  originalInvoice: "",
  returnDate: new Date().toISOString().split("T")[0],
  items: [],
  remarks: "",
});

const getInvoiceSalesRepId = (inv) =>
  inv?.salesRep?._id || inv?.salesRep || inv?.salesRepId || "";

function getInvoiceLineSoldSplit(line) {
  const legacyQty = Number(line.qty ?? 0);
  const baseQty = Number(line.baseQty ?? 0);
  const primaryQty = Number(line.primaryQty ?? 0);

  if (baseQty > 0 || primaryQty > 0) {
    return { base: baseQty, primary: primaryQty };
  }

  if (legacyQty > 0) {
    return { base: 0, primary: legacyQty };
  }

  return { base: 0, primary: 0 };
}

function getReturnLineSplit(it) {
  const baseFromInvoice = Number(it.qtyReturnedBase ?? 0);
  const primaryFromInvoice = Number(it.qtyReturnedPrimary ?? 0);

  const baseFromReturn = Number(it.qtyReturnBase ?? it.baseQtyReturn ?? 0);
  const primaryFromReturn = Number(
    it.qtyReturnPrimary ??
      it.primaryQtyReturn ??
      it.qtyReturn ??
      it.qtyReturned ??
      0
  );

  return {
    base: baseFromInvoice || baseFromReturn,
    primary: primaryFromInvoice || primaryFromReturn,
  };
}

function formatQtySplit(base, primary, baseUom, primaryUom) {
  const parts = [];
  if (Number(primary) > 0) parts.push(`${primary} ${primaryUom || ""}`.trim());
  if (Number(base) > 0) parts.push(`${base} ${baseUom || ""}`.trim());
  if (!parts.length) return "0";
  return parts.join(" + ");
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
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

// IMPORTANT: keep this aligned with backend interpretation.
// discountPerUnit is applied per selected unit count (base + primary).
function computeReturnLineTotal(row, baseQty, primaryQty) {
  const priceBase = Number(row.sellingPriceBase || 0);
  const pricePrimary = Number(row.sellingPricePrimary || 0);
  const discount = Number(row.discountPerUnit || 0);

  const gross = baseQty * priceBase + primaryQty * pricePrimary;
  const unitCount = baseQty + primaryQty;
  const discountValue = discount * unitCount;

  return Math.max(0, gross - discountValue);
}

const statusPillClass = (status) => {
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
};

const SalesReturnCreateModal = ({
  show,
  mode = "create",
  selectedReturn,
  onClose,
  onSuccess,
  onViewInvoice,
}) => {
  const isView = mode === "view";
  const isCreate = mode === "create";
  const isEdit = mode === "edit"; // future-friendly

  // RBAC
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

  // Local State
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);

  const [allInvoices, setAllInvoices] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [sourceInvoice, setSourceInvoice] = useState(null);
  const [totalValue, setTotalValue] = useState(0);
  const [form, setForm] = useState(buildEmptyForm);

  // Access safety for VIEW mode
  const returnSalesRepId =
    selectedReturn?.salesRep?._id ||
    selectedReturn?.salesRep ||
    selectedReturn?.originalInvoice?.salesRep?._id ||
    selectedReturn?.originalInvoice?.salesRep ||
    "";

  const hasViewAccess =
    !isSalesRep ||
    !loggedInSalesRepId ||
    String(returnSalesRepId) === String(loggedInSalesRepId);

  // Customer / SalesRep options
  const customerOptions = useMemo(
    () =>
      (customers || []).map((c) => ({
        value: c._id,
        label: c.creditStatus ? `${c.name} — ${c.creditStatus}` : c.name,
        creditStatus: c.creditStatus,
      })),
    [customers]
  );

  const selectedCustomerOption =
    customerOptions.find((opt) => String(opt.value) === String(form.customer)) ||
    null;

  const salesRepOptions = useMemo(() => {
    if (isAdminOrDataEntry) {
      return (salesReps || []).map((sr) => ({
        label: sr.name || sr.fullName || sr.email || "Sales Rep",
        value: sr._id,
      }));
    }
    if (isSalesRep) {
      return [{ label: user?.name || "Sales Rep", value: loggedInSalesRepId || "" }];
    }
    return [];
  }, [isAdminOrDataEntry, isSalesRep, salesReps, user?.name, loggedInSalesRepId]);

  const selectedSalesRepOption = useMemo(() => {
    if (!form.salesRep) return null;
    if (isSalesRep) return { label: user?.name || "Sales Rep", value: form.salesRep };
    return salesRepOptions.find((o) => String(o.value) === String(form.salesRep)) || null;
  }, [form.salesRep, isSalesRep, user?.name, salesRepOptions]);

  // UI stats
  const returnStats = useMemo(() => {
    const rows = form.items || [];
    const returnableLines = rows.filter((r) => Number(r.remainingTotalBase || 0) > 0).length;
    const exhaustedLines = rows.filter((r) => Number(r.remainingTotalBase || 0) <= 0).length;
    const selectedLines = rows.filter(
      (r) => Number(r.returnBaseQty || 0) > 0 || Number(r.returnPrimaryQty || 0) > 0
    ).length;

    return {
      totalLines: rows.length,
      returnableLines,
      exhaustedLines,
      selectedLines,
    };
  }, [form.items]);

  const hasAtLeastOneReturnQty = useMemo(
    () =>
      (form.items || []).some(
        (i) => Number(i.returnBaseQty || 0) > 0 || Number(i.returnPrimaryQty || 0) > 0
      ),
    [form.items]
  );

  // Filter invoices by role / selected SR
  const filterInvoicesByRole = (list, salesRepId) => {
    let data = Array.isArray(list) ? [...list] : [];

    if (isSalesRep && loggedInSalesRepId) {
      data = data.filter(
        (inv) => String(getInvoiceSalesRepId(inv)) === String(loggedInSalesRepId)
      );
    }

    if (isAdminOrDataEntry && salesRepId) {
      data = data.filter(
        (inv) => String(getInvoiceSalesRepId(inv)) === String(salesRepId)
      );
    }

    return data;
  };

  // Load base data
  useEffect(() => {
    if (!show) return;

    (async () => {
      setLoading(true);
      try {
        const reqs = [listBranches(), getCustomers()];
        if (isAdminOrDataEntry) reqs.push(getSalesReps());

        const res = await Promise.all(reqs);
        const brRes = res[0];
        const custRes = res[1];
        const srRes = isAdminOrDataEntry ? res[2] : null;

        setBranches(brRes?.data || brRes || []);
        setCustomers(custRes || []);
        setSalesReps(srRes?.data || srRes || []);
      } catch (err) {
        console.error("❌ Failed to load initial data:", err);
        toast.error("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    })();
  }, [show, isAdminOrDataEntry]);

  // Reset form for CREATE
  useEffect(() => {
    if (!show) return;
    if (!isCreate) return;

    setForm({
      ...buildEmptyForm(),
      salesRep: isSalesRep ? loggedInSalesRepId : "",
    });

    setAllInvoices([]);
    setInvoices([]);
    setSourceInvoice(null);
    setTotalValue(0);
  }, [show, isCreate, isSalesRep, loggedInSalesRepId]);

  useEffect(() => {
    if (!show) return;
    if (isSalesRep && loggedInSalesRepId) {
      setForm((p) => ({ ...p, salesRep: loggedInSalesRepId }));
    }
  }, [show, isSalesRep, loggedInSalesRepId]);

  // Load approved invoices
  useEffect(() => {
    if (!show || !isCreate) return;

    if (!form.branch || !form.customer) {
      setAllInvoices([]);
      setInvoices([]);
      setSourceInvoice(null);
      setForm((p) => ({ ...p, originalInvoice: "", items: [] }));
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const invoiceList = await listSalesInvoices({
          branch: form.branch,
          customer: form.customer,
          status: "approved",
          limit: 200,
        });

        const raw = invoiceList || [];
        setAllInvoices(raw);
        setInvoices(filterInvoicesByRole(raw, form.salesRep));
      } catch (err) {
        console.error("❌ Failed to load approved invoices:", err);
        toast.error("Failed to load approved invoices for this customer");
        setAllInvoices([]);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, isCreate, form.branch, form.customer]);

  // Refilter when sales rep changes
  useEffect(() => {
    if (!show || !isCreate) return;

    const filtered = filterInvoicesByRole(allInvoices, form.salesRep);
    setInvoices(filtered);

    const stillValid = filtered.some(
      (inv) => String(inv._id) === String(form.originalInvoice)
    );

    if (!stillValid) {
      setSourceInvoice(null);
      setForm((p) => ({ ...p, originalInvoice: "", items: [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.salesRep, allInvoices, show, isCreate]);

  // Build already-returned map
  const buildAlreadyReturnedMap = (invoice) => {
    const map = new Map();
    if (!invoice?.returns) return map;

    invoice.returns.forEach((ret) => {
      (ret.items || []).forEach((it) => {
        const key = String(it.item?._id || it.item);
        const { base, primary } = getReturnLineSplit(it);

        const prev = map.get(key) || { base: 0, primary: 0 };
        map.set(key, {
          base: prev.base + base,
          primary: prev.primary + primary,
        });
      });
    });

    return map;
  };

  // Load invoice as source
  const loadInvoiceAsSource = async (invoiceId) => {
    if (!invoiceId) {
      setSourceInvoice(null);
      setForm((p) => ({ ...p, originalInvoice: "", items: [] }));
      return;
    }

    try {
      setLoading(true);
      const invoice = await getSalesInvoice(invoiceId);

      if (!invoice) {
        toast.error("Original invoice not found");
        setSourceInvoice(null);
        setForm((p) => ({ ...p, originalInvoice: "", items: [] }));
        return;
      }

      if (isSalesRep && loggedInSalesRepId) {
        const invSrId = getInvoiceSalesRepId(invoice);
        if (String(invSrId) !== String(loggedInSalesRepId)) {
          toast.error("You don’t have permission to return this invoice.");
          setSourceInvoice(null);
          setForm((p) => ({ ...p, originalInvoice: "", items: [] }));
          return;
        }
      }

      const returnedMap = buildAlreadyReturnedMap(invoice);

      const mappedItems = (invoice.items || []).map((line) => {
        const itemId = line.item?._id || line.item;

        const { base: soldBase, primary: soldPrimary } = getInvoiceLineSoldSplit(line);
        const retSplit = returnedMap.get(String(itemId)) || { base: 0, primary: 0 };

        const baseUom =
          line.baseUom || line.item?.baseUom || line.item?.baseUomName || "";
        const primaryUom =
          line.primaryUom || line.item?.primaryUom || line.item?.primaryUomName || "";

        const factorToBase =
          Number(line.factorToBase) || Number(line.item?.factorToBase) || 1;

        const invoiceTotalBase = toTotalBase({
          primary: soldPrimary,
          base: soldBase,
          factorToBase,
        });

        const alreadyReturnedTotalBase = toTotalBase({
          primary: retSplit.primary,
          base: retSplit.base,
          factorToBase,
        });

        const remainingTotalBase = Math.max(0, invoiceTotalBase - alreadyReturnedTotalBase);
        const remainingSplit = splitFromTotalBase(remainingTotalBase, factorToBase);

        const priceBase = Number(line.sellingPriceBase ?? 0);
        const pricePrimary = Number(line.sellingPricePrimary ?? 0);
        const discount = Number(line.discountPerUnit ?? 0);

        const soldLabel = formatQtySplit(soldBase, soldPrimary, baseUom, primaryUom);
        const remainingLabel = formatQtySplit(
          remainingSplit.base,
          remainingSplit.primary,
          baseUom,
          primaryUom
        );

        const hasAnyReturns = retSplit.base > 0 || retSplit.primary > 0;
        const isFullyReturned = remainingTotalBase <= 0;

        return {
          itemId,
          itemName: line.item?.name || "",
          itemCode: line.item?.itemCode || "",

          invoiceBaseQty: soldBase,
          invoicePrimaryQty: soldPrimary,

          alreadyReturnedBaseQty: retSplit.base,
          alreadyReturnedPrimaryQty: retSplit.primary,

          maxReturnBaseQty: remainingSplit.base,
          maxReturnPrimaryQty: remainingSplit.primary,

          returnBaseQty: 0,
          returnPrimaryQty: 0,

          sellingPriceBase: priceBase,
          sellingPricePrimary: pricePrimary,
          discountPerUnit: discount,

          baseUom,
          primaryUom,
          factorToBase,

          soldLabel,
          remainingTotalBase,
          remainingLabel,
          hasAnyReturns,
          isFullyReturned,

          lineTotal: 0,
        };
      });

      setSourceInvoice(invoice);
      setForm((p) => ({
        ...p,
        originalInvoice: invoice._id,
        ...(isAdminOrDataEntry && invoice?.salesRep?._id
          ? { salesRep: invoice.salesRep._id }
          : {}),
        items: mappedItems,
      }));
    } catch (err) {
      console.error("❌ Failed to load original invoice details:", err);
      toast.error("Failed to load original invoice details");
      setSourceInvoice(null);
      setForm((p) => ({ ...p, originalInvoice: "", items: [] }));
    } finally {
      setLoading(false);
    }
  };

  // VIEW mode populate
  useEffect(() => {
    if (!show || !isView || !selectedReturn) return;

    const originalInv =
      typeof selectedReturn.originalInvoice === "object"
        ? selectedReturn.originalInvoice
        : null;

    const buildReturnedMap = (inv) => {
      const map = new Map();
      if (!inv?.returns) return map;

      inv.returns.forEach((ret) => {
        (ret.items || []).forEach((it) => {
          const key = String(it.item?._id || it.item);
          const { base, primary } = getReturnLineSplit(it);

          const prev = map.get(key) || { base: 0, primary: 0 };
          map.set(key, {
            base: prev.base + base,
            primary: prev.primary + primary,
          });
        });
      });

      return map;
    };

    const returnedMap = buildReturnedMap(originalInv);

    const mappedItems = (selectedReturn.items || []).map((line) => {
      const itemId = line.item?._id || line.item;
      const priceBase = Number(line.sellingPriceBase ?? 0);
      const pricePrimary = Number(line.sellingPricePrimary ?? 0);
      const discount = Number(line.discountPerUnit ?? 0);

      const retSplit = getReturnLineSplit(line);
      const invLine = originalInv?.items?.find(
        (x) => String(x.item?._id || x.item) === String(itemId)
      );

      const { base: soldBase, primary: soldPrimary } = invLine
        ? getInvoiceLineSoldSplit(invLine)
        : { base: 0, primary: 0 };

      const totalReturnedForItem = returnedMap.get(String(itemId)) || {
        base: 0,
        primary: 0,
      };

      const baseUom =
        invLine?.baseUom ||
        invLine?.item?.baseUom ||
        invLine?.item?.baseUomName ||
        line.baseUom ||
        "";
      const primaryUom =
        invLine?.primaryUom ||
        invLine?.item?.primaryUom ||
        invLine?.item?.primaryUomName ||
        line.primaryUom ||
        "";

      const factorToBase =
        Number(invLine?.factorToBase) ||
        Number(invLine?.item?.factorToBase) ||
        Number(line.factorToBase) ||
        1;

      const soldTotalBase = toTotalBase({
        primary: soldPrimary,
        base: soldBase,
        factorToBase,
      });

      const returnedTotalBase = toTotalBase({
        primary: totalReturnedForItem.primary,
        base: totalReturnedForItem.base,
        factorToBase,
      });

      const remainingTotalBase = Math.max(0, soldTotalBase - returnedTotalBase);
      const remainingSplit = splitFromTotalBase(remainingTotalBase, factorToBase);

      const lineTotal =
        Number(line.totalSellingValue) ||
        computeReturnLineTotal(line, retSplit.base, retSplit.primary);

      return {
        itemId,
        itemName: line.item?.name || "",
        itemCode: line.item?.itemCode || "",

        invoiceBaseQty: soldBase,
        invoicePrimaryQty: soldPrimary,

        alreadyReturnedBaseQty: totalReturnedForItem.base,
        alreadyReturnedPrimaryQty: totalReturnedForItem.primary,

        maxReturnBaseQty: remainingSplit.base,
        maxReturnPrimaryQty: remainingSplit.primary,

        returnBaseQty: retSplit.base,
        returnPrimaryQty: retSplit.primary,

        sellingPriceBase: priceBase,
        sellingPricePrimary: pricePrimary,
        discountPerUnit: discount,

        baseUom,
        primaryUom,
        factorToBase,

        soldLabel: formatQtySplit(soldBase, soldPrimary, baseUom, primaryUom),
        remainingTotalBase,
        remainingLabel: formatQtySplit(
          remainingSplit.base,
          remainingSplit.primary,
          baseUom,
          primaryUom
        ),
        hasAnyReturns:
          Number(totalReturnedForItem.base) > 0 || Number(totalReturnedForItem.primary) > 0,
        isFullyReturned: remainingTotalBase <= 0,

        lineTotal,
      };
    });

    const returnDate = selectedReturn.returnDate
      ? selectedReturn.returnDate.split("T")[0]
      : new Date().toISOString().split("T")[0];

    setForm({
      returnNo: selectedReturn.returnNo || generateReturnNo(),
      branch: selectedReturn.branch?._id || "",
      customer: selectedReturn.customer?._id || "",
      salesRep:
        originalInv?.salesRep?._id ||
        originalInv?.salesRep ||
        selectedReturn?.salesRep?._id ||
        selectedReturn?.salesRep ||
        "",
      originalInvoice: originalInv?._id || "",
      returnDate,
      items: mappedItems,
      remarks: selectedReturn.remarks || "",
    });

    const total =
      typeof selectedReturn.totalReturnValue === "number"
        ? selectedReturn.totalReturnValue
        : mappedItems.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);

    setTotalValue(total);
    setSourceInvoice(originalInv);
  }, [show, isView, selectedReturn]);

  // Access denied view
  if (isView && show && selectedReturn && !hasViewAccess) {
    return (
      <Modal
        show={show}
        onHide={onClose}
        centered
        backdrop="static"
        dialogClassName="sales-return-create-modal"
      >
        <Modal.Header closeButton>
          <h5 className="mb-0">Access denied</h5>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted">You don’t have permission to view this sales return.</div>
          <div className="text-end mt-4">
            <Button className="action-btn-modal" onClick={onClose}>
              Close
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  // Recalculate total
  useEffect(() => {
    const total = (form.items || []).reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);
    setTotalValue(total);
  }, [form.items]);

  // Select styles
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
    singleValue: (base) => ({ ...base, color: "#374151" }),
    menu: (base) => ({ ...base, zIndex: 9999, borderRadius: 10, overflow: "hidden" }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#f3ecff" : "#fff",
      color: "#111827",
      cursor: "pointer",
      fontSize: "0.9rem",
    }),
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return onClose?.();

    if (!form.branch || !form.customer || !form.originalInvoice) {
      toast.warning("Please select Branch, Customer, and Original Invoice before saving.");
      return;
    }

    if (!form.items.length) {
      toast.warning("No items available from the selected invoice.");
      return;
    }

    const validLines = form.items.filter((i) => {
      const base = Number(i.returnBaseQty || 0);
      const primary = Number(i.returnPrimaryQty || 0);
      return base > 0 || primary > 0;
    });

    if (!validLines.length) {
      toast.warning("Please enter at least one return quantity (Base or Primary).");
      return;
    }

    const hasInvalidLines = validLines.some((i) => {
      const base = Number(i.returnBaseQty || 0);
      const primary = Number(i.returnPrimaryQty || 0);
      const priceBase = Number(i.sellingPriceBase || 0);
      const pricePrimary = Number(i.sellingPricePrimary || 0);

      if (base > 0 && priceBase <= 0) return true;
      if (primary > 0 && pricePrimary <= 0) return true;
      return false;
    });

    if (hasInvalidLines) {
      toast.warning(
        "Please ensure each non-zero return quantity has a selling price for that UOM."
      );
      return;
    }

    const payloadItems = validLines.map((i) => ({
      item: i.itemId,
      qtyReturnBase: Number(i.returnBaseQty || 0),
      qtyReturnPrimary: Number(i.returnPrimaryQty || 0),
      sellingPriceBase:
        Number(i.sellingPriceBase || 0) > 0 ? Number(i.sellingPriceBase || 0) : null,
      sellingPricePrimary:
        Number(i.sellingPricePrimary || 0) > 0 ? Number(i.sellingPricePrimary || 0) : null,
      discountPerUnit:
        i.discountPerUnit === "" ||
        i.discountPerUnit == null ||
        Number(i.discountPerUnit) === 0
          ? null
          : Number(i.discountPerUnit),
    }));

    const payload = {
      returnNo: form.returnNo,
      branch: form.branch,
      customer: form.customer,
      originalInvoice: form.originalInvoice || null,
      returnDate: form.returnDate,
      items: payloadItems,
      remarks: form.remarks,
      totalReturnValue: totalValue,
      // NOTE: Not sending salesRep in payload to avoid backend validation issues
    };

    try {
      setLoading(true);
      const res = await createSalesReturn(payload);

      toast.success(
        res.message ||
          `Sales Return ${res.salesReturn?.returnNo || form.returnNo} created successfully`
      );

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error("❌ Failed to save Sales Return:", err);
      toast.error(err?.response?.data?.message || "Failed to save Sales Return");
    } finally {
      setLoading(false);
    }
  };

  // Labels / derived
  const titleText = isView ? "View Sales Return" : "Create Sales Return";
  const subtitleText = isView
    ? "View all recorded details of this sales return."
    : "Record customer sales returns against existing invoices.";

  const selectedBranchObj = branches.find((b) => b._id === form.branch);
  const selectedInvoiceObj =
    invoices.find((inv) => inv._id === form.originalInvoice) || sourceInvoice || null;

  const modeBadgeClass = isView
    ? "bg-light text-dark border"
    : "bg-success-subtle text-success-emphasis border border-success-subtle";

  const currentStatus = selectedReturn?.status || (isCreate ? "draft" : "");
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

  const statusBadgeClass =
    currentStatus === "approved"
      ? "bg-success-subtle text-success-emphasis border border-success-subtle"
      : currentStatus === "cancelled"
      ? "bg-danger-subtle text-danger-emphasis border border-danger-subtle"
      : "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";

  return (
    <>
      <style>{`
        .sales-return-create-modal {
          max-width: 96vw !important;
          width: 96vw;
        }
        .sales-return-create-modal .modal-dialog {
          max-width: 96vw !important;
          width: 96vw !important;
        }
        .sales-return-create-modal .modal-content {
          height: 92vh;
          border-radius: 16px;
          overflow: hidden;
        }
        .sales-return-create-modal .modal-header {
          border-bottom: 1px solid #eef0f4;
          padding: 14px 18px;
          background: rgb(25, 25, 25);
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .sales-return-create-modal .modal-body {
          background: #f8fafc;
          overflow: auto;
          padding: 14px 16px 0 16px;
        }
        .invoice-section-card {
          background: #fff;
          border: 1px solid #e9edf3;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
        }
        .invoice-section-title {
          font-size: 0.86rem;
          font-weight: 700;
          color: #475467;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .return-table-wrap {
          border: 1px solid #e9edf3;
          border-radius: 12px;
          overflow: auto;
          max-height: 43vh;
          background: #fff;
        }
        .return-table {
          width: 100%;
          min-width: 1320px;
          border-collapse: separate;
          border-spacing: 0;
        }
        .return-table thead th {
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
        .return-table tbody td {
          border-bottom: 1px solid #f1f3f7;
          padding: 8px;
          vertical-align: top;
          background: #fff;
        }
        .return-table tbody tr:hover td {
          background: #faf7ff;
        }
        .sr-row-disabled td {
          background: #fafafa !important;
          opacity: 0.8;
        }
        .invoice-muted-chip {
          display: inline-flex;
          align-items: center;
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          margin-top: 5px;
          margin-right: 6px;
        }
        .invoice-warning-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          margin-top: 5px;
        }
        .invoice-summary-bar {
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
        .invoice-footer-bar {
          position: sticky;
          bottom: 0;
          z-index: 10;
          background: #fff;
          border-top: 1px solid #eef0f4;
          padding: 12px 16px;
          margin: 0 -16px;
        }
        .sr-stat-inline {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-size: 12px;
          color: #374151;
        }
        .sr-link-btn {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1d4ed8;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .sr-link-btn:hover {
          background: #dbeafe;
        }
      `}</style>

      <Modal
        show={show}
        onHide={onClose}
        centered
        backdrop="static"
        dialogClassName="sales-return-create-modal"
      >
        <Modal.Header closeButton>
          <div className="d-flex justify-content-between align-items-start w-100 gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h2 className="page-title-modal mb-0">{titleText}</h2>
                <span className={`badge rounded-pill ${modeBadgeClass}`}>
                  {isView ? "View" : "Create"}
                </span>
                {!!currentStatus && isView && (
                  <span className={`badge rounded-pill ${statusBadgeClass}`}>{statusLabel}</span>
                )}
              </div>
              <p className="page-subtitle-modal mb-0">{subtitleText}</p>
              <div className="small text-muted mt-1">
                {selectedCustomerOption?.label?.split(" — ")[0] || selectedReturn?.customer?.name || "-"} •{" "}
                {selectedBranchObj?.name || selectedReturn?.branch?.name || "-"} •{" "}
                {formatDisplayDate(form.returnDate)}
              </div>
            </div>

            <div className="text-end me-3">
              <div
                className="px-3 py-2 rounded-3 border"
                style={{ background: "#f8fafc", minWidth: "220px" }}
              >
                <div className="fw-bold text-dark">Return No</div>
                <div className="small text-muted">{form.returnNo}</div>
                {selectedInvoiceObj && (
                  <div className="small text-muted mt-1">Invoice: {selectedInvoiceObj.invoiceNo}</div>
                )}
              </div>
            </div>
          </div>
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={handleSubmit}>
            {/* Top helper warnings */}
            {!form.branch && !isView && (
              <div className="alert alert-info py-2 mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-info-circle" />
                <span>Select branch and customer to load approved invoices.</span>
              </div>
            )}

            {isCreate && form.branch && form.customer && !invoices.length && !loading && (
              <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle" />
                <span>
                  No approved invoices found for this branch & customer
                  {isAdminOrDataEntry && form.salesRep ? " (for selected Sales Rep)" : ""}.
                </span>
              </div>
            )}

            {/* Invoice Details Section */}
            <div className="invoice-section-card mb-3">
              <div className="invoice-section-title">
                <i className="bi bi-arrow-counterclockwise" />
                Return Details
              </div>

              <div className="row g-3">
                {/* Branch */}
                <div className="col-md-4">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView || !isCreate}
                      isClearable
                      options={branches.map((b) => ({ label: b.name, value: b._id }))}
                      value={
                        form.branch
                          ? { label: selectedBranchObj?.name || "", value: form.branch }
                          : null
                      }
                      onChange={(opt) => {
                        const branchId = opt ? opt.value : "";
                        setForm((p) => ({
                          ...p,
                          branch: branchId,
                          originalInvoice: "",
                          items: [],
                        }));
                        setAllInvoices([]);
                        setInvoices([]);
                        setSourceInvoice(null);
                      }}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder=""
                    />
                    <label>Branch</label>
                  </div>
                </div>

                {/* Customer */}
                <div className="col-md-4">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView || !isCreate}
                      isClearable
                      options={customerOptions}
                      value={selectedCustomerOption}
                      onChange={(opt) => {
                        const customerId = opt ? opt.value : "";
                        setForm((p) => ({
                          ...p,
                          customer: customerId,
                          originalInvoice: "",
                          items: [],
                        }));
                        setAllInvoices([]);
                        setInvoices([]);
                        setSourceInvoice(null);
                      }}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder=""
                    />
                    <label>Customer</label>
                  </div>
                </div>

                {/* Sales Rep */}
                {(isAdminOrDataEntry || isSalesRep) && (
                  <div className="col-md-4">
                    <div className="form-floating react-select-floating">
                      <Select
                        classNamePrefix="react-select"
                        isDisabled={isView || isSalesRep || !isCreate}
                        isClearable={!isSalesRep && isCreate}
                        options={salesRepOptions}
                        value={selectedSalesRepOption}
                        onChange={(opt) => {
                          if (isSalesRep) return;
                          const srId = opt ? opt.value : "";
                          setForm((p) => ({ ...p, salesRep: srId }));
                        }}
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

                {/* Return Date */}
                <div className="col-md-4">
                  <div className="form-floating">
                    <input
                      type="date"
                      className="form-control"
                      id="returnDateInput"
                      value={form.returnDate}
                      readOnly={isView}
                      onChange={(e) => setForm((p) => ({ ...p, returnDate: e.target.value }))}
                    />
                    <label htmlFor="returnDateInput">Return Date</label>
                  </div>
                </div>

                {/* Original Invoice */}
                <div className="col-md-8">
                  <div className="form-floating react-select-floating">
                    <Select
                      classNamePrefix="react-select"
                      isDisabled={isView || !isCreate || !form.branch || !form.customer}
                      isClearable
                      options={invoices.map((inv) => ({
                        label: `${inv.invoiceNo} — ${formatDate(inv.invoiceDate)} — ${formatCurrency(
                          inv.totalValue
                        )}`,
                        value: inv._id,
                      }))}
                      value={
                        isView && selectedReturn?.originalInvoice
                          ? {
                              label: selectedReturn.originalInvoice?.invoiceNo || "Original Invoice",
                              value:
                                selectedReturn.originalInvoice?._id || selectedReturn.originalInvoice,
                            }
                          : form.originalInvoice
                          ? {
                              label:
                                invoices.find((inv) => inv._id === form.originalInvoice)?.invoiceNo ||
                                sourceInvoice?.invoiceNo ||
                                "",
                              value: form.originalInvoice,
                            }
                          : null
                      }
                      onChange={(opt) => loadInvoiceAsSource(opt ? opt.value : "")}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder=""
                    />
                    <label>Original Invoice</label>
                  </div>

                  {((isView && form.originalInvoice) || (!isView && sourceInvoice?._id)) &&
                    onViewInvoice && (
                      <button
                        type="button"
                        className="sr-link-btn mt-2"
                        onClick={() => onViewInvoice(form.originalInvoice || sourceInvoice?._id)}
                        title="View original invoice"
                      >
                        <i className="bi bi-box-arrow-up-right" />
                        View Original Invoice
                      </button>
                    )}
                </div>

                {/* Remarks */}
                <div className="col-12">
                  <div className="form-floating">
                    <textarea
                      className="form-control"
                      style={{ minHeight: "70px" }}
                      value={form.remarks}
                      readOnly={isView}
                      onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                      name="Remarks"
                      placeholder="Remarks"
                    />
                    <label>Remarks (Optional)</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Items & Pricing Section */}
            <div className="invoice-section-card mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <div className="invoice-section-title mb-0">
                  <i className="bi bi-box-seam" />
                  Items & Pricing
                </div>

                {!!form.items.length && (
                  <div className="d-flex flex-wrap gap-2">
                    <span className="sr-stat-inline">
                      <i className="bi bi-list-ul" />
                      Lines: {returnStats.totalLines}
                    </span>
                    <span className="sr-stat-inline">
                      <i className="bi bi-check2-circle" />
                      Returnable: {returnStats.returnableLines}
                    </span>
                    <span className="sr-stat-inline">
                      <i className="bi bi-dash-circle" />
                      Exhausted: {returnStats.exhaustedLines}
                    </span>
                  </div>
                )}
              </div>

              <div className="return-table-wrap">
                <table className="return-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 340 }}>Item</th>
                      <th className="text-end" style={{ minWidth: 130 }}>
                        Return Qty (Base)
                      </th>
                      <th className="text-end" style={{ minWidth: 140 }}>
                        Return Qty (Primary)
                      </th>
                      <th className="text-end" style={{ minWidth: 120 }}>
                        Price (Base)
                      </th>
                      <th className="text-end" style={{ minWidth: 130 }}>
                        Price (Primary)
                      </th>
                      <th className="text-end" style={{ minWidth: 100 }}>
                        Discount
                      </th>
                      <th className="text-end" style={{ minWidth: 130 }}>
                        Line Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {form.items.length ? (
                      form.items.map((row, i) => {
                        const factor = Number(row.factorToBase || 1);
                        const remainingTotalBase = Number(row.remainingTotalBase || 0);
                        const isFullyReturned = remainingTotalBase <= 0;

                        const priceBase = Number(row.sellingPriceBase || 0);
                        const pricePrimary = Number(row.sellingPricePrimary || 0);
                        const discount = Number(row.discountPerUnit || 0);

                        const hasBaseUom = !!row.baseUom;
                        const disableBaseInput = isView || isFullyReturned || !hasBaseUom;
                        const disablePrimaryInput = isView || isFullyReturned;

                        const currentBase = Number(row.returnBaseQty || 0);
                        const currentPrimary = Number(row.returnPrimaryQty || 0);

                        const invalidBasePrice = currentBase > 0 && priceBase <= 0;
                        const invalidPrimaryPrice = currentPrimary > 0 && pricePrimary <= 0;
                        const hasRowError = invalidBasePrice || invalidPrimaryPrice;

                        return (
                          <tr key={i} className={isFullyReturned ? "sr-row-disabled" : ""}>
                            <td>
                              <div className="fw-semibold">
                                {row.itemCode
                                  ? `${row.itemCode} — ${row.itemName}`
                                  : row.itemName || "-"}
                              </div>

                              <small className="text-muted d-block">
                                Sold: {row.soldLabel}
                                {row.hasAnyReturns ? " (has returns)" : ""}
                                {" — "}Remaining: {row.remainingLabel}
                              </small>

                              {!hasBaseUom && (
                                <span className="invoice-muted-chip">
                                  <i className="bi bi-info-circle me-1" />
                                  Primary-only item
                                </span>
                              )}

                              {isFullyReturned && (
                                <span className="invoice-muted-chip">
                                  <i className="bi bi-check2-all me-1" />
                                  Fully returned
                                </span>
                              )}

                              {hasRowError && !isView && (
                                <div className="mt-1">
                                  <span className="invoice-warning-chip">
                                    <i className="bi bi-exclamation-triangle-fill" />
                                    {invalidBasePrice && invalidPrimaryPrice
                                      ? "Missing prices for selected quantities"
                                      : invalidBasePrice
                                      ? "Base price required"
                                      : "Primary price required"}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Return Qty Base */}
                            <td>
                              <input
                                type="number"
                                className="form-control text-end"
                                value={hasBaseUom ? row.returnBaseQty : ""}
                                readOnly={disableBaseInput}
                                disabled={disableBaseInput}
                                min={0}
                                placeholder={hasBaseUom ? "" : "N/A"}
                                style={!hasBaseUom ? { backgroundColor: "#f3f4f6" } : {}}
                                onChange={(e) => {
                                  if (disableBaseInput) return;

                                  let val = Number(e.target.value || 0);
                                  if (val < 0 || Number.isNaN(val)) val = 0;

                                  const newItems = [...form.items];
                                  const cur = newItems[i];

                                  const newBase = val;
                                  const newPrimary = Number(cur.returnPrimaryQty || 0);
                                  const newTotalBase = newPrimary * factor + newBase;

                                  if (newTotalBase > remainingTotalBase) {
                                    toast.warning(
                                      `Total return cannot exceed ${remainingTotalBase} base units for ${
                                        row.itemCode || row.itemName || ""
                                      }.`
                                    );
                                    return;
                                  }

                                  newItems[i] = {
                                    ...cur,
                                    returnBaseQty: newBase,
                                    lineTotal: computeReturnLineTotal(cur, newBase, newPrimary),
                                  };

                                  setForm((p) => ({ ...p, items: newItems }));
                                }}
                              />
                            </td>

                            {/* Return Qty Primary */}
                            <td>
                              <input
                                type="number"
                                className="form-control text-end"
                                value={row.returnPrimaryQty}
                                readOnly={disablePrimaryInput}
                                disabled={disablePrimaryInput}
                                min={0}
                                onChange={(e) => {
                                  if (disablePrimaryInput) return;

                                  let val = Number(e.target.value || 0);
                                  if (val < 0 || Number.isNaN(val)) val = 0;

                                  const newItems = [...form.items];
                                  const cur = newItems[i];

                                  const newPrimary = val;
                                  const newBase = Number(cur.returnBaseQty || 0);
                                  const newTotalBase = newPrimary * factor + newBase;

                                  if (newTotalBase > remainingTotalBase) {
                                    toast.warning(
                                      `Total return cannot exceed ${remainingTotalBase} base units for ${
                                        row.itemCode || row.itemName || ""
                                      }.`
                                    );
                                    return;
                                  }

                                  newItems[i] = {
                                    ...cur,
                                    returnPrimaryQty: newPrimary,
                                    lineTotal: computeReturnLineTotal(cur, newBase, newPrimary),
                                  };

                                  setForm((p) => ({ ...p, items: newItems }));
                                }}
                              />
                            </td>

                            <td className="text-end pt-3">
                              {hasBaseUom ? formatCurrency(priceBase) : "-"}
                            </td>

                            <td className="text-end pt-3">{formatCurrency(pricePrimary)}</td>

                            <td className="text-end pt-3">
                              {discount > 0 ? formatCurrency(discount) : "-"}
                            </td>

                            <td className="text-end pt-3 fw-bold">
                              {formatCurrency(Number(row.lineTotal || 0))}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-3">
                          {isCreate
                            ? "Select branch, customer, and an approved invoice to load items."
                            : "No items to display."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary bar */}
              <div className="invoice-summary-bar">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div className="small text-muted">
                    {returnStats.totalLines || 0} line{returnStats.totalLines !== 1 ? "s" : ""} •
                    Selected: {returnStats.selectedLines || 0} • Date:{" "}
                    {formatDisplayDate(form.returnDate)} • Branch: {selectedBranchObj?.name || "-"}
                  </div>

                  <div className="d-flex align-items-center gap-3">
                    <div className="text-end">
                      <div className="small text-muted">
                        {isView ? "Refund Total" : "Selected Refund"}
                      </div>
                      <div className="fw-bold" style={{ fontSize: "1rem", color: "#111827" }}>
                        {formatCurrency(totalValue)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky footer actions */}
            <div className="invoice-footer-bar">
              <div className="d-flex justify-content-end align-items-center flex-wrap gap-2">
                {/* <Button
                  type="button"
                  variant="light"
                  onClick={onClose}
                  disabled={loading}
                  style={{ border: "1px solid #e5e7eb" }}
                >
                  {isView ? "Close" : "Cancel"}
                </Button> */}

                {!isView && (
                  <Button
                    type="submit"
                    className="action-btn-modal"
                    disabled={loading || !hasAtLeastOneReturnQty}
                    title={
                      !hasAtLeastOneReturnQty
                        ? "Enter at least one return quantity"
                        : "Create Sales Return"
                    }
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-circle me-2" />
                        Create Sales Return
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Modal.Body>

        <ToastContainer position="top-right" autoClose={2000} />
      </Modal>
    </>
  );
};

export default SalesReturnCreateModal;