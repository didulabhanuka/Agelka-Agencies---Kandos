// src/pages/CustomerModal.jsx
import React, { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { Modal, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { getCustomers, createCustomer, updateCustomer } from "../../../lib/api/users.api";

import { customerValidator } from "../../../lib/validation/user.validator";
import { z } from "zod";

const CustomerModal = ({
  show,
  mode,
  selectedCustomer,
  onClose,
  onSuccess,
  salesReps = [],
}) => {
  const isView = mode === "view";

  const formRef = useRef(null);

  // --------------------------------------------------
  // Generate next Customer Code (CUS-001)
  // --------------------------------------------------
  const generateNextCustomerCode = (customers = []) => {
    const max = customers.reduce((acc, c) => {
      const match = c.customerCode?.match(/^CUST-(\d+)$/);
      if (!match) return acc;
      return Math.max(acc, parseInt(match[1], 10));
    }, 0);

    return `CUST-${String(max + 1).padStart(3, "0")}`;
  };


  // --------------------------------------------------
  // Form state
  // --------------------------------------------------
  const [form, setForm] = useState({
    customerCode: "",
    name: "",
    address: "",
    city: "",
    owner: "",
    contactNumber: "",
    creditLimit: "",
    creditPeriod: "",
    salesRep: "",
    status: "active",
  });

  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});

  // --------------------------------------------------
  // Validation
  // --------------------------------------------------
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
      customerValidator.parse(data);
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

    if (!value.toString().trim()) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    try {
      customerValidator.shape[field]?.parse(value);
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    } catch (err) {
      let msg = "Invalid value";
      if (err instanceof z.ZodError)
        msg = err.issues?.[0]?.message || msg;
      setFormErrors((prev) => ({ ...prev, [field]: msg }));
    }
  };

  // --------------------------------------------------
  // Load selected customer OR reset form
  // --------------------------------------------------
  useEffect(() => {
    const initCreate = async () => {
      const res = await getCustomers();
      const nextCode = generateNextCustomerCode(res || []);

      setForm({
        customerCode: nextCode,
        name: "",
        address: "",
        city: "",
        owner: "",
        contactNumber: "",
        creditLimit: "",
        creditPeriod: "",
        salesRep: "",
        status: "active",
      });

      setFormErrors({});
      setTouched({});
    };

    if (selectedCustomer) {
      setForm({
        customerCode: selectedCustomer.customerCode || "",
        name: selectedCustomer.name || "",
        address: selectedCustomer.address || "",
        city: selectedCustomer.city || "",
        owner: selectedCustomer.owner || "",
        contactNumber: selectedCustomer.contactNumber || "",
        creditLimit: selectedCustomer.creditLimit ?? "",
        creditPeriod: selectedCustomer.creditPeriod ?? "",
        salesRep:
          selectedCustomer.salesRep?._id ||
          selectedCustomer.salesRep ||
          "",
        status: selectedCustomer.status || "active",
      });

      setFormErrors({});
      setTouched({});
    } else if (show && mode === "create") {
      initCreate();
    }
  }, [selectedCustomer, mode, show]);


  // --------------------------------------------------
  // Submit handler
  // --------------------------------------------------
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
      const cleanPayload = {
        ...form,
        salesRep: form.salesRep || null,
      };

      if (mode === "edit" && selectedCustomer?._id) {
        await updateCustomer(selectedCustomer._id, cleanPayload);
        toast.success("Customer updated successfully");
      } else {
        await createCustomer(cleanPayload);
        toast.success("Customer created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("❌ Customer save failed:", err);
      toast.error("Failed to save customer");
    }
  };

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
  };

  const titleText = isView
    ? `View ${selectedCustomer?.customerCode || "Customer"}`
    : mode === "edit"
    ? `Edit ${selectedCustomer?.customerCode || "Customer"}`
    : "Add Customer";

  return (
    <Modal show={show} onHide={onClose} size="xl" centered backdrop="static">
      <Modal.Header closeButton>
        <div className="d-flex justify-content-between w-100">
          <div>
            <h2 className="page-title-modal">{titleText}</h2>
            <p className="page-subtitle-modal">
              {isView
                ? "Detailed view of this customer."
                : mode === "edit"
                ? "Modify customer information."
                : "Create new customer record."}
            </p>
          </div>
          <div className="text-end me-4">
            <small>Code: {form.customerCode || "N/A"}</small>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="card-container-modal">
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Customer Code */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="customerCode"
                    className={`form-control ${
                      touched.customerCode && formErrors.customerCode
                        ? "is-invalid"
                        : ""
                    }`}
                    value={form.customerCode}
                    readOnly
                    disabled
                  />
                  <label>Customer Code</label>
                  {formErrors.customerCode && (
                    <div className="invalid-feedback">
                      {formErrors.customerCode}
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

              {/* Owner */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="owner"
                    className={`form-control ${
                      touched.owner && formErrors.owner ? "is-invalid" : ""
                    }`}
                    value={form.owner}
                    readOnly={isView}
                    onChange={(e) => validateField("owner", e.target.value)}
                  />
                  <label>Owner</label>
                  {formErrors.owner && (
                    <div className="invalid-feedback">{formErrors.owner}</div>
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

              {/* City */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="city"
                    className={`form-control ${
                      touched.city && formErrors.city ? "is-invalid" : ""
                    }`}
                    value={form.city}
                    readOnly={isView}
                    onChange={(e) => validateField("city", e.target.value)}
                  />
                  <label>City</label>
                  {formErrors.city && (
                    <div className="invalid-feedback">{formErrors.city}</div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="col-md-6">
                <div className="form-floating">
                  <textarea
                    name="address"
                    className={`form-control ${
                      touched.address && formErrors.address ? "is-invalid" : ""
                    }`}
                    style={{ height: "90px" }}
                    value={form.address}
                    readOnly={isView}
                    onChange={(e) => validateField("address", e.target.value)}
                  />
                  <label>Address</label>
                  {formErrors.address && (
                    <div className="invalid-feedback">{formErrors.address}</div>
                  )}
                </div>
              </div>

              {/* Credit Limit */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="number"
                    name="creditLimit"
                    className={`form-control ${
                      touched.creditLimit && formErrors.creditLimit
                        ? "is-invalid"
                        : ""
                    }`}
                    value={form.creditLimit}
                    readOnly={isView}
                    onChange={(e) =>
                      validateField("creditLimit", e.target.value)
                    }
                  />
                  <label>Credit Limit</label>
                  {formErrors.creditLimit && (
                    <div className="invalid-feedback">
                      {formErrors.creditLimit}
                    </div>
                  )}
                </div>
              </div>

              {/* Credit Period */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="number"
                    name="creditPeriod"
                    className={`form-control ${
                      touched.creditPeriod && formErrors.creditPeriod
                        ? "is-invalid"
                        : ""
                    }`}
                    value={form.creditPeriod}
                    readOnly={isView}
                    onChange={(e) =>
                      validateField("creditPeriod", e.target.value)
                    }
                  />
                  <label>Credit Period (Days)</label>
                  {formErrors.creditPeriod && (
                    <div className="invalid-feedback">
                      {formErrors.creditPeriod}
                    </div>
                  )}
                </div>
              </div>

              {/* Sales Rep */}
              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    options={salesReps.map((r) => ({
                      label: `${r.repCode} — ${r.name}`,
                      value: r._id,
                    }))}
                    value={
                      form.salesRep
                        ? {
                            label:
                              salesReps.find((r) => r._id === form.salesRep)?.name ||
                              "Select Sales Rep",
                            value: form.salesRep,
                          }
                        : null
                    }
                    onChange={(opt) =>
                      setForm((p) => ({ ...p, salesRep: opt?.value || "" }))
                    }
                    styles={selectStyles}
                    placeholder=""
                  />
                  <label>Sales Representative</label>
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
                      { label: "Suspended", value: "suspended" },
                    ]}
                    value={
                      form.status
                        ? {
                            label: form.status === "active" ? "Active" : "Suspended",
                            value: form.status,
                          }
                        : null
                    }
                    onChange={(opt) =>
                      setForm((p) => ({
                        ...p,
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
            <Button className="action-btn-modal" onClick={onClose}>
              Close
            </Button>
          ) : (
            <Button
              type="submit"
              className="action-btn-modal"
              onClick={handleSubmit}
            >
              {mode === "edit" ? "Update Customer" : "Create Customer"}
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default CustomerModal;
