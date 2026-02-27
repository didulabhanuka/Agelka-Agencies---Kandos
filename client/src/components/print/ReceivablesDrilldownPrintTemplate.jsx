// src/components/print/ReceivablesDrilldownPrintTemplate.jsx

import React, { forwardRef, useMemo } from "react";

const formatCurrency = (value) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

const formatDate = (value) => {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB");
};

const formatDateTime = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB");
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const STATUS_LABELS = {
  paid: "Paid",
  partially_paid: "Partially Paid",
  unpaid: "Unpaid",
};

const ReceivablesDrilldownPrintTemplate = forwardRef(
  (
    {
      mode = "salesRep", // "salesRep" | "customer" | "both"

      // filters
      dateFrom = "",
      dateTo = "",
      salesRepFilterLabel = "",
      customerFilterLabel = "",

      // selected top summary entity
      // salesRep mode -> selected rep summary
      // customer mode -> selected customer summary
      // both mode -> selected intersection summary
      selectedEntity = {
        name: "",
        totalOutstanding: 0,
        totalInvoiceValue: 0,
        totalPaidValue: 0,
        invoiceCount: 0,
        customerCount: 0, // salesRep mode
        salesRepCount: 0, // customer mode
      },

      // summary rows (only used in salesRep/customer modes)
      summaryRows = [],

      // invoice rows (flat rows)
      invoiceRows = [],

      generatedBy = "System User",
      generatedAt = new Date(),

      company = {
        name: "Agelka Agencies",
        address: "41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka",
        phone: "+94 55 720 0446",
      },
    },
    ref
  ) => {
    const isSalesRepMode = mode === "salesRep";
    const isCustomerMode = mode === "customer";
    const isBothMode = mode === "both";

    const prepared = useMemo(() => {
      const rows = Array.isArray(invoiceRows) ? invoiceRows : [];

      const normalizedInvoices = rows.map((r, idx) => {
        const customerName =
          r?.customerName || r?.customer?.name || r?.customer?.customerName || "Unknown Customer";
        const salesRepName =
          r?.salesRepName || r?.salesRep?.name || r?.salesRep?.repName || "Unassigned";

        const invoiceValue = toNum(
          r?.invoiceValue ??
            r?.totalInvoiceValue ??
            r?.grandTotal ??
            r?.totalAmount ??
            r?.invoiceTotal
        );

        const paidAmount = toNum(r?.paidAmount ?? r?.totalPaidValue ?? r?.collectedAmount);

        let balance = toNum(
          r?.balance ?? r?.remainingAmount ?? r?.outstanding ?? r?.totalBalanceValue
        );

        // fallback: if balance missing but invoice/paid exists
        if (!Number.isFinite(balance)) balance = 0;
        if (
          (r?.balance === undefined &&
            r?.remainingAmount === undefined &&
            r?.outstanding === undefined &&
            r?.totalBalanceValue === undefined) ||
          balance === 0
        ) {
          const computed = invoiceValue - paidAmount;
          if (computed !== 0) balance = computed;
        }

        return {
          ...r,
          _idx: idx,
          _customerName: customerName,
          _salesRepName: salesRepName,
          _invoiceNo: r?.invoiceNo || r?.invoiceNumber || "-",
          _invoiceDate: r?.invoiceDate || r?.date || r?.createdAt || null,
          _status: r?.paymentStatus || "unpaid",
          _invoiceValue: invoiceValue,
          _paidAmount: paidAmount,
          _balance: balance,
        };
      });

      // grouped only for salesRep/customer modes
      const groupedMap = normalizedInvoices.reduce((acc, row) => {
        const key = isSalesRepMode ? row._customerName : row._salesRepName;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {});

      const groupedEntries = Object.entries(groupedMap).map(([groupName, invoices]) => ({
        groupName,
        invoices: [...invoices].sort((a, b) => {
          const da = new Date(a._invoiceDate || 0).getTime();
          const db = new Date(b._invoiceDate || 0).getTime();
          return da - db;
        }),
        totals: invoices.reduce(
          (acc, r) => {
            acc.invoiceValue += r._invoiceValue;
            acc.paidAmount += r._paidAmount;
            acc.balance += r._balance;
            return acc;
          },
          { invoiceValue: 0, paidAmount: 0, balance: 0 }
        ),
      }));

      groupedEntries.sort((a, b) => a.groupName.localeCompare(b.groupName));

      const grandTotals = normalizedInvoices.reduce(
        (acc, r) => {
          acc.invoiceValue += r._invoiceValue;
          acc.paidAmount += r._paidAmount;
          acc.balance += r._balance;
          return acc;
        },
        { invoiceValue: 0, paidAmount: 0, balance: 0 }
      );

      return { normalizedInvoices, groupedEntries, grandTotals };
    }, [invoiceRows, isSalesRepMode]);

    const periodLabel =
      dateFrom && dateTo
        ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}`
        : dateFrom
        ? `From ${formatDate(dateFrom)}`
        : dateTo
        ? `Up to ${formatDate(dateTo)}`
        : "All Dates";

    const topCard = isSalesRepMode
      ? {
          label: "Sales Rep",
          name: selectedEntity?.name || salesRepFilterLabel || "-",
          totalOutstanding: toNum(selectedEntity?.totalOutstanding),
          totalInvoiceValue: toNum(selectedEntity?.totalInvoiceValue),
          totalPaidValue: toNum(selectedEntity?.totalPaidValue),
          invoiceCount: toNum(selectedEntity?.invoiceCount),
          secondaryCountLabel: "Customers",
          secondaryCountValue: toNum(selectedEntity?.customerCount),
        }
      : isCustomerMode
      ? {
          label: "Customer",
          name: selectedEntity?.name || customerFilterLabel || "-",
          totalOutstanding: toNum(selectedEntity?.totalOutstanding),
          totalInvoiceValue: toNum(selectedEntity?.totalInvoiceValue),
          totalPaidValue: toNum(selectedEntity?.totalPaidValue),
          invoiceCount: toNum(selectedEntity?.invoiceCount),
          secondaryCountLabel: "Sales Reps",
          secondaryCountValue: toNum(selectedEntity?.salesRepCount),
        }
      : {
          label: "Customer + Sales Rep",
          name:
            selectedEntity?.name ||
            `${customerFilterLabel || "Customer"} / ${salesRepFilterLabel || "Sales Rep"}`,
          totalOutstanding: toNum(selectedEntity?.totalOutstanding),
          totalInvoiceValue: toNum(selectedEntity?.totalInvoiceValue),
          totalPaidValue: toNum(selectedEntity?.totalPaidValue),
          invoiceCount: toNum(selectedEntity?.invoiceCount),
          secondaryCountLabel: "Scope",
          secondaryCountValue: "Intersection",
        };

    const summaryTitle = isSalesRepMode ? "Outstanding by Customer" : "Outstanding by Sales Rep";
    const summaryEntityColumn = isSalesRepMode ? "Customer" : "Sales Rep";
    const invoiceEntityColumn = isSalesRepMode ? "Customer" : "Sales Rep";

    const normalizedSummaryRows = (Array.isArray(summaryRows) ? summaryRows : []).map((r, i) => ({
      _key: r?._id || r?.customerId || r?.salesRepId || i,
      entityName: r?.customerName || r?.repName || r?.salesRepName || r?.name || "Unknown",
      invoiceCount: toNum(r?.invoiceCount),
      maxAgeDays: toNum(r?.maxAgeDays),
      totalOutstanding: toNum(r?.totalOutstanding),
    }));

    const summaryTotals = normalizedSummaryRows.reduce(
      (acc, r) => {
        acc.invoiceCount += r.invoiceCount;
        acc.totalOutstanding += r.totalOutstanding;
        return acc;
      },
      { invoiceCount: 0, totalOutstanding: 0 }
    );

    // fallbacks from invoice rows if selectedEntity summary is not fully provided
    const computedGrand = prepared.grandTotals;
    const topOutstanding =
      topCard.totalOutstanding > 0 ? topCard.totalOutstanding : computedGrand.balance;
    const topInvoiceValue =
      topCard.totalInvoiceValue > 0 ? topCard.totalInvoiceValue : computedGrand.invoiceValue;
    const topPaidValue = topCard.totalPaidValue > 0 ? topCard.totalPaidValue : computedGrand.paidAmount;

    const topInvoiceCount =
      topCard.invoiceCount > 0 ? topCard.invoiceCount : prepared.normalizedInvoices.length;

    const topSecondaryCount =
      typeof topCard.secondaryCountValue === "string"
        ? topCard.secondaryCountValue
        : topCard.secondaryCountValue > 0
        ? topCard.secondaryCountValue
        : prepared.groupedEntries.length;

    return (
      <div ref={ref} className="rcv-print-root">
        <style>{`
          @page { size: A4; margin: 10mm; }

          .rcv-print-root {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #fff;
            font-size: 12px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .rcv-print-root .print-page {
            width: 190mm;
            margin: 0 auto;
          }

          .rcv-print-root .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            border-bottom: 2px solid #111827;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }

          .rcv-print-root .company h1 {
            margin: 0 0 4px;
            font-size: 20px;
            line-height: 1.2;
          }
          .rcv-print-root .company p {
            margin: 2px 0;
            color: #4b5563;
            font-size: 12px;
          }

          .rcv-print-root .doc-box {
            min-width: 300px;
            text-align: right;
          }
          .rcv-print-root .doc-title {
            margin: 0 0 4px;
            font-size: 19px;
            font-weight: 700;
          }
          .rcv-print-root .doc-subtitle {
            margin: 0 0 8px;
            font-size: 11px;
            color: #6b7280;
          }
          .rcv-print-root .doc-meta {
            font-size: 12px;
            color: #374151;
            line-height: 1.45;
          }

          .rcv-print-root .section {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 12px;
            background: #fff;
          }

          .rcv-print-root .section-title {
            background: #f9fafb;
            border-bottom: 1px solid #d1d5db;
            padding: 8px 10px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            color: #374151;
            letter-spacing: .03em;
          }

          .rcv-print-root .section-body {
            padding: 10px;
          }

          .rcv-print-root .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 12px;
          }

          .rcv-print-root .grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px 12px;
          }

          .rcv-print-root .field {
            display: grid;
            grid-template-columns: 110px 1fr;
            gap: 8px;
            align-items: start;
            line-height: 1.4;
          }
          .rcv-print-root .field-label {
            color: #6b7280;
            font-weight: 600;
          }
          .rcv-print-root .field-value {
            font-weight: 600;
            word-break: break-word;
          }

          .rcv-print-root .hero {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            margin-bottom: 12px;
            overflow: hidden;
          }
          .rcv-print-root .hero-head {
            background: #eef2ff;
            border-bottom: 1px solid #c7d2fe;
            padding: 8px 10px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: center;
          }
          .rcv-print-root .hero-title {
            font-size: 13px;
            font-weight: 700;
            color: #312e81;
          }
          .rcv-print-root .hero-name {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
          }

          .rcv-print-root .hero-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 0;
          }
          .rcv-print-root .hero-cell {
            border-right: 1px solid #e5e7eb;
            padding: 10px;
          }
          .rcv-print-root .hero-cell:last-child { border-right: 0; }
          .rcv-print-root .hero-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 700;
            letter-spacing: .04em;
            margin-bottom: 4px;
          }
          .rcv-print-root .hero-value {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
            word-break: break-word;
          }

          .rcv-print-root .table-wrap {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            overflow: hidden;
            background: #fff;
          }

          .rcv-print-root table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            table-layout: fixed;
          }

          .rcv-print-root thead th {
            background: #f3f4f6;
            color: #374151;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: .04em;
            padding: 7px 6px;
            border-bottom: 1px solid #d1d5db;
            border-right: 1px solid #d1d5db;
            text-align: left;
            vertical-align: middle;
            white-space: nowrap;
          }
          .rcv-print-root thead th:last-child { border-right: 0; }

          .rcv-print-root tbody td,
          .rcv-print-root tfoot td {
            font-size: 11px;
            padding: 7px 6px;
            border-bottom: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            vertical-align: top;
          }
          .rcv-print-root tbody td:last-child,
          .rcv-print-root tfoot td:last-child { border-right: 0; }
          .rcv-print-root tbody tr:last-child td { border-bottom: 1px solid #d1d5db; }

          .rcv-print-root tfoot td {
            background: #f9fafb;
            font-weight: 700;
            border-bottom: 0;
          }

          .rcv-print-root .text-end { text-align: right !important; }
          .rcv-print-root .text-center { text-align: center !important; }
          .rcv-print-root .small-muted { color: #6b7280; font-size: 10px; }

          .rcv-print-root .subtotal-row td {
            background: #fcfcfd;
            font-weight: 700;
          }

          .rcv-print-root .footer {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #d1d5db;
            display: flex;
            flex-wrap: wrap;
            gap: 8px 16px;
            justify-content: space-between;
            color: #6b7280;
            font-size: 10px;
          }

          @media print {
            .rcv-print-root {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>

        <div className="print-page">
          {/* Header */}
          <div className="header">
            <div className="company">
              <h1>{company?.name || "Company"}</h1>
              {company?.address ? <p>{company.address}</p> : null}
              {company?.phone ? <p>{company.phone}</p> : null}
            </div>

            <div className="doc-box">
              <div className="doc-title">Remaining Collection Report</div>
              <div className="doc-subtitle">
                {isSalesRepMode
                  ? "Sales Rep Drill-down Print"
                  : isCustomerMode
                  ? "Customer Drill-down Print"
                  : "Customer + Sales Rep Drill-down Print"}
              </div>
              <div className="doc-meta">
                <div><strong>Report Date:</strong> {formatDate(generatedAt)}</div>
                <div><strong>Generated At:</strong> {formatDateTime(generatedAt)}</div>
                <div><strong>Generated By:</strong> {generatedBy || "-"}</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="section">
            <div className="section-title">Applied Filters</div>
            <div className="section-body">
              <div className={isBothMode ? "grid-3" : "grid-2"}>
                {isSalesRepMode ? (
                  <>
                    <div className="field">
                      <div className="field-label">Sales Rep</div>
                      <div className="field-value">{salesRepFilterLabel || topCard.name || "-"}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Date Range</div>
                      <div className="field-value">{periodLabel}</div>
                    </div>
                  </>
                ) : isCustomerMode ? (
                  <>
                    <div className="field">
                      <div className="field-label">Customer</div>
                      <div className="field-value">{customerFilterLabel || topCard.name || "-"}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Date Range</div>
                      <div className="field-value">{periodLabel}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field">
                      <div className="field-label">Customer</div>
                      <div className="field-value">{customerFilterLabel || "-"}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Sales Rep</div>
                      <div className="field-value">{salesRepFilterLabel || "-"}</div>
                    </div>
                    <div className="field">
                      <div className="field-label">Date Range</div>
                      <div className="field-value">{periodLabel}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Top summary */}
          <div className="hero">
            <div className="hero-head">
              <div className="hero-title">{topCard.label} Outstanding Summary</div>
              <div className="hero-name">{topCard.name || "-"}</div>
            </div>

            <div className="hero-grid">
              <div className="hero-cell">
                <div className="hero-label">Outstanding</div>
                <div className="hero-value">{formatCurrency(topOutstanding)}</div>
              </div>
              <div className="hero-cell">
                <div className="hero-label">Invoice Value</div>
                <div className="hero-value">{formatCurrency(topInvoiceValue)}</div>
              </div>
              <div className="hero-cell">
                <div className="hero-label">Paid</div>
                <div className="hero-value">{formatCurrency(topPaidValue)}</div>
              </div>
              <div className="hero-cell">
                <div className="hero-label">Invoices</div>
                <div className="hero-value">{topInvoiceCount}</div>
              </div>
              <div className="hero-cell">
                <div className="hero-label">{topCard.secondaryCountLabel}</div>
                <div className="hero-value">{topSecondaryCount}</div>
              </div>
            </div>
          </div>

          {/* Summary by customer / sales rep (skip in BOTH mode) */}
          {!isBothMode && (
            <div className="section">
              <div className="section-title">{summaryTitle}</div>
              <div className="section-body">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "42%" }}>{summaryEntityColumn}</th>
                        <th className="text-end" style={{ width: "15%" }}>Invoices</th>
                        <th className="text-end" style={{ width: "15%" }}>Max Age</th>
                        <th className="text-end" style={{ width: "28%" }}>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedSummaryRows.length ? (
                        normalizedSummaryRows.map((r) => (
                          <tr key={r._key}>
                            <td>{r.entityName}</td>
                            <td className="text-end">{r.invoiceCount}</td>
                            <td className="text-end">{r.maxAgeDays}d</td>
                            <td className="text-end">{formatCurrency(r.totalOutstanding)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center" style={{ color: "#6b7280" }}>
                            No summary rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {normalizedSummaryRows.length > 0 && (
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          <td className="text-end">{summaryTotals.invoiceCount}</td>
                          <td className="text-end">-</td>
                          <td className="text-end">{formatCurrency(summaryTotals.totalOutstanding)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Invoice details */}
          <div className="section">
            <div className="section-title">
              {isBothMode
                ? "Invoice Details (Selected Customer + Sales Rep)"
                : `Invoice Details (${invoiceEntityColumn}-wise invoices for selected ${topCard.label.toLowerCase()})`}
            </div>
            <div className="section-body">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {!isBothMode && <th style={{ width: "24%" }}>{invoiceEntityColumn}</th>}
                      <th style={{ width: isBothMode ? "20%" : "14%" }}>Invoice</th>
                      <th style={{ width: isBothMode ? "16%" : "12%" }}>Date</th>
                      <th style={{ width: isBothMode ? "16%" : "12%" }} className="text-center">Status</th>
                      <th style={{ width: isBothMode ? "26%" : "20%" }} className="text-end">Invoice / Paid</th>
                      <th style={{ width: isBothMode ? "22%" : "18%" }} className="text-end">Balance</th>
                    </tr>
                  </thead>

                  <tbody>
                    {isBothMode ? (
                      prepared.normalizedInvoices.length ? (
                        [...prepared.normalizedInvoices]
                          .sort((a, b) => {
                            const da = new Date(a._invoiceDate || 0).getTime();
                            const db = new Date(b._invoiceDate || 0).getTime();
                            return da - db;
                          })
                          .map((row) => (
                            <tr key={row._id || `${row._invoiceNo}-${row._idx}`}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{row._invoiceNo}</div>
                              </td>

                              <td>{formatDate(row._invoiceDate)}</td>

                              <td className="text-center" style={{ fontWeight: 600 }}>
                                {STATUS_LABELS[row._status] || row._status || "-"}
                              </td>

                              <td className="text-end">
                                <div style={{ fontWeight: 700 }}>
                                  {formatCurrency(row._invoiceValue)}
                                </div>
                                <div className="small-muted">
                                  Paid: {formatCurrency(row._paidAmount)}
                                </div>
                              </td>

                              <td className="text-end" style={{ fontWeight: 700 }}>
                                {formatCurrency(row._balance)}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center" style={{ color: "#6b7280" }}>
                            No invoice rows
                          </td>
                        </tr>
                      )
                    ) : prepared.groupedEntries.length ? (
                      prepared.groupedEntries.map((group, groupIndex) => (
                        <React.Fragment key={`${group.groupName}-${groupIndex}`}>
                          {group.invoices.map((row, rowIndex) => (
                            <tr key={row._id || `${row._invoiceNo}-${row._idx}`}>
                              {rowIndex === 0 && (
                                <td rowSpan={group.invoices.length + 1} style={{ verticalAlign: "top" }}>
                                  <div style={{ fontWeight: 700 }}>{group.groupName || "-"}</div>
                                  <div className="small-muted">
                                    {group.invoices.length} invoice{group.invoices.length > 1 ? "s" : ""}
                                  </div>
                                </td>
                              )}

                              <td>
                                <div style={{ fontWeight: 700 }}>{row._invoiceNo}</div>
                              </td>

                              <td>{formatDate(row._invoiceDate)}</td>

                              <td className="text-center" style={{ fontWeight: 600 }}>
                                {STATUS_LABELS[row._status] || row._status || "-"}
                              </td>

                              <td className="text-end">
                                <div style={{ fontWeight: 700 }}>
                                  {formatCurrency(row._invoiceValue)}
                                </div>
                                <div className="small-muted">
                                  Paid: {formatCurrency(row._paidAmount)}
                                </div>
                              </td>

                              <td className="text-end" style={{ fontWeight: 700 }}>
                                {formatCurrency(row._balance)}
                              </td>
                            </tr>
                          ))}

                          <tr className="subtotal-row">
                            <td colSpan={3}>Subtotal</td>
                            <td className="text-end">
                              <div>{formatCurrency(group.totals.invoiceValue)}</div>
                              <div className="small-muted">
                                Paid: {formatCurrency(group.totals.paidAmount)}
                              </div>
                            </td>
                            <td className="text-end">
                              {formatCurrency(group.totals.balance)}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center" style={{ color: "#6b7280" }}>
                          No invoice rows
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {(isBothMode ? prepared.normalizedInvoices.length : prepared.groupedEntries.length) > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={isBothMode ? 3 : 4}>Grand Total</td>
                        <td className="text-end">
                          <div>{formatCurrency(prepared.grandTotals.invoiceValue)}</div>
                          <div className="small-muted">
                            Paid: {formatCurrency(prepared.grandTotals.paidAmount)}
                          </div>
                        </td>
                        <td className="text-end">
                          {formatCurrency(prepared.grandTotals.balance)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="footer">
            <span>Generated from Tour Unload Report</span>
            <span>
              Mode:{" "}
              {isSalesRepMode
                ? "Sales Rep Drill-down"
                : isCustomerMode
                ? "Customer Drill-down"
                : "Customer + Sales Rep Drill-down"}
            </span>
            <span>Printed on {formatDateTime(new Date())}</span>
          </div>
        </div>
      </div>
    );
  }
);

export default ReceivablesDrilldownPrintTemplate;