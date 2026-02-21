import React, { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { Modal, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { getSuppliers , createSupplier, updateSupplier, getSalesReps  } from "../../../lib/api/users.api";

import { supplierValidator } from "../../../lib/validation/user.validator";
import { z } from "zod";

const SupplierModal = ({ show, mode, selectedSupplier, onClose, onSuccess }) => {
  const isView = mode === "view";

  const formRef = useRef(null);

  // --------------------------------------------------
  // Generate next Supplier Code (SUP-001)
  // --------------------------------------------------
  const generateNextSupplierCode = (suppliers = []) => {
    const max = suppliers.reduce((acc, s) => {
      const match = s.supplierCode?.match(/^SUP-(\d+)$/);
      if (!match) return acc;
      return Math.max(acc, parseInt(match[1], 10));
    }, 0);

    return `SUP-${String(max + 1).padStart(3, "0")}`;
  };


  // ------------------------------------------------------------
  // Local Form State
  // ------------------------------------------------------------
  const [form, setForm] = useState({
    supplierCode: "",
    name: "",
    owner: "",
    address: "",
    contactNumber: "",
    salesRep: null, 
    status: "active",
  });

  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [salesReps, setSalesReps] = useState([]);  

  // Fetch SalesReps
  useEffect(() => {
    const fetchSalesReps = async () => {
      try {
        const data = await getSalesReps(); // API call to fetch SalesReps
        setSalesReps(data || []);
      } catch (err) {
        console.error("❌ Failed to fetch SalesReps:", err);
      }
    };
    fetchSalesReps();
  }, []);

  // ------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------
  const focusFirstInvalidField = () => {
    setTimeout(() => {
      const invalid = formRef.current?.querySelector(".is-invalid");
      if (invalid) invalid.focus();
    }, 100);
  };

  const validateForm = (data) => {
    const errors = {};

    // Step 1: Empty fields
    Object.entries(data).forEach(([k, v]) => {
      if (!v?.toString().trim()) errors[k] = "Please fill this field";
    });

    // Step 2: Zod validation
    try {
      supplierValidator.parse(data);
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
      supplierValidator.shape[field]?.parse(value);
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    } catch (err) {
      let msg = "Invalid value";
      if (err instanceof z.ZodError)
        msg = err.issues?.[0]?.message || msg;
      setFormErrors((prev) => ({ ...prev, [field]: msg }));
    }
  };

  // ------------------------------------------------------------
  // Hydrate form when opening modal or selecting an item
  // ------------------------------------------------------------
  useEffect(() => {
    const initCreate = async () => {
      const suppliers = await getSuppliers();
      const nextCode = generateNextSupplierCode(suppliers || []);

      setForm({
        supplierCode: nextCode,
        name: "",
        owner: "",
        address: "",
        contactNumber: "",
        salesRep: null,
        status: "active",
      });

      setFormErrors({});
      setTouched({});
    };

    if (selectedSupplier) {
      setForm({
        supplierCode: selectedSupplier.supplierCode || "",
        name: selectedSupplier.name || "",
        owner: selectedSupplier.owner || "",
        address: selectedSupplier.address || "",
        contactNumber: selectedSupplier.contactNumber || "",
        salesRep: selectedSupplier.salesRep?._id || null,
        status: selectedSupplier.status || "active",
      });

      setFormErrors({});
      setTouched({});
    } else if (show && mode === "create") {
      initCreate();
    }
  }, [selectedSupplier, mode, show]);


  // ------------------------------------------------------------
  // Submit handler (create or update)
  // ------------------------------------------------------------
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
      if (mode === "edit" && selectedSupplier?._id) {
        await updateSupplier(selectedSupplier._id, form);
        toast.success("Supplier updated successfully");
      } else {
        await createSupplier(form);
        toast.success("Supplier created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("❌ Failed to save supplier:", err);
      toast.error("Failed to save supplier");
    }
  };

  // ------------------------------------------------------------
  // Status dropdown styling (react-select)
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // Modal Title
  // ------------------------------------------------------------
  const titleText = isView
    ? `View ${selectedSupplier?.supplierCode || "Supplier"}`
    : mode === "edit"
    ? `Edit ${selectedSupplier?.supplierCode || "Supplier"}`
    : "Add Supplier";

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <Modal show={show} onHide={onClose} centered backdrop="static" size="lg">
      {/* ---------------- HEADER ---------------- */}
      <Modal.Header closeButton>
        <div className="d-flex justify-content-between w-100">
          <div>
            <h2 className="page-title-modal">{titleText}</h2>
            <p className="page-subtitle-modal">
              {isView
                ? "Detailed view of this supplier."
                : mode === "edit"
                ? "Modify supplier details."
                : "Create a new supplier record."}
            </p>
          </div>

          <div className="text-end me-4">
            <small>Code: {form.supplierCode || "N/A"}</small>
          </div>
        </div>
      </Modal.Header>

      {/* ---------------- BODY ---------------- */}
      <Modal.Body>
        <div className="card-container-modal">
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Supplier Code */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="supplierCode"
                    className={`form-control ${
                      touched.supplierCode && formErrors.supplierCode
                        ? "is-invalid"
                        : ""
                    }`}
                    value={form.supplierCode}
                    readOnly
                    disabled
                  />
                  <label>Supplier Code</label>
                  {formErrors.supplierCode && (
                    <div className="invalid-feedback">
                      {formErrors.supplierCode}
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

              {/* Sales Rep */}
              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    name="salesRep"
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
                              salesReps.find((r) => r._id === form.salesRep)?.
                                name || "Select Sales Rep",
                            value: form.salesRep,
                          }
                        : null
                    }
                    onChange={(opt) =>
                      setForm((prev) => ({ ...prev, salesRep: opt?.value || "" }))
                    }
                    styles={selectStyles}
                    placeholder=""
                  />
                  <label>Sales Representative</label>
                  {formErrors.salesRep && (
                    <div className="invalid-feedback">{formErrors.salesRep}</div>
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

        {/* ---------------- FOOTER ---------------- */}
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
              {mode === "edit" ? "Update Supplier" : "Create Supplier"}
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default SupplierModal;
