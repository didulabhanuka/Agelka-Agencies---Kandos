import React, { useEffect, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";

import {
  createSalesInvoice,
  updateSalesInvoice,
  deleteSalesInvoice,
  listAvailableSaleItems,
} from "../../../lib/api/sales.api";
import { listBranches } from "../../../lib/api/settings.api";
import { getCustomers } from "../../../lib/api/users.api";

import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

// ---------- Helper ----------
function generateInvoiceNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `INV-${yyyy}-${mm}-${dd}-${rand}`;
}

const buildEmptyForm = () => ({
  invoiceNo: generateInvoiceNo(),
  branch: "",
  customer: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  items: [
    {
      item: "",
      qty: 0,
      sellingPriceBase: 0,
      discountPerUnit: 0,
      lineTotal: 0,
    },
  ],
  remarks: "",
});

const SalesInvoiceCreateModal = ({
  show,
  mode = "create",
  selectedInvoice,
  onClose,
  onSuccess,
}) => {
  const isView = mode === "view";
  const isCreate = mode === "create";
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);
  const [stockInfo, setStockInfo] = useState({});
  const [totalValue, setTotalValue] = useState(0);
  const [form, setForm] = useState(buildEmptyForm);

  // ---------- Load base data ----------
  useEffect(() => {
    if (!show) return;

    (async () => {
      setLoading(true);
      try {
        const [brRes, custRes] = await Promise.all([
          listBranches(),
          getCustomers(),
        ]);
        setBranches(brRes.data || brRes || []);
        setCustomers(custRes || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    })();
  }, [show]);

  // ---------- Reset in CREATE ----------
  useEffect(() => {
    if (!show) return;
    if (isCreate) {
      setForm(buildEmptyForm());
      setTotalValue(0);
      setStockInfo({});
      setItemsMaster([]);
    }
  }, [show, isCreate]);

  // ---------- Load items for branch ----------
  const loadAvailableItemsForBranch = async (branchId) => {
    try {
      const res = await listAvailableSaleItems(branchId);
      const rows = res?.data || [];

      const mapped = rows.map((item) => ({
        value: item.itemId,
        label: `${item.itemCode} — ${item.itemName}`,
        itemId: item.itemId,
        qtyOnHand: item.qtyOnHand ?? 0,
        sellingPriceBase: Number(item.sellingPriceBase ?? 0),
        avgCostBase: Number(item.avgCostBase ?? 0),
      }));

      setItemsMaster(mapped);

      const stockMap = {};
      mapped.forEach((it) => {
        stockMap[it.value] = it.qtyOnHand;
      });
      setStockInfo(stockMap);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load available items");
      setItemsMaster([]);
      setStockInfo({});
    }
  };

  // ---------- Populate VIEW / EDIT ----------
  useEffect(() => {
    if (!show || !selectedInvoice || (!isView && !isEdit)) return;

    const mappedItems = (selectedInvoice.items || []).map((i) => {
      const price = Number(i.sellingPriceBase || 0);
      const qty = Number(i.qty || 0);
      const discountPerUnit = Number(i.discountPerUnit || 0);
      return {
        item: i.item?._id || i.item,
        qty,
        sellingPriceBase: price,
        discountPerUnit,
        lineTotal: qty * (price - discountPerUnit),
      };
    });

    setForm({
      invoiceNo: selectedInvoice.invoiceNo || generateInvoiceNo(),
      branch: selectedInvoice.branch?._id || "",
      customer: selectedInvoice.customer?._id || "",
      invoiceDate: selectedInvoice.invoiceDate
        ? selectedInvoice.invoiceDate.split("T")[0]
        : new Date().toISOString().split("T")[0],
      items: mappedItems.length ? mappedItems : buildEmptyForm().items,
      remarks: selectedInvoice.remarks || "",
    });

    setTotalValue(
      typeof selectedInvoice.totalValue === "number"
        ? selectedInvoice.totalValue
        : mappedItems.reduce((s, i) => s + i.lineTotal, 0)
    );

    if (selectedInvoice.branch?._id) {
      loadAvailableItemsForBranch(selectedInvoice.branch._id);
    }
  }, [show, isView, isEdit, selectedInvoice]);

  // ---------- Recalculate total ----------
  useEffect(() => {
    const total = form.items.reduce((sum, i) => {
      const qty = Number(i.qty || 0);
      const price = Number(i.sellingPriceBase || 0);
      const discount = Number(i.discountPerUnit || 0);
      return sum + qty * (price - discount);
    }, 0);
    setTotalValue(total);
  }, [form.items]);

  // ---------- Row ops ----------
  const addItem = () => {
    setForm((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          item: "",
          qty: 0,
          sellingPriceBase: 0,
          discountPerUnit: 0,
          lineTotal: 0,
        },
      ],
    }));
  };

  const removeItem = (index) => {
    if (form.items.length === 1) return;
    const items = [...form.items];
    items.splice(index, 1);
    setForm((p) => ({ ...p, items }));
  };

  const canDelete =
    !isCreate &&
    selectedInvoice &&
    ["draft", "waiting_for_approval"].includes(selectedInvoice.status);

  // ---------- Submit ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return onClose?.();

    if (!form.branch || !form.customer) {
      toast.warning("Please select both branch and customer");
      return;
    }

    const payloadItems = form.items.map((i) => ({
      item: i.item,
      qty: Number(i.qty || 0),
      sellingPriceBase: Number(i.sellingPriceBase || 0),
      discountPerUnit: Number(i.discountPerUnit || 0),
    }));

    const payload = {
      invoiceNo: form.invoiceNo,
      branch: form.branch,
      customer: form.customer,
      invoiceDate: form.invoiceDate,
      items: payloadItems,
      remarks: form.remarks,
      totalValue,
    };

    try {
      setLoading(true);
      if (isEdit && selectedInvoice?._id) {
        await updateSalesInvoice(selectedInvoice._id, payload);
        toast.success("Sales Invoice updated successfully");
      } else {
        await createSalesInvoice(payload);
        toast.success("Sales Invoice created successfully");
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

  // ---------- Delete ----------
  const handleDelete = async () => {
    if (!selectedInvoice?._id) return;
    if (!window.confirm(`Delete Invoice ${selectedInvoice.invoiceNo}?`)) return;

    try {
      setLoading(true);
      await deleteSalesInvoice(selectedInvoice._id);
      toast.success("Invoice deleted successfully");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete Sales Invoice");
    } finally {
      setLoading(false);
    }
  };

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? "#5c3e94" : "#d1d5db",
      minHeight: "48px",
    }),
  };

  return (
    <Modal show={show} onHide={onClose} size="xl" centered backdrop="static">
      <Modal.Header closeButton>
        <h4>{isEdit ? "Edit" : isView ? "View" : "Create"} Sales Invoice</h4>
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit}>
          <table className="modern-table-modal">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Price</th>
                <th className="text-end">Discount / Unit</th>
                <th className="text-end">Line Total</th>
                {!isView && <th />}
              </tr>
            </thead>
            <tbody>
              {form.items.map((row, i) => {
                const stock = stockInfo[row.item] ?? 0;

                return (
                  <tr key={i}>
                    <td>
                      <Select
                        isDisabled={isView}
                        options={itemsMaster}
                        value={
                          row.item
                            ? itemsMaster.find((x) => x.value === row.item)
                            : null
                        }
                        onChange={(opt) => {
                          const items = [...form.items];
                          items[i].item = opt?.value || "";
                          items[i].sellingPriceBase = Number(
                            opt?.sellingPriceBase || 0
                          );
                          const d = Math.min(
                            items[i].discountPerUnit,
                            items[i].sellingPriceBase
                          );
                          items[i].discountPerUnit = d;
                          items[i].lineTotal =
                            items[i].qty *
                            (items[i].sellingPriceBase - d);
                          setForm((p) => ({ ...p, items }));
                        }}
                        styles={selectStyles}
                      />
                      {row.item && (
                        <small className="text-info">Stock: {stock}</small>
                      )}
                    </td>

                    <td>
                      <input
                        type="number"
                        className="form-control text-end"
                        value={row.qty}
                        readOnly={isView}
                        onChange={(e) => {
                          const items = [...form.items];
                          items[i].qty = Number(e.target.value || 0);
                          items[i].lineTotal =
                            items[i].qty *
                            (items[i].sellingPriceBase -
                              items[i].discountPerUnit);
                          setForm((p) => ({ ...p, items }));
                        }}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        className="form-control text-end"
                        value={row.sellingPriceBase}
                        readOnly={isView}
                        onChange={(e) => {
                          const items = [...form.items];
                          items[i].sellingPriceBase = Number(e.target.value || 0);
                          items[i].discountPerUnit = Math.min(
                            items[i].discountPerUnit,
                            items[i].sellingPriceBase
                          );
                          items[i].lineTotal =
                            items[i].qty *
                            (items[i].sellingPriceBase -
                              items[i].discountPerUnit);
                          setForm((p) => ({ ...p, items }));
                        }}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        className="form-control text-end"
                        value={row.discountPerUnit}
                        readOnly={isView}
                        onChange={(e) => {
                          const items = [...form.items];
                          items[i].discountPerUnit = Math.min(
                            Number(e.target.value || 0),
                            items[i].sellingPriceBase
                          );
                          items[i].lineTotal =
                            items[i].qty *
                            (items[i].sellingPriceBase -
                              items[i].discountPerUnit);
                          setForm((p) => ({ ...p, items }));
                        }}
                      />
                    </td>

                    <td className="text-end">
                      Rs. {row.lineTotal.toFixed(2)}
                    </td>

                    {!isView && (
                      <td>
                        {i === form.items.length - 1 ? (
                          <i
                            className="bi bi-plus-circle"
                            onClick={addItem}
                          />
                        ) : (
                          <i
                            className="bi bi-dash-circle"
                            onClick={() => removeItem(i)}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h5 className="text-end mt-3">Total: Rs. {totalValue.toFixed(2)}</h5>

          <div className="text-end mt-4">
            {canDelete && (
              <Button variant="danger" onClick={handleDelete} className="me-2">
                Delete
              </Button>
            )}
            <Button type="submit">
              {isEdit ? "Update Invoice" : "Create Invoice"}
            </Button>
          </div>
        </form>
      </Modal.Body>

      <ToastContainer position="top-right" autoClose={2000} />
    </Modal>
  );
};

export default SalesInvoiceCreateModal;
