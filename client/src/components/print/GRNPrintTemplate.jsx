import React, { forwardRef } from "react";

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

const GRNPrintTemplate = forwardRef(({ grn }, ref) => {
  if (!grn) return null;

  const {
    grnNo,
    branchName,
    supplierName,
    salesRepName,
    supplierInvoiceNo,
    supplierInvoiceDate,
    receivedDate,
    items = [],
    totalValue = 0,
  } = grn;

  return (
    <div ref={ref} className="grn-print-root">
      <style>{`
        @page { size: A4; margin: 10mm; }

        /* Scope EVERYTHING under .grn-print-root to prevent style leaking */
        .grn-print-root {
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
          background: #fff;
          width: 100%;
          padding: 0;
          font-size: 12px;
        }

        .grn-print-root .print-page {
          width: 190mm;
          margin: 0 auto;
        }

        .grn-print-root .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          border-bottom: 2px solid #111827;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }

        .grn-print-root .company h1 {
          margin: 0 0 4px;
          font-size: 20px;
          line-height: 1.2;
        }

        .grn-print-root .company p {
          margin: 2px 0;
          font-size: 12px;
          color: #374151;
        }

        .grn-print-root .doc-box {
          min-width: 240px;
          text-align: right;
        }

        .grn-print-root .doc-title {
          margin: 0 0 6px;
          font-size: 20px;
          font-weight: 700;
        }

        .grn-print-root .doc-meta {
          font-size: 12px;
          color: #374151;
          line-height: 1.5;
        }

        .grn-print-root .section {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          margin-bottom: 12px;
          overflow: hidden;
          background: #fff;
        }

        .grn-print-root .section-title {
          background: #f9fafb;
          border-bottom: 1px solid #d1d5db;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: #374151;
        }

        .grn-print-root .section-body {
          padding: 10px;
        }

        .grn-print-root .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 12px;
        }

        .grn-print-root .field {
          display: grid;
          grid-template-columns: 145px 1fr;
          gap: 8px;
          font-size: 12px;
          line-height: 1.4;
        }

        .grn-print-root .field-label {
          color: #6b7280;
          font-weight: 600;
        }

        .grn-print-root .field-value {
          font-weight: 600;
          word-break: break-word;
        }

        .grn-print-root .table-wrap {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          background: #fff;
        }

        .grn-print-root table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }

        .grn-print-root thead th {
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

        .grn-print-root thead tr:first-child th[colspan] {
          background: #eef2f7;
        }

        .grn-print-root thead tr:nth-child(2) th {
          border-top: 0;
        }

        .grn-print-root thead th:last-child {
          border-right: 0;
        }

        .grn-print-root tbody td {
          font-size: 11px;
          padding: 7px 6px;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .grn-print-root tbody td:last-child { border-right: 0; }
        .grn-print-root tbody tr:last-child td { border-bottom: 0; }

        .grn-print-root .num {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .grn-print-root .item-col { width: 38%; text-align: left !important; }
        .grn-print-root .col-qty { width: 7.5%; }
        .grn-print-root .col-price { width: 11%; }
        .grn-print-root .col-discount { width: 10%; }
        .grn-print-root .col-total { width: 16%; }

        .grn-print-root .item-name {
          font-weight: 700;
          margin-bottom: 2px;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .grn-print-root .item-code {
          color: #4b5563;
          font-size: 10px;
          margin-bottom: 2px;
          overflow-wrap: anywhere;
        }

        .grn-print-root .item-uom {
          color: #6b7280;
          font-size: 10px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .grn-print-root .summary {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
        }

        .grn-print-root .summary-box {
          width: 360px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }

        .grn-print-root .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
        }

        .grn-print-root .summary-row:last-child { border-bottom: none; }

        .grn-print-root .summary-row.total {
          background: #f9fafb;
          font-size: 13px;
          font-weight: 700;
        }

        .grn-print-root .signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 20px;
        }

        .grn-print-root .sign-box {
          text-align: center;
          font-size: 11px;
          color: #374151;
        }

        .grn-print-root .sign-line {
          border-top: 1px solid #111827;
          margin-top: 30px;
          padding-top: 4px;
        }

        .grn-print-root .footer {
          margin-top: 12px;
          border-top: 1px dashed #d1d5db;
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
          color: #6b7280;
          font-size: 10px;
        }

        /* Optional: keep print colors consistent */
        @media print {
          .grn-print-root {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="print-page">
        <div className="header">
          <div className="company">
            <h1>Agelka Agencies</h1>
            <p>41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka</p>
            <p>+94 55 720 0446</p>
          </div>

          <div className="doc-box">
            <div className="doc-title">Good Receive Note</div>
            <div className="doc-meta">
              <div><strong>No:</strong> {grnNo || "-"}</div>
              <div><strong>Date:</strong> {formatDate(receivedDate)}</div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">GRN Details</div>
          <div className="section-body">
            <div className="grid">
              <div className="field"><div className="field-label">Branch</div><div className="field-value">{branchName || "-"}</div></div>
              <div className="field"><div className="field-label">Supplier</div><div className="field-value">{supplierName || "-"}</div></div>
              <div className="field"><div className="field-label">Supplier Invoice No</div><div className="field-value">{supplierInvoiceNo || "-"}</div></div>
              <div className="field"><div className="field-label">Supplier Invoice Date</div><div className="field-value">{formatDate(supplierInvoiceDate)}</div></div>
              <div className="field"><div className="field-label">Received Date</div><div className="field-value">{formatDate(receivedDate)}</div></div>
              <div className="field"><div className="field-label">Sales Rep</div><div className="field-value">{salesRepName || "-"}</div></div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Items & Pricing</div>
          <div className="section-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th rowSpan="2" className="item-col">Item</th>
                    <th colSpan="2">Qty</th>
                    <th colSpan="2">Prices</th>
                    <th rowSpan="2" className="col-discount">Discount</th>
                    <th rowSpan="2" className="col-total">Line Total</th>
                  </tr>
                  <tr>
                    <th className="col-qty">Primary</th>
                    <th className="col-qty">Base</th>
                    <th className="col-price">Primary</th>
                    <th className="col-price">Base</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? items.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="item-name">{row.itemName}</div>
                        <div className="item-code">{row.itemCode}</div>
                        <div className="item-uom">
                        <div>
                            Primary: <strong>{row.primaryUom || "Primary"}</strong>
                            {row.hasBaseUOM ? (
                            <>
                                {" "}• Base: <strong>{row.baseUom || "Base"}</strong>{" "}
                                <span>
                                (1 : {row.factorToBase || 1})
                                </span>
                            </>
                            ) : (
                            <> • Single UOM</>
                            )}
                        </div>
                        </div>
                      </td>
                      <td className="num">{row.primaryQty}</td>
                      <td className="num">{row.baseQty}</td>
                      <td className="num">{row.avgCostPrimary}</td>
                      <td className="num">{row.avgCostBase}</td>
                      <td className="num">{row.discount}</td>
                      <td className="num">{row.lineTotal}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#6b7280" }}>
                        No items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="summary">
              <div className="summary-box">
                <div className="summary-row">
                  <span>Item Count</span>
                  <span>{items.length}</span>
                </div>
                <div className="summary-row total">
                  <span>Grand Total</span>
                  <span>{formatCurrency(totalValue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="signatures">
          <div className="sign-box"><div className="sign-line">Prepared By</div></div>
          <div className="sign-box"><div className="sign-line">Checked By</div></div>
          <div className="sign-box"><div className="sign-line">Authorized By</div></div>
        </div>

        <div className="footer">
          <span>Generated from agelka system</span>
          <span>Printed on {new Date().toLocaleString("en-GB")}</span>
        </div>
      </div>
    </div>
  );
});

export default GRNPrintTemplate;