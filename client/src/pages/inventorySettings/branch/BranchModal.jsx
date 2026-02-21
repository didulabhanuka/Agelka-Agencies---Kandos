import React, { useEffect, useRef, useState } from "react";
import Select from "react-select";
import { Modal, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { z } from "zod";

import { createBranch, updateBranch } from "../../../lib/api/settings.api";
import { branchValidator } from "../../../lib/validation/inventoryValidator";

const BranchModal = ({
  show,
  mode,                // create | edit | view
  selectedBranch = null,
  onClose,
  onSuccess,
}) => {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  // --------------------------------------------------
  // Form State
  // --------------------------------------------------
  const [form, setForm] = useState({
    branchCode: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    status: "active",
  });

  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});
  const formRef = useRef(null);

  // --------------------------------------------------
  // Load Selected Branch into Form
  // --------------------------------------------------
  useEffect(() => {
    if (selectedBranch && show) {
      setForm({
        branchCode: selectedBranch.branchCode || "",
        name: selectedBranch.name || "",
        address: selectedBranch.address || "",
        phone: selectedBranch.phone || "",
        email: selectedBranch.email || "",
        status: selectedBranch.status || "active",
      });
    } else {
      setForm({
        branchCode: "",
        name: "",
        address: "",
        phone: "",
        email: "",
        status: "active",
      });
    }

    setFormErrors({});
    setTouched({});
  }, [selectedBranch, show]);

  // --------------------------------------------------
  // Helpers: Validation
  // --------------------------------------------------
  const focusFirstInvalidField = () => {
    setTimeout(() => {
      const invalid = formRef.current?.querySelector(".is-invalid");
      if (invalid) invalid.focus();
    }, 100);
  };

  /** Full-form validation */
  const validateForm = (data) => {
    const errors = {};

    // Required fields except optional ones
    Object.entries(data).forEach(([field, value]) => {
      const trimmed = (value ?? "").toString().trim();
      if (!trimmed && !["address", "phone", "email"].includes(field)) {
        errors[field] = "Please fill this field";
      }
    });

    // Apply Zod validator
    try {
      branchValidator.parse(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.issues.forEach((issue) => {
          const f = issue.path[0];
          if (f && !errors[f]) errors[f] = issue.message;
        });
      }
    }

    setFormErrors(errors);

    if (Object.keys(errors).length) {
      focusFirstInvalidField();
      return false;
    }
    return true;
  };

  /** Per-field validation */
  const validateField = (field, value) => {
    const val = (value ?? "").toString();

    setForm((prev) => ({ ...prev, [field]: val }));
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (!val.trim() && ["address", "phone", "email"].includes(field)) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    try {
      branchValidator.shape[field].parse(val);
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    } catch (err) {
      const message =
        err instanceof z.ZodError
          ? err.issues?.[0]?.message || "Invalid value"
          : "Invalid value";
      setFormErrors((prev) => ({ ...prev, [field]: message }));
    }
  };

  // --------------------------------------------------
  // Submit Handler
  // --------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return;

    const cleaned = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, (v ?? "").toString().trim()])
    );

    if (!validateForm(cleaned)) return;

    try {
      if (isEdit && selectedBranch?._id) {
        await updateBranch(selectedBranch._id, cleaned);
        toast.success("Branch updated successfully");
      } else {
        await createBranch(cleaned);
        toast.success("Branch created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("❌ Branch save failed:", err);
      toast.error("Something went wrong");
    }
  };

  // --------------------------------------------------
  // react-select styles
  // --------------------------------------------------
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: "#fff",
      minHeight: "48px",
      borderColor: state.isFocused ? "#5c3e94" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 1px #5c3e94" : "none",
      "&:hover": { borderColor: "#5c3e94" },
    }),
    singleValue: (b) => ({ ...b, color: "#374151" }),
  };

  const titleText =
    mode === "view"
      ? `View ${selectedBranch?.branchCode || "Branch"}`
      : mode === "edit"
      ? `Edit ${selectedBranch?.branchCode || "Branch"}`
      : "Add Branch";

  // --------------------------------------------------
  // Render UI
  // --------------------------------------------------
  return (
    <Modal show={show} onHide={onClose} centered backdrop="static" size="lg">
      {/* ---------------- Header ---------------- */}
      <Modal.Header closeButton>
        <div className="d-flex justify-content-between w-100">
          <div>
            <h2 className="page-title-modal">{titleText}</h2>
            <p className="page-subtitle-modal">
              {isView
                ? "Detailed view of branch details."
                : isEdit
                ? "Modify existing branch details."
                : "Create a new branch record."}
            </p>
          </div>

          <div className="text-end me-4">
            <small>Code: {form.branchCode || "N/A"}</small>
          </div>
        </div>
      </Modal.Header>

      {/* ---------------- Body ---------------- */}
      <Modal.Body>
        <div className="card-container-modal">
          <form onSubmit={handleSubmit} ref={formRef}>
            <div className="row g-3">
              {/* Dynamic Input Fields */}
              {[
                { label: "Branch Code", name: "branchCode", type: "text" },
                { label: "Name", name: "name", type: "text" },
                { label: "Address", name: "address", type: "text" },
                { label: "Phone", name: "phone", type: "text" },
                { label: "Email", name: "email", type: "email" },
              ].map((f) => (
                <div className="col-md-6" key={f.name}>
                  <div className="form-floating">
                    <input
                      type={f.type}
                      className={`form-control ${
                        formErrors[f.name] ? "is-invalid" : ""
                      }`}
                      name={f.name}
                      value={form[f.name]}
                      readOnly={isView}
                      onChange={(e) => validateField(f.name, e.target.value)}
                      onBlur={(e) => validateField(f.name, e.target.value)}
                    />
                    <label>{f.label}</label>

                    {formErrors[f.name] && (
                      <div className="invalid-feedback">
                        {formErrors[f.name]}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Status Field (React-Select) */}
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
                    onChange={(opt) => validateField("status", opt?.value || "")}
                    styles={selectStyles}
                    placeholder=""
                  />
                  <label>Status</label>
                </div>

                {formErrors.status && (
                  <small className="text-danger">{formErrors.status}</small>
                )}
              </div>
              
            </div>
          </form>
        </div>

        {/* ---------------- Footer ---------------- */}
        <div className="col-12 text-end mt-4">
          {isView ? (
            <Button className="action-btn-modal" onClick={onClose}>
              Close
            </Button>
          ) : (
            <Button className="action-btn-modal" onClick={handleSubmit}>
              {isEdit ? "Update Branch" : "Create Branch"}
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default BranchModal;
