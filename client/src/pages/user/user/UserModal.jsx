import React, { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { Modal, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { createUser, updateUser } from "../../../lib/api/users.api";

import { userValidator } from "../../../lib/validation/user.validator";
import { z } from "zod";

const UserModal = ({
  show,
  mode,
  selectedUser,
  branches,
  onClose,
  onSuccess,
}) => {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isCreate = mode === "create";

  const formRef = useRef(null);

  // --------------------------------------------------
  // Local State
  // --------------------------------------------------
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "",
    number: "",
    branch: "",
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

    Object.entries(data).forEach(([k, v]) => {
      if (k !== "branch" && !v?.toString().trim())
        errors[k] = "Please fill this field";
    });

    try {
      userValidator.parse(data);
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

    if (field !== "branch" && !value?.toString().trim()) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    try {
      userValidator.shape[field]?.parse(value);
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    } catch (err) {
      let msg = "Invalid value";
      if (err instanceof z.ZodError)
        msg = err.issues?.[0]?.message || msg;
      setFormErrors((prev) => ({ ...prev, [field]: msg }));
    }
  };

  // --------------------------------------------------
  // Initialize form when modal opens
  // --------------------------------------------------
  useEffect(() => {
    if (selectedUser && (isEdit || isView)) {
      setForm({
        username: selectedUser.username || "",
        email: selectedUser.email || "",
        password: "",
        role: selectedUser.role || "",
        number: selectedUser.number || "",
        branch: selectedUser.branch?._id || "",
      });
      setFormErrors({});
      setTouched({});
    } else {
      setForm({
        username: "",
        email: "",
        password: "",
        role: "",
        number: "",
        branch: "",
      });
      setFormErrors({});
      setTouched({});
    }
  }, [selectedUser, mode, show]);

  // --------------------------------------------------
  // Helpers
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
    singleValue: (b) => ({ ...b, color: "#374151" }),
  };

  // Modal Title
  const titleText = isView
    ? `View ${selectedUser?.username || "User"}`
    : isEdit
    ? `Edit ${selectedUser?.username || "User"}`
    : "Add User";

  // --------------------------------------------------
  // Submit (create or update)
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
      if (isEdit && selectedUser?._id) {
        await updateUser(selectedUser._id, form);
        toast.success("User updated successfully");
      } else {
        await createUser(form);
        toast.success("User created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save user");
    }
  };

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
                ? "Detailed view of system user."
                : isEdit
                ? "Modify user account."
                : "Create a new system user."}
            </p>
          </div>

          <div className="text-end me-4">
            <small>{form.username || "New User"}</small>
          </div>
        </div>
      </Modal.Header>

      {/* ---------------- BODY ---------------- */}
      <Modal.Body>
        <div className="card-container-modal">
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* Username */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="username"
                    className={`form-control ${
                      touched.username && formErrors.username
                        ? "is-invalid"
                        : ""
                    }`}
                    value={form.username}
                    disabled={isView}
                    onChange={(e) =>
                      validateField("username", e.target.value)
                    }
                  />
                  <label>Username</label>
                  {formErrors.username && (
                    <div className="invalid-feedback">
                      {formErrors.username}
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="email"
                    name="email"
                    className={`form-control ${
                      touched.email && formErrors.email ? "is-invalid" : ""
                    }`}
                    value={form.email}
                    disabled={isView}
                    onChange={(e) => validateField("email", e.target.value)}
                  />
                  <label>Email</label>
                  {formErrors.email && (
                    <div className="invalid-feedback">{formErrors.email}</div>
                  )}
                </div>
              </div>

              {/* Password */}
              {!isView && (
                <div className="col-md-6">
                  <div className="form-floating">
                    <input
                      type="password"
                      name="password"
                      className={`form-control ${
                        touched.password && formErrors.password
                          ? "is-invalid"
                          : ""
                      }`}
                      value={form.password}
                      onChange={(e) =>
                        validateField("password", e.target.value)
                      }
                    />
                    <label>Password</label>
                    {formErrors.password && (
                      <div className="invalid-feedback">
                        {formErrors.password}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Number */}
              <div className="col-md-6">
                <div className="form-floating">
                  <input
                    type="text"
                    name="number"
                    className={`form-control ${
                      touched.number && formErrors.number ? "is-invalid" : ""
                    }`}
                    value={form.number}
                    disabled={isView}
                    onChange={(e) => validateField("number", e.target.value)}
                  />
                  <label>Contact Number</label>
                  {formErrors.number && (
                    <div className="invalid-feedback">
                      {formErrors.number}
                    </div>
                  )}
                </div>
              </div>

              {/* Role */}
              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    options={[
                      { label: "Admin", value: "Admin" },
                      { label: "Data Entry", value: "DataEntry" },
                    ]}
                    value={
                      form.role
                        ? {
                            label:
                              form.role === "Admin"
                                ? "Admin"
                                : "Data Entry",
                            value: form.role,
                          }
                        : null
                    }
                    onChange={(opt) =>
                      validateField("role", opt?.value || "")
                    }
                    styles={selectStyles}
                    placeholder=""
                  />
                  <label>Role</label>
                  {touched.role && formErrors.role && (
                    <small className="text-danger">{formErrors.role}</small>
                  )}
                </div>
              </div>

              {/* Branch */}
              <div className="col-md-6">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    options={branches.map((b) => ({
                      label: `${b.branchCode} – ${b.name}`,
                      value: b._id,
                    }))}
                    value={
                      form.branch
                        ? {
                            label:
                              branches.find((b) => b._id === form.branch)?.name ||
                              "Select Branch",
                            value: form.branch,
                          }
                        : null
                    }
                    onChange={(opt) =>
                      validateField("branch", opt?.value || "")
                    }
                    styles={selectStyles}
                    placeholder=""
                  />
                  <label>Branch</label>
                  {touched.branch && formErrors.branch && (
                    <small className="text-danger">{formErrors.branch}</small>
                  )}
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
              {isEdit ? "Update User" : "Create User"}
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default UserModal;
