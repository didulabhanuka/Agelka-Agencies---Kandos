// src/pages/sales/SalesInvoiceViewModal.jsx
import React, { useMemo, useRef } from "react";
import { Modal, Button } from "react-bootstrap";
import { useAuth } from "../../../context/AuthContext";
import { useReactToPrint } from "react-to-print";
import SalesInvoicePrintTemplate from "../../../components/print/SalesInvoicePrintTemplate";
import "bootstrap-icons/font/bootstrap-icons.css";
import "react-toastify/dist/ReactToastify.css";

const SalesInvoiceViewModal = ({
  show,
  invoice,
  onClose,
  onViewReturn,
  onOpenPayment,
}) => {
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

  if (!invoice) return null;

  // -----------------------------------------
  // Print
  // -----------------------------------------
  const printRef = useRef(null);

  const handlePrintInvoice = useReactToPrint({
    contentRef: printRef,
    documentTitle: invoice?.invoiceNo || "Sales Invoice",
  });

  // -----------------------------------------
  // Helpers
  // -----------------------------------------
  const formatCurrency = (v) => `Rs. ${Number(v || 0).toFixed(2)}`;

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const getInvoiceStatusLabel = (status) => {
    switch (status) {
      case "draft":               return "Draft";
      case "waiting_for_approval": return "Waiting for Approval";
      case "approved":            return "Approved";
      case "cancelled":           return "Cancelled";
      default:                    return status || "-";
    }
  };

  const getPaymentStatusLabel = (status) => {
    switch (status) {
      case "paid":           return "Paid";
      case "partially_paid": return "Partially Paid";
      case "unpaid":
      default:               return "Unpaid";
    }
  };

  const getStatusBadgeClass = (type, value) => {
    if (type === "invoice") {
      if (value === "approved")  return "bg-success-subtle text-success-emphasis border border-success-subtle";
      if (value === "cancelled") return "bg-danger-subtle text-danger-emphasis border border-danger-subtle";
      return "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";
    }
    // payment
    if (value === "paid")           return "bg-success-subtle text-success-emphasis border border-success-subtle";
    if (value === "partially_paid") return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
    return "bg-danger-subtle text-danger-emphasis border border-danger-subtle";
  };

  // -----------------------------------------
  // Access safety (SalesRep can view only own invoices)
  // -----------------------------------------
  const invSalesRepId =
    invoice.salesRep?._id || invoice.salesRep || invoice.salesRepId || "";

  const hasAccess =
    !isSalesRep ||
    !loggedInSalesRepId ||
    String(invSalesRepId) === String(loggedInSalesRepId);

  if (!hasAccess) {
    return (
      <Modal show={show} onHide={onClose} centered backdrop="static">
        <Modal.Header closeButton>
          <h5 className="mb-0">Access denied</h5>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted">
            You don't have permission to view this invoice.
          </div>
          <div className="text-end mt-4">
            <Button className="action-btn-modal" onClick={onClose}>
              Close
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  // -----------------------------------------
  // Extract data
  // -----------------------------------------
  const items          = Array.isArray(invoice.items)              ? invoice.items              : [];
  const embeddedReturns = Array.isArray(invoice.returns)           ? invoice.returns            : [];
  const payments        = Array.isArray(invoice.paymentAllocations) ? invoice.paymentAllocations : [];
  const remainingItems  = Array.isArray(invoice.remainingItems)    ? invoice.remainingItems     : [];

  // -----------------------------------------
  // Returned qty map
  // -----------------------------------------
  const returnedByItem = useMemo(() => {
    const map = new Map();

    embeddedReturns.forEach((ret) => {
      (ret.items || []).forEach((it) => {
        const key = String(it.item?._id || it.item || "");
        if (!key) return;

        const prev = map.get(key) || {
          qtyReturned: 0,
          baseQtyReturned: 0,
          primaryQtyReturned: 0,
          totalValueReturned: 0,
        };

        const qtyReturnedLegacy  = Number(it.qtyReturned || 0);
        const baseReturned       = Number(it.qtyReturnedBase    ?? it.baseQtyReturned  ?? it.baseQty    ?? 0);
        const primaryReturned    = Number(it.qtyReturnedPrimary ?? it.primaryQtyReturned ?? it.primaryQty ?? 0);
        const totalValueReturned = Number(
          it.totalValueReturned ??
          (Number(it.valueReturnedBase || 0) + Number(it.valueReturnedPrimary || 0)) ??
          0
        );

        map.set(key, {
          qtyReturned:        prev.qtyReturned        + qtyReturnedLegacy,
          baseQtyReturned:    prev.baseQtyReturned    + baseReturned,
          primaryQtyReturned: prev.primaryQtyReturned + primaryReturned,
          totalValueReturned: prev.totalValueReturned + totalValueReturned,
        });
      });
    });

    return map;
  }, [embeddedReturns]);

  // -----------------------------------------
  // Remaining totals map
  // -----------------------------------------
  const remainingByItem = useMemo(() => {
    const map = new Map();
    remainingItems.forEach((r) => {
      const key = String(r.item?._id || r.item || "");
      if (!key) return;
      map.set(key, {
        remainingPrimaryQty: Number(r.remainingPrimaryQty || 0),
        remainingBaseQty:    Number(r.remainingBaseQty    || 0),
        remainingTotalBase:  Number(r.remainingTotalBase  || 0),
        factorToBase:        Number(r.factorToBase        || 0),
      });
    });
    return map;
  }, [remainingItems]);

  // -----------------------------------------
  // Totals
  // -----------------------------------------
  const subTotal   = Number(invoice.totalValue          || 0);
  const returnTotal = Number(invoice.totalReturnedValue || 0);
  const finalTotal  =
    invoice.totalBalanceValue != null
      ? Number(invoice.totalBalanceValue)
      : subTotal - returnTotal;
  const paidAmount = Number(invoice.paidAmount || 0);
  const dueAmount  = Math.max(0, finalTotal - paidAmount);

  const itemCount    = items.length;
  const returnCount  = embeddedReturns.length;
  const paymentCount = payments.length;

  // -----------------------------------------
  // Printable payload
  // -----------------------------------------
  const printableInvoice = useMemo(() => ({
    ...invoice,
    items,
    paymentAllocations: payments,
    remainingItems,
    totalValue:         subTotal,
    totalReturnedValue: returnTotal,
    totalBalanceValue:  finalTotal,
    paidAmount,
  }), [invoice, items, payments, remainingItems, subTotal, returnTotal, finalTotal, paidAmount]);

  // -----------------------------------------
  // Payment click handler
  // Resolve the real payment ID from the allocation entry and pass it up.
  // The allocation object shape can be:
  //   { paymentId: "abc" | { _id: "abc" }, paymentNo, amount, ... }
  //   or just the raw payment: { _id: "abc", paymentNo, ... }
  // -----------------------------------------
  const handlePaymentClick = (p) => {
    if (!onOpenPayment) return;
    const paymentId =
      p?.paymentId?._id ||
      p?.paymentId ||
      p?._id ||
      null;
    onOpenPayment(paymentId);
  };

  // -----------------------------------------
  // Render
  // -----------------------------------------
  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="sales-invoice-view-modal"
    >
      <style>{`
        .sales-invoice-view-modal { max-width: 96vw !important; width: 96vw; }
        .sales-invoice-view-modal .modal-content { height: 92vh; border-radius: 16px; overflow: hidden; }
        .sales-invoice-view-modal .modal-header {
          border-bottom: 1px solid #eef0f4; padding: 14px 18px;
          background: rgb(25, 25, 25); position: sticky; top: 0; z-index: 20;
        }
        .sales-invoice-view-modal .modal-body {
          background: #f8fafc; overflow: auto; padding: 14px 16px 0 16px;
        }
        .siv-card {
          background: #fff; border: 1px solid #e9edf3; border-radius: 14px;
          padding: 14px; box-shadow: 0 2px 8px rgba(16,24,40,.04);
        }
        .siv-card-title {
          font-size: .86rem; font-weight: 700; color: #475467;
          margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
        }
        .siv-stat {
          border: 1px solid #e9edf3; background: #fff;
          border-radius: 12px; padding: 10px 12px; min-width: 140px;
        }
        .siv-stat .k { color: #667085; font-size: 12px; margin-bottom: 2px; }
        .siv-stat .v { color: #111827; font-weight: 700; font-size: 15px; }
        .siv-table-wrap {
          border: 1px solid #e9edf3; border-radius: 12px;
          overflow: auto; max-height: 48vh; background: #fff;
        }
        .siv-table {
          width: 100%; min-width: 1420px;
          border-collapse: separate; border-spacing: 0;
        }
        .siv-table thead th {
          position: sticky; top: 0; z-index: 5; background: #f8fafc;
          border-bottom: 1px solid #e9edf3; color: #475467;
          font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .02em; padding: 10px 8px; white-space: nowrap;
        }
        .siv-table tbody td {
          border-bottom: 1px solid #f1f3f7; padding: 8px;
          vertical-align: top; background: #fff;
        }
        .siv-table tbody tr:hover td { background: #faf7ff; }
        .siv-link-btn {
          background: none; border: none; font-weight: 600;
          color: #5c3e94; text-decoration: underline; cursor: pointer;
          padding: 0; text-align: left;
        }
        .siv-list-row {
          display: grid; grid-template-columns: 1.3fr .9fr 1fr;
          gap: 8px; align-items: center; padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .siv-list-row:last-child { border-bottom: none; }
        .siv-side-scroll { max-height: 240px; overflow: auto; }
        .siv-footer {
          position: sticky; bottom: 0; z-index: 10; background: #fff;
          border-top: 1px solid #eef0f4; padding: 12px 16px; margin: 0 -16px;
        }
        .siv-pill {
          display: inline-flex; align-items: center; gap: 6px;
          border-radius: 999px; border: 1px solid #e5e7eb; background: #f8fafc;
          color: #475467; padding: 4px 10px; font-size: 12px; font-weight: 600;
          white-space: nowrap;
        }
      `}</style>

      {/* HEADER */}
      <Modal.Header closeButton>
        <div className="d-flex justify-content-between align-items-start w-100 gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <h2 className="page-title-modal mb-0">Sales Invoice</h2>
              <span className={`badge rounded-pill ${getStatusBadgeClass("invoice", invoice.status)}`}>
                {getInvoiceStatusLabel(invoice.status)}
              </span>
              <span className={`badge rounded-pill ${getStatusBadgeClass("payment", invoice.paymentStatus)}`}>
                {getPaymentStatusLabel(invoice.paymentStatus)}
              </span>
            </div>
            <p className="page-subtitle-modal mb-0">Complete invoice details</p>
          </div>

          <div className="text-end me-3">
            <div className="px-3 py-2 rounded-3 border" style={{ background: "#f8fafc", minWidth: "230px" }}>
              <div className="fw-bold text-dark">Invoice No</div>
              <div className="small text-muted">{invoice.invoiceNo}</div>
            </div>
          </div>
        </div>
      </Modal.Header>

      {/* BODY */}
      <Modal.Body>
        {/* Quick stats strip */}
        <div className="d-flex flex-wrap gap-2 mb-3">
          <div className="siv-stat"><div className="k">Items</div><div className="v">{itemCount}</div></div>
          <div className="siv-stat"><div className="k">Returns</div><div className="v">{returnCount}</div></div>
          <div className="siv-stat"><div className="k">Payments</div><div className="v">{paymentCount}</div></div>
          <div className="siv-stat"><div className="k">Invoice Total</div><div className="v">{formatCurrency(subTotal)}</div></div>
          <div className="siv-stat"><div className="k">Paid</div><div className="v">{formatCurrency(paidAmount)}</div></div>
          <div className="siv-stat"><div className="k">Balance Due</div><div className="v">{formatCurrency(dueAmount)}</div></div>
        </div>

        <div className="row g-3">
          {/* LEFT */}
          <div className="col-lg-8">
            {/* Basic info */}
            <div className="siv-card mb-3">
              <div className="siv-card-title">
                <i className="bi bi-info-circle" />Basic Information
              </div>
              <div className="row g-2">
                <div className="col-md-4">
                  <div className="small">
                    <span className="text-muted">Branch: </span>
                    <span className="fw-semibold">{invoice.branch?.name || "-"}</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="small">
                    <span className="text-muted">Customer: </span>
                    <span className="fw-semibold">{invoice.customer?.name || "-"}</span>
                  </div>
                </div>
                {isAdminOrDataEntry && (
                  <div className="col-md-4">
                    <div className="small">
                      <span className="text-muted">Sales Rep: </span>
                      <span className="fw-semibold">
                        {invoice.salesRep?.name || invoice.salesRep?.fullName || invoice.salesRep?.email || "-"}
                      </span>
                    </div>
                  </div>
                )}
                <div className="col-md-4">
                  <div className="small">
                    <span className="text-muted">Invoice Date: </span>
                    <span className="fw-semibold">{formatDate(invoice.invoiceDate)}</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="small d-flex align-items-center gap-2 flex-wrap">
                    <span className="text-muted">Payment Status:</span>
                    <span className={`badge rounded-pill ${getStatusBadgeClass("payment", invoice.paymentStatus)}`}>
                      {getPaymentStatusLabel(invoice.paymentStatus)}
                    </span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="small d-flex align-items-center gap-2 flex-wrap">
                    <span className="text-muted">Invoice Status:</span>
                    <span className={`badge rounded-pill ${getStatusBadgeClass("invoice", invoice.status)}`}>
                      {getInvoiceStatusLabel(invoice.status)}
                    </span>
                  </div>
                </div>
                {invoice.remarks && (
                  <div className="col-12">
                    <div className="small" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                      <span className="text-muted">Remarks: </span>
                      <span className="fw-semibold">{invoice.remarks}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="siv-card">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="siv-card-title mb-0">
                  <i className="bi bi-box-seam" />Items
                </div>
                <div className="siv-pill">
                  <i className="bi bi-list-check" />
                  {items.length} line{items.length !== 1 ? "s" : ""}
                </div>
              </div>

              <div className="siv-table-wrap">
                <table className="siv-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 120 }}>Item</th>
                      <th className="text-end">Primary Sold</th>
                      <th className="text-end">Base Sold</th>
                      <th className="text-end">Price (Base)</th>
                      <th className="text-end">Price (Primary)</th>
                      <th className="text-end">Discount</th>
                      <th className="text-end">Item Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? (
                      items.map((row, index) => {
                        const key = String(row.item?._id || row.item || "");
                        const returned = returnedByItem.get(key) || {
                          qtyReturned: 0, baseQtyReturned: 0,
                          primaryQtyReturned: 0, totalValueReturned: 0,
                        };
                        const soldBase    = Number(row.baseQty || 0);
                        const soldPrimary =
                          Number(row.primaryQty || 0) ||
                          (soldBase === 0 ? Number(row.qty || 0) : 0);
                        const priceBase    = Number(row.sellingPriceBase    || 0);
                        const pricePrimary = Number(row.sellingPricePrimary || 0);
                        const discount     = Number(row.discountPerUnit     || 0);
                        const lineTotal    = Number(row.totalSellingValue   || 0);
                        const itemCode     = row.item?.itemCode || "";
                        const itemName     = row.item?.name     || "-";
                        const hasReturns   =
                          Number(returned.baseQtyReturned    || 0) > 0 ||
                          Number(returned.primaryQtyReturned || 0) > 0 ||
                          Number(returned.qtyReturned        || 0) > 0;

                        return (
                          <tr key={index}>
                            <td>
                              <div className="fw-semibold">{itemName}</div>
                              <div className="small text-muted d-flex align-items-center gap-2 flex-wrap">
                                {itemCode && <span>{itemCode}</span>}
                                {hasReturns && (
                                  <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                    Has Returns
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-end">{soldPrimary || "-"}</td>
                            <td className="text-end">{soldBase    || "-"}</td>
                            <td className="text-end">{priceBase    > 0 ? formatCurrency(priceBase)    : "-"}</td>
                            <td className="text-end">{pricePrimary > 0 ? formatCurrency(pricePrimary) : "-"}</td>
                            <td className="text-end">{discount     > 0 ? formatCurrency(discount)     : "-"}</td>
                            <td className="text-end fw-bold">{formatCurrency(lineTotal)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-3">No items found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="small text-muted mt-2">
                Remaining Total Base is taken from the invoice's backend-calculated{" "}
                <span className="fw-semibold">remainingItems</span> to ensure mixed-UOM
                returns display correctly.
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="col-lg-4">
            {/* Totals */}
            <div className="siv-card mb-3">
              <div className="siv-card-title">
                <i className="bi bi-calculator" />Totals
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Subtotal</span>
                <span className="fw-semibold">{formatCurrency(subTotal)}</span>
              </div>
              {returnTotal > 0 && (
                <div className="d-flex justify-content-between mb-2 text-danger">
                  <span>Returns</span>
                  <span className="fw-semibold">- {formatCurrency(returnTotal)}</span>
                </div>
              )}
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Paid</span>
                <span className="fw-semibold">{formatCurrency(paidAmount)}</span>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between text-success fw-bold mb-1">
                <span>Final Total</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
              <div className="d-flex justify-content-between fw-bold">
                <span>Balance Due</span>
                <span className={dueAmount > 0 ? "text-danger" : "text-success"}>
                  {formatCurrency(dueAmount)}
                </span>
              </div>
            </div>

            {/* Payments */}
            <div className="siv-card mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <div className="siv-card-title mb-0">
                  <i className="bi bi-credit-card-2-front" />Payments
                </div>
                <span className="siv-pill">{payments.length}</span>
              </div>
              <div className="siv-side-scroll">
                {payments.length === 0 ? (
                  <div className="text-muted small">No payments recorded.</div>
                ) : (
                  payments.map((p, index) => {
                    // Resolve the display label — it may live on the nested paymentId object
                    const payNo  = p.paymentNo  || p.paymentId?.paymentNo  || "Payment";
                    const method = p.method     || p.paymentId?.method     || "-";
                    const date   = p.paymentDate || p.paymentId?.paymentDate;
                    const amount = p.amount     || p.paymentId?.amount;

                    return (
                      <div key={index} className="siv-list-row">
                        <div>
                          {/* FIX: resolve the real payment ID before passing up */}
                          <button
                            type="button"
                            className="siv-link-btn"
                            onClick={() => handlePaymentClick(p)}
                          >
                            {payNo}
                          </button>
                          <div className="small text-muted">{method}</div>
                        </div>
                        <div className="small text-muted text-center">{formatDate(date)}</div>
                        <div className="fw-bold text-end">{formatCurrency(amount)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Returns */}
            <div className="siv-card">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <div className="siv-card-title mb-0">
                  <i className="bi bi-arrow-return-left" />Returns
                </div>
                <span className="siv-pill">{embeddedReturns.length}</span>
              </div>
              <div className="siv-side-scroll">
                {embeddedReturns.length === 0 ? (
                  <div className="text-muted small">No returns applied.</div>
                ) : (
                  embeddedReturns.map((ret, index) => {
                    const returnId = ret.returnId?._id || ret.returnId;
                    const value    = Number(ret.totalReturnValue) || Number(ret.returnId?.totalReturnValue) || 0;
                    const dateRaw  = ret.returnDate || ret.returnId?.returnDate;
                    const retNo    = ret.returnNo   || ret.returnId?.returnNo   || "Return";

                    return (
                      <div key={index} className="siv-list-row">
                        <div>
                          <button
                            type="button"
                            className="siv-link-btn"
                            onClick={() => onViewReturn?.(returnId)}
                          >
                            {retNo}
                          </button>
                          <div className="small text-muted">
                            {(ret.items || []).length} item{(ret.items || []).length !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="small text-muted text-center">{formatDate(dateRaw)}</div>
                        <div className="fw-bold text-end">{formatCurrency(value)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="siv-footer">
          <div className="d-flex justify-content-between align-items-center">
            <Button type="button" variant="outline-secondary" onClick={handlePrintInvoice}>
              <i className="bi bi-printer me-2" />Print
            </Button>
          </div>
        </div>

        {/* Hidden print template */}
        <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
          <SalesInvoicePrintTemplate ref={printRef} invoice={printableInvoice} />
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default SalesInvoiceViewModal;