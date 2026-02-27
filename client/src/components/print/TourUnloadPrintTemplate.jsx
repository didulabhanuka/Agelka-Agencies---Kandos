import React, { forwardRef, useMemo } from "react";

const formatDateTime = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB");
};

const formatDate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB");
};

const isEmpty = (v) => v === "" || v === null || v === undefined;

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// UOM-safe
const compactQty = (qty, uom) => {
  const n = toNumber(qty);
  if (!uom) return `${n}`;
  return `${n}${uom}`;
};

const normalizeToBase = ({ primaryQty, baseQty, factorToBase, hasBase }) => {
  const factor = Math.max(1, Math.floor(toNumber(factorToBase || 1)));
  const p = toNumber(primaryQty);
  const b = hasBase ? toNumber(baseQty) : 0;
  return hasBase ? p * factor + b : p;
};

const baseToDisplayText = ({ totalBaseQty, factorToBase, primaryUom, baseUom, hasBase }) => {
  const totalBase = Math.max(0, Math.floor(toNumber(totalBaseQty)));
  const factor = Math.max(1, Math.floor(toNumber(factorToBase || 1)));

  if (!hasBase || !baseUom || factor <= 1) {
    return compactQty(totalBase, primaryUom || baseUom || "UNIT");
  }

  const primary = Math.floor(totalBase / factor);
  const base = totalBase % factor;

  if (primary > 0 && base > 0) return `${compactQty(primary, primaryUom)} + ${compactQty(base, baseUom)}`;
  if (primary > 0) return compactQty(primary, primaryUom);
  return compactQty(base, baseUom);
};

const getStatusText = (row) => {
  const hasBase = !!row.baseUom && toNumber(row.factorToBase) > 1;

  const primaryEmpty = isEmpty(row.countedPrimary);
  const baseEmpty = isEmpty(row.countedBase);
  const notCounted = hasBase ? primaryEmpty && baseEmpty : primaryEmpty;

  if (notCounted) return "Not Counted";

  const systemBase = normalizeToBase({
    primaryQty: row.qtyOnHandPrimary,
    baseQty: row.qtyOnHandBase,
    factorToBase: row.factorToBase,
    hasBase,
  });

  const countedBase = normalizeToBase({
    primaryQty: row.countedPrimary,
    baseQty: row.countedBase,
    factorToBase: row.factorToBase,
    hasBase,
  });

  if (countedBase === systemBase) return "All There";

  if (countedBase < systemBase) {
    const missingBase = systemBase - countedBase;
    const missingText = baseToDisplayText({
      totalBaseQty: missingBase,
      factorToBase: row.factorToBase,
      primaryUom: row.primaryUom,
      baseUom: row.baseUom,
      hasBase,
    });
    return `Missing (${missingText})`;
  }

  const extraBase = countedBase - systemBase;
  const extraText = baseToDisplayText({
    totalBaseQty: extraBase,
    factorToBase: row.factorToBase,
    primaryUom: row.primaryUom,
    baseUom: row.baseUom,
    hasBase,
  });
  return `Extra (${extraText})`;
};

const getSystemQtyText = (row) => {
  const hasBase = !!row.baseUom && toNumber(row.factorToBase) > 1;
  if (!hasBase) return compactQty(row.qtyOnHandPrimary, row.primaryUom);
  return `${compactQty(row.qtyOnHandPrimary, row.primaryUom)} + ${compactQty(row.qtyOnHandBase, row.baseUom)}`;
};

const getCountedQtyText = (row) => {
  const hasBase = !!row.baseUom && toNumber(row.factorToBase) > 1;

  const primaryEmpty = isEmpty(row.countedPrimary);
  const baseEmpty = isEmpty(row.countedBase);

  if (hasBase) {
    if (primaryEmpty && baseEmpty) return "-";

    const totalBase = normalizeToBase({
      primaryQty: row.countedPrimary,
      baseQty: row.countedBase,
      factorToBase: row.factorToBase,
      hasBase: true,
    });

    return baseToDisplayText({
      totalBaseQty: totalBase,
      factorToBase: row.factorToBase,
      primaryUom: row.primaryUom,
      baseUom: row.baseUom,
      hasBase: true,
    });
  }

  if (primaryEmpty) return "-";
  return compactQty(row.countedPrimary, row.primaryUom);
};

const TourUnloadPrintTemplate = forwardRef(
  (
    {
      rows = [], // pass filteredRows
      brandFilterLabel = "",
      salesRepFilterLabel = "",
      generatedBy = "System User",
      generatedAt = new Date(),
      company = {
        name: "Agelka Agencies",
        address: "41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka",
        phone: "+94 55 720 0446",
      },
      includeOnlyCounted = true,
    },
    ref
  ) => {
    const prepared = useMemo(() => {
      const allRows = Array.isArray(rows) ? rows : [];

      const printableRows = allRows
        .map((r) => ({
          ...r,
          _statusText: getStatusText(r),
          _systemQtyText: getSystemQtyText(r),
          _countedQtyText: getCountedQtyText(r),
        }))
        .filter((r) => (includeOnlyCounted ? r._statusText !== "Not Counted" : true));

      const summary = printableRows.reduce(
        (acc, r) => {
          if (r._statusText === "All There") acc.allThere += 1;
          else if (r._statusText.startsWith("Missing")) acc.missing += 1;
          else if (r._statusText.startsWith("Extra")) acc.extra += 1;
          else acc.notCounted += 1;
          return acc;
        },
        { allThere: 0, missing: 0, extra: 0, notCounted: 0 }
      );

      return { printableRows, summary };
    }, [rows, includeOnlyCounted]);

    const showBrand = !!brandFilterLabel && brandFilterLabel !== "All";
    const showSalesRep = !!salesRepFilterLabel && salesRepFilterLabel !== "All";
    const noFiltersApplied = !showBrand && !showSalesRep;

    return (
      <div ref={ref} className="tour-unload-print-root">
        <style>{`
          @page { size: A4; margin: 10mm; }

          .tour-unload-print-root {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #fff;
            width: 100%;
            padding: 0;
            font-size: 12px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .tour-unload-print-root .print-page { width: 190mm; margin: 0 auto; }

          .tour-unload-print-root .header {
            display: flex; justify-content: space-between; align-items: flex-start;
            gap: 14px; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 12px;
          }

          .tour-unload-print-root .company h1 { margin: 0 0 4px; font-size: 20px; line-height: 1.2; }
          .tour-unload-print-root .company p { margin: 2px 0; font-size: 12px; color: #374151; }

          .tour-unload-print-root .doc-box { min-width: 260px; text-align: right; }
          .tour-unload-print-root .doc-title { margin: 0 0 6px; font-size: 20px; font-weight: 700; }
          .tour-unload-print-root .doc-meta { font-size: 12px; color: #374151; line-height: 1.5; }

          .tour-unload-print-root .section {
            border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 12px;
            overflow: hidden; background: #fff;
          }

          .tour-unload-print-root .section-title {
            background: #f9fafb; border-bottom: 1px solid #d1d5db; padding: 8px 10px;
            font-size: 12px; font-weight: 700; text-transform: uppercase; color: #374151;
          }

          .tour-unload-print-root .section-body { padding: 10px; }

          .tour-unload-print-root .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }

          .tour-unload-print-root .field {
            display: grid; grid-template-columns: 110px 1fr; gap: 8px;
            font-size: 12px; line-height: 1.4;
          }

          .tour-unload-print-root .field-label { color: #6b7280; font-weight: 600; }
          .tour-unload-print-root .field-value { font-weight: 600; word-break: break-word; }

          .tour-unload-print-root .table-wrap {
            border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; background: #fff;
          }

          .tour-unload-print-root table {
            width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0;
          }

          .tour-unload-print-root thead th {
            background: #f3f4f6; color: #374151; font-size: 10px; text-transform: uppercase;
            letter-spacing: 0.04em; font-weight: 700; padding: 7px 5px; text-align: center;
            vertical-align: middle; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db;
            white-space: nowrap;
          }

          .tour-unload-print-root thead th:last-child { border-right: 0; }

          .tour-unload-print-root tbody td {
            font-size: 11px; padding: 7px 6px; border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb; vertical-align: top;
          }

          .tour-unload-print-root tbody td:last-child { border-right: 0; }
          .tour-unload-print-root tbody tr:last-child td { border-bottom: 0; }

          .tour-unload-print-root .item-col { width: 40%; text-align: left !important; }
          .tour-unload-print-root .qty-col { width: 20%; }
          .tour-unload-print-root .count-col { width: 20%; }
          .tour-unload-print-root .status-col { width: 20%; }

          .tour-unload-print-root .item-name {
            font-weight: 700; margin-bottom: 2px; font-size: 11px; overflow-wrap: anywhere;
          }

          .tour-unload-print-root .item-code { color: #4b5563; font-size: 10px; overflow-wrap: anywhere; }
          .tour-unload-print-root .qty-text { font-weight: 600; color: #111827; }
          .tour-unload-print-root .status-text { font-weight: 700; color: #111827; }

          .tour-unload-print-root .summary-box {
            width: 100%; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden;
          }

          .tour-unload-print-root .summary-row {
            display: flex; justify-content: space-between; padding: 8px 10px;
            border-bottom: 1px solid #e5e7eb; font-size: 12px;
          }
          .tour-unload-print-root .summary-row:last-child { border-bottom: none; }
          .tour-unload-print-root .summary-row.total {
            background: #f9fafb; font-size: 13px; font-weight: 700;
          }

          .tour-unload-print-root .footer {
            margin-top: 12px; border-top: 1px dashed #d1d5db; padding-top: 8px;
            display: flex; justify-content: space-between; color: #6b7280;
            font-size: 10px; gap: 8px; flex-wrap: wrap;
          }

          @media print {
            .tour-unload-print-root {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>

        <div className="print-page">
          <div className="header">
            <div className="company">
              <h1>{company?.name || "Company"}</h1>
              {company?.address ? <p>{company.address}</p> : null}
              {company?.phone ? <p>{company.phone}</p> : null}
            </div>

            <div className="doc-box">
              <div className="doc-title">Tour Unload Report</div>
              <div className="doc-meta">
                <div><strong>Date:</strong> {formatDate(generatedAt)}</div>
                <div><strong>Generated At:</strong> {formatDateTime(generatedAt)}</div>
                <div><strong>Generated By:</strong> {generatedBy || "-"}</div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Report Filters</div>
            <div className="section-body">
              {noFiltersApplied ? (
                <div className="field">
                  <div className="field-label">Filters</div>
                  <div className="field-value">None</div>
                </div>
              ) : (
                <div className="grid">
                  {showBrand ? (
                    <div className="field">
                      <div className="field-label">Brand</div>
                      <div className="field-value">{brandFilterLabel}</div>
                    </div>
                  ) : null}
                  {showSalesRep ? (
                    <div className="field">
                      <div className="field-label">Sales Rep</div>
                      <div className="field-value">{salesRepFilterLabel}</div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-title">Unload Summary</div>
            <div className="section-body">
              <div className="summary-box">
                <div className="summary-row"><span>All There</span><span>{prepared.summary.allThere}</span></div>
                <div className="summary-row"><span>Missing</span><span>{prepared.summary.missing}</span></div>
                <div className="summary-row"><span>Extra</span><span>{prepared.summary.extra}</span></div>
                <div className="summary-row total"><span>Not Counted</span><span>{prepared.summary.notCounted}</span></div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Counted Items (Filtered Results Only)</div>
            <div className="section-body">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="item-col">Item</th>
                      <th className="qty-col">System Qty</th>
                      <th className="count-col">Unload Count</th>
                      <th className="status-col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.printableRows.length ? (
                      prepared.printableRows.map((row) => (
                        <tr key={row.id || `${row.itemCode}-${row.itemName}`}>
                          <td>
                            <div className="item-name">{row.itemName || "-"}</div>
                            <div className="item-code">{row.itemCode || "-"}</div>
                          </td>
                          <td><div className="qty-text">{row._systemQtyText}</div></td>
                          <td><div className="qty-text">{row._countedQtyText}</div></td>
                          <td><div className="status-text">{row._statusText}</div></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "#6b7280" }}>
                          No counted rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="footer">
            <span>Generated from Tour Unload Report</span>
            <span>Only counted rows from current filtered view are included</span>
            <span>Printed on {formatDateTime(new Date())}</span>
          </div>
        </div>
      </div>
    );
  }
);

export default TourUnloadPrintTemplate;