// import React, { useState, useEffect } from "react";
// import Select from "react-select";
// import CreatableSelect from "react-select/creatable";
// import { Modal, Button } from "react-bootstrap";
// import { toast } from "react-toastify";
// import {
//   createProductGroup,
//   updateProductGroup,
// } from "../../../lib/api/settings.api";

// const GroupModal = ({ show, mode, selectedGroup, onClose, onSuccess }) => {
//   const isView = mode === "view";

//   // --------------------------------------------------
//   // Form State
//   // --------------------------------------------------
//   const [form, setForm] = useState({
//     groupCode: "",
//     name: "",
//     description: "",
//     status: "active",
//     units: [], // NEW FIELD
//   });

//   // --------------------------------------------------
//   // Load selectedGroup into form when modal opens
//   // --------------------------------------------------
//   useEffect(() => {
//     if (selectedGroup) {
//       setForm({
//         groupCode: selectedGroup.groupCode || "",
//         name: selectedGroup.name || "",
//         description: selectedGroup.description || "",
//         status: selectedGroup.status || "active",
//         units: selectedGroup.units || [], // NEW
//       });
//     } else {
//       setForm({
//         groupCode: "",
//         name: "",
//         description: "",
//         status: "active",
//         units: [], // NEW
//       });
//     }
//   }, [selectedGroup, mode, show]);

//   // --------------------------------------------------
//   // Handlers
//   // --------------------------------------------------
//   const handleChange = (e) => {
//     if (isView) return;
//     const { name, value } = e.target;
//     setForm((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleStatusChange = (opt) => {
//     if (isView) return;
//     setForm((prev) => ({ ...prev, status: opt?.value || "active" }));
//   };

//   // ---- NEW: Units Handler ----
//   const handleUnitsChange = (values) => {
//     if (isView) return;
//     const unitStrings = values.map((v) => v.value);
//     setForm((prev) => ({ ...prev, units: unitStrings }));
//   };

//   // --------------------------------------------------
//   // Submit
//   // --------------------------------------------------
//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (isView) return;

//     try {
//       if (mode === "edit" && selectedGroup?._id) {
//         await updateProductGroup(selectedGroup._id, form);
//         toast.success("Group updated successfully");
//       } else {
//         await createProductGroup(form);
//         toast.success("Group created successfully");
//       }

//       onSuccess?.();
//       onClose();
//     } catch (err) {
//       console.error("❌ Failed to save group:", err);
//       toast.error("Failed to save group");
//     }
//   };

//   // --------------------------------------------------
//   // react-select styles
//   // --------------------------------------------------
//   const selectStyles = {
//     control: (base, state) => ({
//       ...base,
//       backgroundColor: "#fff",
//       borderColor: state.isFocused ? "#5c3e94" : "#d1d5db",
//       minHeight: "48px",
//       boxShadow: state.isFocused ? "0 0 0 1px #5c3e94" : "none",
//       "&:hover": { borderColor: "#5c3e94" },
//     }),
//     singleValue: (b) => ({ ...b, color: "#374151" }),
//   };

//   const titleText = isView
//     ? `View ${selectedGroup?.groupCode || "Group"}`
//     : mode === "edit"
//     ? `Edit ${selectedGroup?.groupCode || "Group"}`
//     : "Add Product Group";

//   // --------------------------------------------------
//   // Render
//   // --------------------------------------------------
//   return (
//     <Modal show={show} onHide={onClose} centered backdrop="static" size="lg">
//       {/* ---------------- HEADER ---------------- */}
//       <Modal.Header closeButton>
//         <div className="d-flex justify-content-between w-100">
//           <div>
//             <h2 className="page-title-modal">{titleText}</h2>
//             <p className="page-subtitle-modal">
//               {isView
//                 ? "Detailed view of this product group."
//                 : mode === "edit"
//                 ? "Modify product group details."
//                 : "Create a new product group."}
//             </p>
//           </div>
//           <div className="text-end me-4">
//             <small>Code: {form.groupCode || "N/A"}</small>
//           </div>
//         </div>
//       </Modal.Header>

//       {/* ---------------- BODY ---------------- */}
//       <Modal.Body>
//         <div className="card-container-modal">
//           <form onSubmit={handleSubmit}>
//             <div className="row g-3">

//               {/* Group Code */}
//               <div className="col-md-6">
//                 <div className="form-floating">
//                   <input
//                     type="text"
//                     name="groupCode"
//                     className="form-control"
//                     value={form.groupCode}
//                     onChange={handleChange}
//                     readOnly={isView}
//                     required={!isView}
//                   />
//                   <label>Group Code</label>
//                 </div>
//               </div>

//               {/* Name */}
//               <div className="col-md-6">
//                 <div className="form-floating">
//                   <input
//                     type="text"
//                     name="name"
//                     className="form-control"
//                     value={form.name}
//                     onChange={handleChange}
//                     readOnly={isView}
//                     required={!isView}
//                   />
//                   <label>Name</label>
//                 </div>
//               </div>

//               {/* Description */}
//               <div className="col-md-12">
//                 <div className="form-floating">
//                   <textarea
//                     name="description"
//                     className="form-control"
//                     style={{ height: "90px" }}
//                     value={form.description}
//                     onChange={handleChange}
//                     readOnly={isView}
//                     required={!isView}
//                   />
//                   <label>Description</label>
//                 </div>
//               </div>

//               {/* ---------------- UNITS (NEW) ---------------- */}
//               <div className="col-md-12">
//                 <div className="form-floating react-select-floating">
//                   <CreatableSelect
//                     classNamePrefix="react-select"
//                     isDisabled={isView}
//                     isMulti
//                     value={(form.units || []).map((u) => ({
//                       label: u,
//                       value: u,
//                     }))}
//                     onChange={handleUnitsChange}
//                     styles={selectStyles}
//                     placeholder=""
//                   />
//                   <label>Units</label>
//                 </div>
//               </div>

//               {/* Status */}
//               <div className="col-md-6">
//                 <div className="form-floating react-select-floating">
//                   <Select
//                     classNamePrefix="react-select"
//                     isDisabled={isView}
//                     options={[
//                       { label: "Active", value: "active" },
//                       { label: "Inactive", value: "inactive" },
//                     ]}
//                     value={
//                       form.status
//                         ? {
//                             label: form.status === "active" ? "Active" : "Inactive",
//                             value: form.status,
//                           }
//                         : null
//                     }
//                     onChange={handleStatusChange}
//                     styles={selectStyles}
//                     placeholder=""
//                   />
//                   <label>Status</label>
//                 </div>
//               </div>

//             </div>
//           </form>
//         </div>

//         {/* ---------------- FOOTER ---------------- */}
//         <div className="col-12 text-end mt-4">
//           {isView ? (
//             <Button type="button" className="action-btn-modal" onClick={onClose}>
//               Close
//             </Button>
//           ) : (
//             <Button
//               type="submit"
//               className="action-btn-modal"
//               onClick={handleSubmit}
//             >
//               {mode === "edit" ? "Update Product Group" : "Create Product Group"}
//             </Button>
//           )}
//         </div>
//       </Modal.Body>
//     </Modal>
//   );
// };

// export default GroupModal;







import React, { useState, useEffect } from "react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { Modal, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import {
  createProductGroup,
  updateProductGroup,
} from "../../../lib/api/settings.api";

const GroupModal = ({ show, mode, selectedGroup, onClose, onSuccess }) => {
  const isView = mode === "view";

  // --------------------------------------------------
  // Form State
  // --------------------------------------------------
  const [form, setForm] = useState({
    name: "", // UOM name
    code: "", // UOM code (auto-generated)
    uomType: "primary", // Default UOM type
    status: "active", // Default status
  });

  // --------------------------------------------------
  // Load selectedGroup into form when modal opens
  // --------------------------------------------------
  useEffect(() => {
    if (selectedGroup) {
      setForm({
        name: selectedGroup.name || "", // Set name from selectedGroup
        code: selectedGroup.code || "", // Set code from selectedGroup
        uomType: selectedGroup.uomType || "primary", // Set uomType from selectedGroup
        status: selectedGroup.status || "active", // Set status from selectedGroup
      });
    } else {
      setForm({
        name: "", // Empty name
        code: "", // Empty code
        uomType: "primary", // Default to primary
        status: "active", // Default to active
      });
    }
  }, [selectedGroup, mode, show]);

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------
  const handleChange = (e) => {
    if (isView) return;
    const { name, value } = e.target;

    // Auto-generate UOM code based on UOM name (convert to uppercase)
    if (name === "name") {
      const generatedCode = value.toUpperCase();
      setForm((prev) => ({ ...prev, name: value, code: generatedCode }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleStatusChange = (opt) => {
    if (isView) return;
    setForm((prev) => ({ ...prev, status: opt?.value || "active" }));
  };

  // ---- NEW: UOM Type Handler ----
  const handleUOMTypeChange = (opt) => {
    if (isView) return;
    setForm((prev) => ({ ...prev, uomType: opt.value }));
  };

  // --------------------------------------------------
  // Submit
  // --------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return;

    try {
      if (mode === "edit" && selectedGroup?._id) {
        await updateProductGroup(selectedGroup._id, form);
        toast.success("UOM updated successfully");
      } else {
        await createProductGroup(form);
        toast.success("UOM created successfully");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("❌ Failed to save UOM:", err);
      toast.error("Failed to save UOM");
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
    singleValue: (b) => ({ ...b, color: "#374151" }),
  };

  const titleText = isView
    ? `View ${selectedGroup?.code || "UOM"}`
    : mode === "edit"
    ? `Edit ${selectedGroup?.code || "UOM"}`
    : "Add UOM";

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
                ? "Detailed view of this UOM."
                : mode === "edit"
                ? "Modify UOM details."
                : "Create a new UOM."}
            </p>
          </div>
          <div className="text-end me-4">
            <small>Code: {form.code || "N/A"}</small>
          </div>
        </div>
      </Modal.Header>

      {/* ---------------- BODY ---------------- */}
      <Modal.Body>
        <div className="card-container-modal">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">

              {/* ---------------- UOM Name ---------------- */}
              <div className="col-md-12">
                <div className="form-floating">
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    value={form.name}
                    onChange={handleChange}
                    readOnly={isView}
                    placeholder="Enter UOM name"
                  />
                  <label>UOM Name</label>
                </div>
              </div>

              {/* ---------------- UOM Code ---------------- */}
              <div className="col-md-12">
                <div className="form-floating">
                  <input
                    type="text"
                    name="code"
                    className="form-control"
                    value={form.code}
                    readOnly
                    placeholder="UOM code will be auto-generated"
                  />
                  <label>UOM Code (Auto-generated)</label>
                </div>
              </div>

              {/* ---------------- UOM Type Selection ---------------- */}
              <div className="col-md-12">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    options={[
                      { label: "Primary UOM", value: "primary" },
                      { label: "Base UOM", value: "base" },
                    ]}
                    value={{
                      label: form.uomType === "primary" ? "Primary UOM" : "Base UOM",
                      value: form.uomType,
                    }}
                    onChange={handleUOMTypeChange}
                    styles={selectStyles}
                    placeholder=""
                  />
                  <label>UOM Type</label>
                </div>
              </div>

              {/* ---------------- Status Selection ---------------- */}
              <div className="col-md-12">
                <div className="form-floating react-select-floating">
                  <Select
                    classNamePrefix="react-select"
                    isDisabled={isView}
                    options={[
                      { label: "Active", value: "active" },
                      { label: "Inactive", value: "inactive" },
                    ]}
                    value={{
                      label: form.status === "active" ? "Active" : "Inactive",
                      value: form.status,
                    }}
                    onChange={handleStatusChange}
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
              {mode === "edit" ? "Update UOM" : "Create UOM"}
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default GroupModal;
