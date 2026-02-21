// src/pages/products/ProductModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import Select from "react-select";
import { toast } from "react-toastify";

import { createItem, updateItem } from "../../../lib/api/inventory.api";
import { getProductGroups } from "../../../lib/api/settings.api";

// Initial form state
const initialForm = {
  itemCode: "",
  name: "",
  description: "",
  brand: "",
  productGroup: "",
  primaryUom: "",
  baseUom: "",
  factorToParent: "",
  uoms: [],
  supplier: "",
  avgCostPrimary: "",
  sellingPricePrimary: "",
  avgCostBase: "",
  sellingPriceBase: "",
  reorderLevel: "",
};

const ProductModal = ({
  show,
  mode,
  selectedItem,
  onClose,
  onSuccess,
  brands = [],
  groups = [],
  suppliers = [],
}) => {
  // Mode flags
  const isView = mode === "view";
  const isEdit = mode === "edit";

  // Component state
  const [form, setForm] = useState(initialForm);
  const [showUomSection, setShowUomSection] = useState(false);
  const [uomDefinitions, setUomDefinitions] = useState([]);
  const [saving, setSaving] = useState(false);

  // Load UOM definitions when modal opens
  useEffect(() => {
    if (!show) return;

    const fetchUoms = async () => {
      try {
        const data = await getProductGroups();
        setUomDefinitions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load UOMs:", err);
        toast.error("Failed to load UOM types");
      }
    };

    fetchUoms();
  }, [show]);

  // Brand select options
  const brandOptions = useMemo(
    () =>
      brands.map((b) => ({
        value: b._id,
        label: b.brandCode ? `${b.brandCode} — ${b.name}` : b.name,
      })),
    [brands]
  );

  // Filter groups by selected brand
  const filteredGroups = useMemo(() => {
    if (!form.brand) return [];
    const brandObj = brands.find((b) => b._id === form.brand);
    if (!brandObj?.groups) return [];
    return groups.filter((g) => brandObj.groups.includes(g._id));
  }, [form.brand, brands, groups]);

  // Group select options
  const groupOptions = useMemo(
    () =>
      filteredGroups.map((g) => ({
        value: g._id,
        label: g.groupCode ? `${g.groupCode} — ${g.name}` : g.name,
      })),
    [filteredGroups]
  );

  // Supplier select options
  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s._id,
        label: s.supplierCode ? `${s.supplierCode} — ${s.name}` : s.name,
      })),
    [suppliers]
  );

  // Primary UOM options
  const primaryUomOptions = useMemo(
    () =>
      uomDefinitions
        .filter((u) => u.uomType === "primary" && u.status === "active")
        .map((u) => ({
          value: u.code,
          label: u.name,
        })),
    [uomDefinitions]
  );

  // Base UOM options
  const baseUomOptions = useMemo(
    () =>
      uomDefinitions
        .filter((u) => u.uomType === "base" && u.status === "active")
        .map((u) => ({
          value: u.code,
          label: u.name,
        })),
    [uomDefinitions]
  );

  // Helper labels
  const selectedPrimaryUomLabel =
    primaryUomOptions.find((o) => o.value === form.primaryUom)?.label || form.primaryUom || "-";

  const selectedBaseUomLabel =
    baseUomOptions.find((o) => o.value === form.baseUom)?.label || form.baseUom || "-";

  // Load selected item into form or reset for create
  useEffect(() => {
    if (!selectedItem) {
      setForm(initialForm);
      setShowUomSection(false);
      setSaving(false);
      return;
    }

    const uoms = selectedItem.uoms || [];

    // Pick the matching primary -> base UOM link if available
    const link =
      uoms.find(
        (u) =>
          String(u.parentCode || "").trim() === String(selectedItem.primaryUom || "").trim() &&
          String(u.uomCode || "").trim() === String(selectedItem.baseUom || "").trim()
      ) || uoms[0];

    setForm({
      itemCode: selectedItem.itemCode || "",
      name: selectedItem.name || "",
      description: selectedItem.description || "",
      brand: selectedItem.brand?._id || selectedItem.brand || "",
      productGroup: selectedItem.productGroup?._id || selectedItem.productGroup || "",
      primaryUom: selectedItem.primaryUom || "",
      baseUom: selectedItem.baseUom || "",
      factorToParent: link && link.factorToParent !== undefined ? link.factorToParent : "",
      uoms,
      supplier: selectedItem.supplier?._id || selectedItem.supplier || "",
      avgCostPrimary:
        selectedItem.avgCostPrimary !== undefined ? selectedItem.avgCostPrimary : "",
      sellingPricePrimary:
        selectedItem.sellingPricePrimary !== undefined ? selectedItem.sellingPricePrimary : "",
      avgCostBase: selectedItem.avgCostBase !== undefined ? selectedItem.avgCostBase : "",
      sellingPriceBase:
        selectedItem.sellingPriceBase !== undefined ? selectedItem.sellingPriceBase : "",
      reorderLevel: selectedItem.reorderLevel !== undefined ? selectedItem.reorderLevel : "",
    });

    setShowUomSection(
      Boolean(selectedItem.baseUom || (selectedItem.uoms && selectedItem.uoms.length > 0))
    );
    setSaving(false);
  }, [selectedItem, show]);

  // Handle text/number input changes
  const handleChange = (e) => {
    if (isView) return;
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Generic react-select handler factory
  const handleSelectChange = (field, resetField) => (opt) => {
    if (isView) return;
    const value = opt ? opt.value : "";
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(resetField ? { [resetField]: "" } : {}),
    }));
  };

  // Select handlers
  const handleSelectBrand = handleSelectChange("brand", "productGroup");
  const handleSelectGroup = handleSelectChange("productGroup");
  const handleSelectSupplier = handleSelectChange("supplier");
  const handleSelectPrimaryUom = handleSelectChange("primaryUom");
  const handleSelectBaseUom = handleSelectChange("baseUom");

  // Convert input safely to number
  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  // Auto-calculate base prices from primary prices and factor
  useEffect(() => {
    if (isView) return;

    const primaryCost = toNumber(form.avgCostPrimary);
    const primaryPrice = toNumber(form.sellingPricePrimary);
    const factor = toNumber(form.factorToParent);

    if ((!primaryCost && !primaryPrice) || !factor || factor <= 0) return;

    setForm((prev) => {
      const next = { ...prev };

      if (primaryCost !== undefined) next.avgCostBase = primaryCost / factor;
      if (primaryPrice !== undefined) next.sellingPriceBase = primaryPrice / factor;

      return next;
    });
  }, [form.avgCostPrimary, form.sellingPricePrimary, form.factorToParent, isView]);

  // Clean number fields for payload
  const cleanNumber = (value) =>
    value === "" || value === null || value === undefined ? undefined : Number(value);

  // Submit create/update
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView || saving) return;

    const factor = cleanNumber(form.factorToParent);

    // Build UOM payload only when all required fields are present
    const uomsPayload =
      form.baseUom && form.primaryUom && factor
        ? [
            {
              uomCode: form.baseUom,
              parentCode: form.primaryUom,
              factorToParent: factor,
            },
          ]
        : [];

    // Normalize empty relation IDs
    const normalizedForm = {
      ...form,
      brand: form.brand || null,
      productGroup: form.productGroup || null,
      supplier: form.supplier || null,
    };

    // Remove UI-only fields before sending
    const { factorToParent, uoms, ...rest } = normalizedForm;

    const payload = {
      ...rest,
      avgCostPrimary: cleanNumber(form.avgCostPrimary),
      sellingPricePrimary: cleanNumber(form.sellingPricePrimary),
      avgCostBase: cleanNumber(form.avgCostBase),
      sellingPriceBase: cleanNumber(form.sellingPriceBase),
      reorderLevel: cleanNumber(form.reorderLevel),
      uoms: uomsPayload,
    };

    try {
      setSaving(true);

      if (isEdit && selectedItem?._id) {
        await updateItem(selectedItem._id, payload);
        toast.success("Product updated successfully");
      } else {
        await createItem(payload);
        toast.success("Product created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  // react-select custom styles
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "46px",
      borderRadius: 10,
      fontSize: "0.9rem",
      backgroundColor: isView ? "#f8f9fa" : "#fff",
      borderColor: state.isFocused ? "#86b7fe" : base.borderColor,
      boxShadow: state.isFocused ? "0 0 0 0.15rem rgba(13,110,253,.15)" : "none",
      "&:hover": {
        borderColor: state.isFocused ? "#86b7fe" : "#ced4da",
      },
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      borderRadius: 10,
      overflow: "hidden",
    }),
  };

  // Modal title (use item name for view/edit)
  const titleText = isView
    ? `View ${selectedItem?.name || "Product"}`
    : isEdit
    ? `Edit ${selectedItem?.name || "Product"}`
    : "Add Product";

  return (
    <Modal show={show} onHide={onClose} centered size="xl" backdrop="static">
      {/* Local modal styles */}
      <style>
        {`
          .pm-section {
            border: 1px solid #eef0f3;
            border-radius: 12px;
            background: #fff;
            padding: 14px;
          }

          .pm-section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 14px;
            color: #344054;
            margin-bottom: 12px;
          }

          .pm-label-required::after {
            content: " *";
            color: #dc3545;
            font-weight: 700;
          }

          .pm-help {
            margin-top: 6px;
            font-size: 12px;
            color: #6c757d;
          }

          .pm-chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
          }

          .pm-chip {
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

          .pm-readonly .form-control {
            background-color: #f8f9fa !important;
          }

          .pm-uom-toggle {
            border: 1px solid #e9ecef;
            border-radius: 12px;
            background: #fbfcfe;
            padding: 12px;
            transition: all 0.15s ease;
          }

          .pm-uom-toggle:hover {
            border-color: #d0d7de;
            background: #f8fbff;
          }

          .pm-uom-panel {
            border: 1px solid #eef0f3;
            border-radius: 12px;
            background: #fcfdff;
            padding: 12px;
          }

          .pm-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #eef0f3;
          }

          .pm-footer-note {
            color: #6c757d;
            font-size: 12px;
          }

          .pm-mode-badge {
            font-size: 12px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 999px;
          }

          .pm-mode-badge.view {
            background: #f3f4f6;
            color: #4b5563;
          }

          .pm-mode-badge.edit {
            background: #eff6ff;
            color: #1d4ed8;
          }

          .pm-mode-badge.create {
            background: #ecfdf3;
            color: #027a48;
          }
        `}
      </style>

      <Modal.Header closeButton>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h2 className="page-title-modal mb-0">{titleText}</h2>
          <span className={`pm-mode-badge ${isView ? "view" : isEdit ? "edit" : "create"}`}>
            {isView ? "View Mode" : isEdit ? "Edit Mode" : "Create Mode"}
          </span>
        </div>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: "75vh", overflowY: "auto" }}>
        <form onSubmit={handleSubmit} className={isView ? "pm-readonly" : ""}>
          <div className="row g-3">
            {/* Basic info section */}
            <div className="col-12">
              <div className="pm-section">
                <div className="pm-section-title">
                  <i className="bi bi-box-seam" />
                  <span>Basic Information</span>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        name="itemCode"
                        className="form-control"
                        value={form.itemCode}
                        readOnly={isView}
                        onChange={handleChange}
                      />
                      <label className="pm-label-required">Item Code</label>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        name="name"
                        className="form-control"
                        value={form.name}
                        readOnly={isView}
                        onChange={handleChange}
                      />
                      <label className="pm-label-required">Name</label>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="form-floating">
                      <input
                        name="description"
                        className="form-control"
                        value={form.description}
                        readOnly={isView}
                        onChange={handleChange}
                      />
                      <label>Description</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Classification section */}
            <div className="col-12">
              <div className="pm-section">
                <div className="pm-section-title">
                  <i className="bi bi-diagram-3" />
                  <span>Classification</span>
                </div>

                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="form-floating react-select-floating">
                      <Select
                        classNamePrefix="react-select"
                        isDisabled={isView}
                        isClearable
                        options={brandOptions}
                        value={brandOptions.find((o) => o.value === form.brand) || null}
                        onChange={handleSelectBrand}
                        styles={selectStyles}
                        placeholder=""
                      />
                      <label>Brand</label>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="form-floating react-select-floating">
                      <Select
                        classNamePrefix="react-select"
                        isDisabled={isView || !form.brand}
                        isClearable
                        options={groupOptions}
                        value={groupOptions.find((o) => o.value === form.productGroup) || null}
                        onChange={handleSelectGroup}
                        styles={selectStyles}
                        placeholder=""
                      />
                      <label>Product Group</label>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="form-floating react-select-floating">
                      <Select
                        classNamePrefix="react-select"
                        isDisabled={isView}
                        isClearable
                        options={supplierOptions}
                        value={supplierOptions.find((o) => o.value === form.supplier) || null}
                        onChange={handleSelectSupplier}
                        styles={selectStyles}
                        placeholder=""
                      />
                      <label>Supplier</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing + primary UOM section */}
            <div className="col-12">
              <div className="pm-section">
                <div className="pm-section-title">
                  <i className="bi bi-currency-dollar" />
                  <span>Primary UOM & Pricing</span>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="form-floating react-select-floating">
                      <Select
                        classNamePrefix="react-select"
                        isDisabled={isView}
                        isClearable
                        options={primaryUomOptions}
                        value={primaryUomOptions.find((o) => o.value === form.primaryUom) || null}
                        onChange={handleSelectPrimaryUom}
                        styles={selectStyles}
                        placeholder=""
                      />
                      <label className="pm-label-required">Primary UOM</label>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        type="number"
                        name="reorderLevel"
                        className="form-control"
                        value={form.reorderLevel}
                        readOnly={isView}
                        onChange={handleChange}
                      />
                      <label>Reorder Level</label>
                    </div>
                    <div className="pm-help">
                      Alert threshold when stock goes below this quantity.
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        type="number"
                        name="avgCostPrimary"
                        className="form-control"
                        value={form.avgCostPrimary}
                        readOnly={isView}
                        onChange={handleChange}
                      />
                      <label>Average Cost (Primary UOM)</label>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        type="number"
                        name="sellingPricePrimary"
                        className="form-control"
                        value={form.sellingPricePrimary}
                        readOnly={isView}
                        onChange={handleChange}
                      />
                      <label>Selling Price (Primary UOM)</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* UOM collapsible section */}
            <div className="col-12">
              <div className="pm-uom-toggle">
                <div
                  className="d-flex align-items-center gap-3"
                  style={{ cursor: "pointer" }}
                  onClick={() => setShowUomSection((v) => !v)}
                >
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-layers text-secondary" />
                    <h5 className="mb-0 text-secondary">UOMs & Base Pricing</h5>
                  </div>

                  <hr className="flex-grow-1 my-0 opacity-25" />

                  <span className="text-muted">
                    {showUomSection ? (
                      <i className="bi bi-caret-down-fill" />
                    ) : (
                      <i className="bi bi-caret-right-fill" />
                    )}
                  </span>
                </div>

                <div className="pm-help mt-2 mb-0">
                  Optional: Enable this when the product has a base unit and separate base pricing.
                </div>

                {showUomSection && (
                  <div className="pm-uom-panel mt-3">
                    <div className="row g-3">
                      <div className="col-md-4">
                        <div className="form-floating react-select-floating">
                          <Select
                            classNamePrefix="react-select"
                            isDisabled={isView}
                            isClearable
                            options={baseUomOptions}
                            value={baseUomOptions.find((o) => o.value === form.baseUom) || null}
                            onChange={handleSelectBaseUom}
                            styles={selectStyles}
                            placeholder=""
                          />
                          <label>Base UOM</label>
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="factorToParent"
                            className="form-control"
                            value={form.factorToParent}
                            readOnly={isView}
                            onChange={handleChange}
                          />
                          <label>Factor to Parent (Primary → Base)</label>
                        </div>
                        <div className="pm-help">
                          Example: 1 Box = 12 Pieces → enter <strong>12</strong>.
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="pm-chip-row">
                          {form.primaryUom ? (
                            <span className="pm-chip">
                              <i className="bi bi-box" />
                              Primary: {selectedPrimaryUomLabel}
                            </span>
                          ) : null}

                          {form.baseUom ? (
                            <span className="pm-chip">
                              <i className="bi bi-box2" />
                              Base: {selectedBaseUomLabel}
                            </span>
                          ) : null}

                          {form.primaryUom && form.baseUom && form.factorToParent ? (
                            <span className="pm-chip">
                              <i className="bi bi-arrow-left-right" />1 {selectedPrimaryUomLabel} ={" "}
                              {form.factorToParent} {selectedBaseUomLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="avgCostBase"
                            className="form-control"
                            value={form.avgCostBase}
                            readOnly={isView}
                            onChange={handleChange}
                          />
                          <label>Average Cost (Base UOM)</label>
                        </div>
                        <div className="pm-help">Auto-calculated from primary cost and factor.</div>
                      </div>

                      <div className="col-md-6">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="sellingPriceBase"
                            className="form-control"
                            value={form.sellingPriceBase}
                            readOnly={isView}
                            onChange={handleChange}
                          />
                          <label>Selling Price (Base UOM)</label>
                        </div>
                        <div className="pm-help">
                          Auto-calculated from primary selling price and factor.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pm-footer">
            <div className="pm-footer-note">
              {isView ? "Read-only view" : "Fields marked * are recommended/important."}
            </div>

            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={onClose} disabled={saving}>
                {isView ? "Close" : "Cancel"}
              </Button>

              {!isView && (
                <Button className="action-btn-modal" type="submit" disabled={saving}>
                  {saving
                    ? isEdit
                      ? "Updating..."
                      : "Creating..."
                    : isEdit
                    ? "Update Product"
                    : "Create Product"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default ProductModal;