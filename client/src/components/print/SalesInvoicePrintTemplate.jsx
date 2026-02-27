// src/pages/sales/SalesInvoicePrintTemplate.jsx
import React, { forwardRef, useMemo } from "react";

const formatCurrency = (value) => {
  const n = Number(value || 0);
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB");
};

const getInvoiceStatusLabel = (status) => {
  switch (status) {
    case "draft":
      return "Draft";
    case "waiting_for_approval":
      return "Waiting for Approval";
    case "approved":
      return "Approved";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "-";
  }
};

const getPaymentStatusLabel = (status) => {
  switch (status) {
    case "paid":
      return "Paid";
    case "partially_paid":
      return "Partially Paid";
    case "unpaid":
    default:
      return "Unpaid";
  }
};

const SalesInvoicePrintTemplate = forwardRef(({ invoice }, ref) => {
  if (!invoice) return null;

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const payments = Array.isArray(invoice.paymentAllocations)
    ? invoice.paymentAllocations
    : [];
  const remainingItems = Array.isArray(invoice.remainingItems)
    ? invoice.remainingItems
    : [];

  const subTotal = Number(invoice.totalValue || 0);
  const returnTotal = Number(invoice.totalReturnedValue || 0);
  const finalTotal =
    invoice.totalBalanceValue != null
      ? Number(invoice.totalBalanceValue)
      : subTotal - returnTotal;
  const paidAmount = Number(invoice.paidAmount || 0);
  const dueAmount = Math.max(0, finalTotal - paidAmount);

  const remainingByItem = useMemo(() => {
    const map = new Map();
    remainingItems.forEach((r) => {
      const key = String(r.item?._id || r.item || "");
      if (!key) return;
      map.set(key, {
        remainingPrimaryQty: Number(r.remainingPrimaryQty || 0),
        remainingBaseQty: Number(r.remainingBaseQty || 0),
      });
    });
    return map;
  }, [remainingItems]);

  const totalAllocatedPayments = payments.reduce(
    (sum, p) => sum + Number(p.amount || p.paymentId?.amount || 0),
    0
  );

  return (
    <div ref={ref} className="sales-invoice-print-root">
      <style>{`
        @page { size: A4; margin: 10mm; }

        /* Scoped root */
        .sales-invoice-print-root {
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
          background: #fff;
          width: 100%;
          padding: 0;
          font-size: 12px;
        }

        .sales-invoice-print-root .print-page {
          width: 190mm;
          margin: 0 auto;
        }

        .sales-invoice-print-root .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          border-bottom: 2px solid #111827;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }

        .sales-invoice-print-root .company h1 {
          margin: 0 0 4px;
          font-size: 20px;
          line-height: 1.2;
        }

        .sales-invoice-print-root .company p {
          margin: 2px 0;
          font-size: 12px;
          color: #374151;
        }

        .sales-invoice-print-root .doc-box {
          min-width: 240px;
          text-align: right;
        }

        .sales-invoice-print-root .doc-title {
          margin: 0 0 6px;
          font-size: 20px;
          font-weight: 700;
        }

        .sales-invoice-print-root .doc-meta {
          font-size: 12px;
          color: #374151;
          line-height: 1.5;
        }

        .sales-invoice-print-root .section {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          margin-bottom: 12px;
          overflow: hidden;
          background: #fff;
        }

        .sales-invoice-print-root .section-title {
          background: #f9fafb;
          border-bottom: 1px solid #d1d5db;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: #374151;
        }

        .sales-invoice-print-root .section-body {
          padding: 10px;
        }

        .sales-invoice-print-root .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 12px;
        }

        .sales-invoice-print-root .field {
          display: grid;
          grid-template-columns: 145px 1fr;
          gap: 8px;
          font-size: 12px;
          line-height: 1.4;
        }

        .sales-invoice-print-root .field-label {
          color: #6b7280;
          font-weight: 600;
        }

        .sales-invoice-print-root .field-value {
          font-weight: 600;
          word-break: break-word;
        }

        /* TABLE STYLES (matched with GRNPrintTemplate style system) */
        .sales-invoice-print-root .table-wrap {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          background: #fff;
        }

        .sales-invoice-print-root table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }

        .sales-invoice-print-root thead th {
          background: #f3f4f6;
          color: #374151;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 700;
          padding: 7px 5px;
          text-align: center;
          vertical-align: middle;
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          white-space: nowrap;
        }

        .sales-invoice-print-root thead tr:first-child th[colspan] {
          background: #eef2f7;
        }

        .sales-invoice-print-root thead tr:nth-child(2) th {
          border-top: 0;
        }

        .sales-invoice-print-root thead th:last-child {
          border-right: 0;
        }

        .sales-invoice-print-root tbody td {
          font-size: 11px;
          padding: 7px 6px;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .sales-invoice-print-root tbody td:last-child { border-right: 0; }
        .sales-invoice-print-root tbody tr:last-child td { border-bottom: 0; }

        .sales-invoice-print-root .num {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .sales-invoice-print-root .item-col { width: 38%; text-align: left !important; }
        .sales-invoice-print-root .col-qty { width: 7.5%; }
        .sales-invoice-print-root .col-price { width: 11%; }
        .sales-invoice-print-root .col-discount { width: 10%; }
        .sales-invoice-print-root .col-total { width: 16%; }

        .sales-invoice-print-root .item-name {
          font-weight: 700;
          margin-bottom: 2px;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .sales-invoice-print-root .item-code {
          color: #4b5563;
          font-size: 10px;
          margin-bottom: 2px;
          overflow-wrap: anywhere;
        }

        .sales-invoice-print-root .item-note {
          color: #6b7280;
          font-size: 10px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .sales-invoice-print-root .inline-tag {
          display: inline-block;
          margin-top: 4px;
          padding: 1px 6px;
          border-radius: 999px;
          border: 1px solid #f59e0b;
          background: #fffbeb;
          color: #92400e;
          font-size: 9px;
          font-weight: 700;
        }

        .sales-invoice-print-root .two-col {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 12px;
          margin-top: 10px;
        }

        .sales-invoice-print-root .mini-table {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }

        .sales-invoice-print-root .mini-table .head {
          background: #f9fafb;
          border-bottom: 1px solid #d1d5db;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
        }

        .sales-invoice-print-root .mini-row {
          display: grid;
          grid-template-columns: 1.1fr .8fr .7fr;
          gap: 8px;
          align-items: center;
          padding: 7px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
        }

        .sales-invoice-print-root .mini-row:last-child { border-bottom: 0; }

        .sales-invoice-print-root .mini-row .r {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .sales-invoice-print-root .summary-box {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }

        .sales-invoice-print-root .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
        }

        .sales-invoice-print-root .summary-row:last-child { border-bottom: none; }
        .sales-invoice-print-root .summary-row.total {
          background: #f9fafb;
          font-size: 13px;
          font-weight: 700;
        }

        .sales-invoice-print-root .summary-row.due {
          background: #fff7ed;
          font-weight: 700;
        }

        .sales-invoice-print-root .signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 20px;
        }

        .sales-invoice-print-root .sign-box {
          text-align: center;
          font-size: 11px;
          color: #374151;
        }

        .sales-invoice-print-root .sign-line {
          border-top: 1px solid #111827;
          margin-top: 30px;
          padding-top: 4px;
        }

        .sales-invoice-print-root .footer {
          margin-top: 12px;
          border-top: 1px dashed #d1d5db;
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
          color: #6b7280;
          font-size: 10px;
        }

        @media print {
          .sales-invoice-print-root {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="print-page">
        {/* Header */}
        <div className="header">
          <div className="company">
            <h1>Agelka Agencies</h1>
            <p>41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka</p>
            <p>+94 55 720 0446</p>
          </div>

          <div className="doc-box">
            <div className="doc-title">Sales Invoice</div>
            <div className="doc-meta">
              <div>
                <strong>No:</strong> {invoice.invoiceNo || "-"}
              </div>
              <div>
                <strong>Date:</strong> {formatDate(invoice.invoiceDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Invoice details */}
        <div className="section">
          <div className="section-title">Invoice Details</div>
          <div className="section-body">
            <div className="grid">
              <div className="field">
                <div className="field-label">Branch</div>
                <div className="field-value">{invoice.branch?.name || "-"}</div>
              </div>

              <div className="field">
                <div className="field-label">Customer</div>
                <div className="field-value">{invoice.customer?.name || "-"}</div>
              </div>

              <div className="field">
                <div className="field-label">Sales Rep</div>
                <div className="field-value">
                  {invoice.salesRep?.name || invoice.salesRep?.repCode || "-"}
                </div>
              </div>

              <div className="field">
                <div className="field-label">Payment Status</div>
                <div className="field-value">
                  {getPaymentStatusLabel(invoice.paymentStatus)}
                </div>
              </div>

              <div className="field">
                <div className="field-label">Invoice Status</div>
                <div className="field-value">
                  {getInvoiceStatusLabel(invoice.status)}
                </div>
              </div>

              {invoice.remarks ? (
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <div className="field-label">Remarks</div>
                  <div className="field-value">{invoice.remarks}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="section">
          <div className="section-title">Items & Selling Prices</div>
          <div className="section-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th rowSpan="2" className="item-col">
                      Item
                    </th>
                    <th colSpan="2">Sold Qty</th>
                    <th colSpan="2">Prices</th>
                    <th rowSpan="2" className="col-discount">
                      Discount
                    </th>
                    <th rowSpan="2" className="col-total">
                      Line Total
                    </th>
                  </tr>
                  <tr>
                    <th className="col-qty">Primary</th>
                    <th className="col-qty">Base</th>
                    <th className="col-price">Primary</th>
                    <th className="col-price">Base</th>
                  </tr>
                </thead>

                <tbody>
                  {items.length ? (
                    items.map((row, idx) => {
                      const itemId = String(row.item?._id || row.item || "");
                      const rem = remainingByItem.get(itemId) || {
                        remainingPrimaryQty: 0,
                        remainingBaseQty: 0,
                      };

                      const soldBase = Number(row.baseQty || 0);
                      const soldPrimary =
                        Number(row.primaryQty || 0) ||
                        (soldBase === 0 ? Number(row.qty || 0) : 0);

                      const itemHasReturns =
                        Boolean(invoice.hasReturns) &&
                        (rem.remainingPrimaryQty < soldPrimary ||
                          rem.remainingBaseQty < soldBase);

                      return (
                        <tr key={idx}>
                          <td>
                            <div className="item-name">
                              {row.item?.name || row.itemName || "-"}
                            </div>
                            <div className="item-code">
                              {row.item?.itemCode || row.itemCode || "-"}
                            </div>

                            {/* keep only return tag if exists (removed extra tags/uom text as requested earlier) */}
                            {itemHasReturns ? (
                              <span className="inline-tag">Has Returns</span>
                            ) : null}
                          </td>

                          <td className="num">{soldPrimary || "-"}</td>
                          <td className="num">{soldBase || "-"}</td>

                          <td className="num">
                            {Number(row.sellingPricePrimary || 0) > 0
                              ? formatCurrency(row.sellingPricePrimary)
                              : "-"}
                          </td>

                          <td className="num">
                            {Number(row.sellingPriceBase || 0) > 0
                              ? formatCurrency(row.sellingPriceBase)
                              : "-"}
                          </td>

                          <td className="num">
                            {Number(row.discountPerUnit || 0) > 0
                              ? formatCurrency(row.discountPerUnit)
                              : "-"}
                          </td>

                          <td className="num">
                            {formatCurrency(row.totalSellingValue || 0)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ textAlign: "center", color: "#6b7280" }}
                      >
                        No items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="two-col">
              {/* Payments summary */}
              <div className="mini-table">
                <div className="head">Payments</div>
                {payments.length ? (
                  <>
                    {payments.map((p, idx) => (
                      <div key={idx} className="mini-row">
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {p.paymentNo || p.paymentId?.paymentNo || "Payment"}
                          </div>
                          <div style={{ color: "#6b7280", fontSize: 10 }}>
                            {p.method || p.paymentId?.method || "-"}
                          </div>
                        </div>
                        <div>
                          {formatDate(
                            p.date || p.paymentDate || p.paymentId?.paymentDate
                          )}
                        </div>
                        <div className="r">
                          {formatCurrency(p.amount || p.paymentId?.amount || 0)}
                        </div>
                      </div>
                    ))}
                    <div
                      className="mini-row"
                      style={{ background: "#f9fafb", fontWeight: 700 }}
                    >
                      <div>Total Allocated</div>
                      <div></div>
                      <div className="r">{formatCurrency(totalAllocatedPayments)}</div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "10px", color: "#6b7280", fontSize: 11 }}>
                    No payments recorded.
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="summary-box">
                <div className="summary-row">
                  <span>Item Count</span>
                  <span>{items.length}</span>
                </div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subTotal)}</span>
                </div>
                {returnTotal > 0 ? (
                  <div className="summary-row">
                    <span>Returns</span>
                    <span>- {formatCurrency(returnTotal)}</span>
                  </div>
                ) : null}
                <div className="summary-row">
                  <span>Paid Amount</span>
                  <span>{formatCurrency(paidAmount)}</span>
                </div>
                <div className="summary-row total">
                  <span>Final Total</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
                <div className="summary-row due">
                  <span>Balance Due</span>
                  <span>{formatCurrency(dueAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="signatures">
          <div className="sign-box">
            <div className="sign-line">Prepared By</div>
          </div>
          <div className="sign-box">
            <div className="sign-line">Checked By</div>
          </div>
          <div className="sign-box">
            <div className="sign-line">Customer Signature</div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <span>Generated from agelka system</span>
          <span>Printed on {new Date().toLocaleString("en-GB")}</span>
        </div>
      </div>
    </div>
  );
});

export default SalesInvoicePrintTemplate;