// src/pages/product/BrandModal.jsx 
import React, { useState, useEffect } from "react";
import Select from "react-select";
import { Modal, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { createBrand, updateBrand } from "../../../lib/api/settings.api";

const BrandModal = ({
  show,
  mode,
  selectedBrand,
  onClose,
  onSuccess,
  groups = [],
}) => {
  const isView = mode === "view";

  // --------------------------------------------------
  // Local form state
  // --------------------------------------------------
  const [form, setForm] = useState({
    brandCode: "",
    name: "",
    description: "",
    groups: [],
    status: "active",
  });

  // --------------------------------------------------
  // Load selected brand into form (or reset on new/open)
  // --------------------------------------------------
  useEffect(() => {
    if (selectedBrand) {
      setForm({
        brandCode: selectedBrand.brandCode || "",
        name: selectedBrand.name || "",
        description: selectedBrand.description || "",
        groups: Array.isArray(selectedBrand.groups)
          ? selectedBrand.groups
              .map((g) => (typeof g === "string" ? g : g?._id))
              .filter(Boolean)
          : [],
        status: selectedBrand.status || "active",
      });
    } else {
      setForm({
        brandCode: "",
        name: "",
        description: "",
        groups: [],
        status: "active",
      });
    }
  }, [selectedBrand, mode, show]);

  // --------------------------------------------------
  // Submit handler
  // --------------------------------------------------
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isView) return;

    const payload = {
      ...form,
      groups: Array.isArray(form.groups) ? form.groups : [],
    };

    try {
      if (mode === "edit" && selectedBrand?._id) {
        await updateBrand(selectedBrand._id, payload);
        toast.success("Brand updated successfully");
      } else {
        await createBrand(payload);
        toast.success("Brand created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("❌ Failed to save brand:", err);
      toast.error("Failed to save brand");
    }
  };

  // --------------------------------------------------
  // react-select styles
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
    singleValue: (base) => ({
      ...base,
      color: "#374151",
    }),
  };

  // --------------------------------------------------
  // Derived title text
  // --------------------------------------------------
  const titleText = isView
    ? `View ${selectedBrand?.brandCode || "Brand"}`
    : mode === "edit"
    ? `Edit ${selectedBrand?.brandCode || "Brand"}`
    : "Add Brand";

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <Modal show={show} onHide={onClose} centered backdrop="static" size="lg">
      {/* ---------------- HEADER ---------------- */}
      <Modal.Header closeButton>
        <div className="d-flex justify-content-between w-100">
          <div>
            <h2 className="page-title-modal">{titleText}</h2>
            <p className="page-subtitle-modal">
              {isView
                ? "Detailed view of product brand."
                : mode === "edit"
                ? "Modify brand details."
                : "Create new brand."}
            </p>
          </div>

          <div className="text-end me-4">
            <small>Code: {form.brandCode || "N/A"}</small>
          </div>
        </div>
      </Modal.Header>

      {/* ---------------- BODY ---------------- */}
      <Modal.Body>
        <div className="card-container-modal">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {/* Brand Code */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    className="form-control"
                    name="brandCode"
                    value={form.brandCode}
                    readOnly={isView}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        brandCode: e.target.value,
                      }))
                    }
                    required={!isView}
                  />
                  <label>Brand Code</label>
                </div>
              </div>

              {/* Name */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={form.name}
                    readOnly={isView}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required={!isView}
                  />
                  <label>Name</label>
                </div>
              </div>

              {/* Description */}
              <div className="col-md-12">
                <div className="form-floating">
                  <textarea
                    className="form-control"
                    style={{ height: "90px" }}
                    name="description"
                    value={form.description}
                    readOnly={isView}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    required={!isView}
                  />
                  <label>Description</label>
                </div>
              </div>

{/* Groups (Multi-Select react-select) */}
<div className="col-md-12">
  <div className="form-floating react-select-floating">
    <Select
      classNamePrefix="react-select"
      isDisabled={isView}
      isMulti
      options={groups.map((g) => ({
        label:
          g.groupCode && g.name
            ? `${g.groupCode} — ${g.name}`
            : g.name || g.groupCode,
        value: g._id,
      }))}
      value={
        form.groups?.map((id) => {
          const obj = groups.find((g) => g._id === id);
          return obj
            ? {
                label:
                  obj.groupCode && obj.name
                    ? `${obj.groupCode} — ${obj.name}`
                    : obj.name || obj.groupCode,
                value: obj._id,
              }
            : null;
        }) || []
      }
      onChange={(opt) =>
        setForm((prev) => ({
          ...prev,
          groups: opt.map((g) => g.value),
        }))
      }
      styles={selectStyles}
      placeholder=""
    />
    <label>Product Groups</label>
  </div>

  {isView && (!form.groups || form.groups.length === 0) && (
    <div className="text-muted small mt-1">No groups assigned.</div>
  )}
</div>

{/* Status (react-select) */}
<div className="col-md-6">
  <div className="form-floating react-select-floating">
    <Select
      classNamePrefix="react-select"
      isDisabled={isView}
      options={[
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ]}
      value={
        form.status
          ? {
              label: form.status === "active" ? "Active" : "Inactive",
              value: form.status,
            }
          : null
      }
      onChange={(opt) =>
        setForm((prev) => ({
          ...prev,
          status: opt?.value || "active",
        }))
      }
      styles={selectStyles}
      placeholder=""
    />
    <label>Status</label>
  </div>
</div>
            </div>
          </form>
        </div>

        {/* ---------------- FOOTER ---------------- */}
        <div className="col-12 text-end mt-4">
          {isView ? (
            <Button
              type="button"
              className="action-btn-modal"
              onClick={onClose}
            >
              Close
            </Button>
          ) : (
            <Button
              type="button"
              className="action-btn-modal"
              onClick={handleSubmit}
            >
              {mode === "edit" ? "Update Brand" : "Create Brand"}
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default BrandModal;
