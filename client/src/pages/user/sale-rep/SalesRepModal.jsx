import React, { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { Modal, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { getSalesReps, createSalesRep, updateSalesRep } from "../../../lib/api/users.api";

import { salesRepValidator } from "../../../lib/validation/user.validator";
import { z } from "zod";

const SalesRepModal = ({ show, mode, selectedRep, onClose, onSuccess }) => {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const formRef = useRef(null);

  // --------------------------------------------------
  // Generate next Sales Rep Code (REP-001)
  // --------------------------------------------------
  const generateNextRepCode = (reps = []) => {
    const max = reps.reduce((acc, r) => {
      const match = r.repCode?.match(/^REP-(\d+)$/);
      if (!match) return acc;
      return Math.max(acc, parseInt(match[1], 10));
    }, 0);

    return `REP-${String(max + 1).padStart(3, "0")}`;
  };

  // ----------------------------------------------------
  // Form state
  // ----------------------------------------------------
  const [form, setForm] = useState({
    repCode: "",
    name: "",
    contactNumber: "",
    route: "",
    address: "",
    NIC: "",
    status: "active",
    role: "SalesRep", // Default role
    password: "",
  });

  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});

  // ----------------------------------------------------
  // Validation
  // ----------------------------------------------------
  const focusFirstInvalidField = () => {
    setTimeout(() => {
      const invalid = formRef.current?.querySelector(".is-invalid");
      if (invalid) invalid.focus();
    }, 100);
  };

  const validateForm = (data) => {
    const errors = {};

    // Step 1: Empty check
    Object.entries(data).forEach(([k, v]) => {
      if (!v?.toString().trim()) errors[k] = "Please fill this field";
    });

    // Step 2: Zod validation
    try {
      salesRepValidator.parse(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.issues.forEach((issue) => {
          const field = issue.path[0];
          if (field && !errors[field]) errors[field] = issue.message;
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

  const validateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (!value?.toString().trim()) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    try {
      salesRepValidator.shape[field]?.parse(value);
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    } catch (err) {
      let msg = "Invalid value";
      if (err instanceof z.ZodError)
        msg = err.issues?.[0]?.message || msg;
      setFormErrors((prev) => ({ ...prev, [field]: msg }));
    }
  };

  // ----------------------------------------------------
  // Load form when modal opens or selectedRep changes
  // ----------------------------------------------------
  useEffect(() => {
    const initCreate = async () => {
      const reps = await getSalesReps();
      const nextCode = generateNextRepCode(reps || []);

      setForm({
        repCode: nextCode,
        name: "",
        contactNumber: "",
        route: "",
        address: "",
        NIC: "",
        status: "active",
        role: "SalesRep", // Ensure the role is set on creation
        password: "",
      });

      setFormErrors({});
      setTouched({});
    };

    if (selectedRep) {
      setForm({
        repCode: selectedRep.repCode || "",
        name: selectedRep.name || "",
        contactNumber: selectedRep.contactNumber || "",
        route: selectedRep.route || "",
        address: selectedRep.address || "",
        NIC: selectedRep.NIC || "",
        status: selectedRep.status || "active",
        role: selectedRep.role || "SalesRep", // Ensure role is handled on edit
        password: "",
      });

      setFormErrors({});
      setTouched({});
    } else if (show && mode === "create") {
      initCreate();
    }
  }, [selectedRep, show, mode]);


  // ----------------------------------------------------
  // Save handler (Create / Update)
  // ----------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return;

    setTouched(
      Object.keys(form).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {})
    );

    if (!validateForm(form)) return;

    try {
      if (isEdit && selectedRep?._id) {
        await updateSalesRep(selectedRep._id, form);
        toast.success("Sales Representative updated successfully");
      } else {
        await createSalesRep(form);
        toast.success("Sales Representative created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("❌ Failed saving sales rep:", err);
      toast.error("Failed to save sales representative");
    }
  };

  // ----------------------------------------------------
  // Select styles
  // ----------------------------------------------------
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: "#fff",
      borderColor: state.isFocused ? "#5c3e94" : "#d1d5db",
      minHeight: "48px",
      boxShadow: state.isFocused ? "0 0 0 1px #5c3e94" : "none",
      "&:hover": { borderColor: "#5c3e94" },
    }),
    singleValue: (base) => ({ ...base, color: "#374151" }),
  };

  // ----------------------------------------------------
  // Dynamic Title
  // ----------------------------------------------------
  const titleText = isView
    ? `View ${selectedRep?.repCode || "Sales Rep"}`
    : isEdit
    ? `Edit ${selectedRep?.repCode || "Sales Rep"}`
    : "Add Sales Rep";

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------
  return (
    <Modal show={show} onHide={onClose} centered backdrop="static" size="lg">
      <Modal.Header closeButton>
        <div className="d-flex justify-content-between w-100">
          <div>
            <h2 className="page-title-modal">{titleText}</h2>
            <p className="page-subtitle-modal">
              {isView
                ? "Detailed view of sales representative."
                : isEdit
                ? "Modify sales representative details."
                : "Add a new sales representative."}
            </p>
          </div>
          <div className="text-end me-4">
            <small>Code: {form.repCode || "N/A"}</small>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="card-container-modal">
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Rep Code */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="repCode"
                    className={`form-control ${
                      touched.repCode && formErrors.repCode ? "is-invalid" : ""
                    }`}
                    value={form.repCode}
                    readOnly
                    disabled
                  />
                  <label>Rep Code</label>
                  {formErrors.repCode && (
                    <div className="invalid-feedback">
                      {formErrors.repCode}
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="name"
                    className={`form-control ${
                      touched.name && formErrors.name ? "is-invalid" : ""
                    }`}
                    value={form.name}
                    readOnly={isView}
                    onChange={(e) => validateField("name", e.target.value)}
                  />
                  <label>Name</label>
                  {formErrors.name && (
                    <div className="invalid-feedback">{formErrors.name}</div>
                  )}
                </div>
              </div>

              {/* Contact Number */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="contactNumber"
                    className={`form-control ${
                      touched.contactNumber && formErrors.contactNumber
                        ? "is-invalid"
                        : ""
                    }`}
                    value={form.contactNumber}
                    readOnly={isView}
                    onChange={(e) =>
                      validateField("contactNumber", e.target.value)
                    }
                  />
                  <label>Contact Number</label>
                  {formErrors.contactNumber && (
                    <div className="invalid-feedback">
                      {formErrors.contactNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* Route */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="route"
                    className={`form-control ${
                      touched.route && formErrors.route ? "is-invalid" : ""
                    }`}
                    value={form.route}
                    readOnly={isView}
                    onChange={(e) => validateField("route", e.target.value)}
                  />
                  <label>Route</label>
                  {formErrors.route && (
                    <div className="invalid-feedback">{formErrors.route}</div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="col-md-12">
                <div className="form-floating">
                  <textarea
                    name="address"
                    className={`form-control ${
                      touched.address && formErrors.address ? "is-invalid" : ""
                    }`}
                    style={{ height: "90px" }}
                    value={form.address}
                    readOnly={isView}
                    onChange={(e) =>
                      validateField("address", e.target.value)
                    }
                  />
                  <label>Address</label>
                  {formErrors.address && (
                    <div className="invalid-feedback">
                      {formErrors.address}
                    </div>
                  )}
                </div>
              </div>

              {/* NIC */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="NIC"
                    className={`form-control ${
                      touched.NIC && formErrors.NIC ? "is-invalid" : ""
                    }`}
                    value={form.NIC}
                    readOnly={isView}
                    onChange={(e) => validateField("NIC", e.target.value)}
                  />
                  <label>NIC</label>
                  {formErrors.NIC && (
                    <div className="invalid-feedback">{formErrors.NIC}</div>
                  )}
                </div>
              </div>
          
              {/* Password Field */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="password"
                    name="password"
                    className={`form-control ${
                      touched.password && formErrors.password ? "is-invalid" : ""
                    }`}
                    value={form.password}
                    readOnly={isView}
                    onChange={(e) => validateField("password", e.target.value)}
                  />
                  <label>Password</label>
                  {formErrors.password && (
                    <div className="invalid-feedback">{formErrors.password}</div>
                  )}
                </div>
              </div>

              {/* Status */}
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
                            label:
                              form.status === "active"
                                ? "Active"
                                : "Inactive",
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
            <div className="col-12 text-end mt-4">
              {isView ? (
                <Button type="button" className="action-btn-modal" onClick={onClose}>
                  Close
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="action-btn-modal"
                  onClick={handleSubmit}
                >
                  {isEdit ? "Update Sales Rep" : "Create Sales Rep"}
                </Button>
              )}
            </div>
      </Modal.Body>
    </Modal>
  );
};

export default SalesRepModal;
