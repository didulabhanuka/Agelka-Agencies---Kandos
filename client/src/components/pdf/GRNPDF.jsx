// src/pdf/GRNPDF.jsx
import React, { useEffect, useState } from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import QRCode from "qrcode";

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
async function generateDocumentHash(grn) {
  const payload = JSON.stringify({
    id: String(grn._id || ""),
    grnNo: grn.grnNo,
    supplier: grn.supplier?.name,
    branch: grn.branch?.name,
    supplierInvoiceNo: grn.supplierInvoiceNo,
    supplierInvoiceDate: grn.supplierInvoiceDate,
    receivedDate: grn.receivedDate,
    totalValue: grn.totalValue,
  });

  const encoded = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateQrDataUrl(grn) {
  const url = `https://yourfrontend.com/grn/${grn._id}`;
  return QRCode.toDataURL(url);
}

function formatMoney(v) {
  return Number(v || 0).toFixed(2);
}

// ----------------------------------------------------
// Styles (matching PO PDF – Option B + security stripes)
// ----------------------------------------------------
const SECURITY_TEXT =
  "AGELKA • VERIFIED DOCUMENT • DO NOT DUPLICATE • ";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 0,
  },

  pageInner: {
    flex: 1,
    margin: 24,
    padding: 24,
    position: "relative",
  },

  // Left accent strip (thin)
  leftStrip: {
    position: "absolute",
    top: 16,
    bottom: 16,
    left: 10,
    width: 5,
    borderRadius: 6,
    backgroundColor: "#5c3e94",
  },

  contentArea: {
    marginLeft: 25,
    flex: 1,
  },

  // Security stripes background
  securityLine: {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: 0.06,
    fontSize: 10,
    color: "#6b7280",
    textAlign: "center",
  },

  // Company header
  companyBlock: {
    marginBottom: 12,
  },
  companyName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111827",
  },
  companyLine: {
    fontSize: 9,
    color: "#374151",
  },
  companyUnderline: {
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },

  // Document header + meta
  headerMetaSection: {
    marginTop: 18,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  headerLeft: {
    flexDirection: "column",
    justifyContent: "flex-start",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },

  statusPill: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    color: "#ffffff",
    alignSelf: "flex-start",
  },

  metaBlock: {
    flexDirection: "column",
    minWidth: 180,
  },

  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },

  metaLabel: {
    width: 110,
    fontSize: 9.5,
    fontWeight: 600,
    color: "#6b7280",
  },

  metaValue: {
    fontSize: 9.5,
    color: "#111827",
  },

  // (Optional logo if you want to re-use)
  logoImage: {
    width: 85,
    height: 30,
    objectFit: "contain",
  },

  // Table
  tableWrapper: {
    marginTop: 12,
  },

  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#fafafa",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  th: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#6b7280",
  },

  thItem: { flex: 4 },
  thQty: { flex: 1, textAlign: "right" },
  thCost: { flex: 2, textAlign: "right" },
  thTotal: { flex: 2, textAlign: "right" },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },

  td: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 9.5,
    color: "#374151",
  },

  tdItem: { flex: 4 },
  tdQty: { flex: 1, textAlign: "right" },
  tdCost: { flex: 2, textAlign: "right" },
  tdTotal: { flex: 2, textAlign: "right" },

  // Total row (under TOTAL column)
  totalRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginTop: 4,
  },
  totalLabelCell: {
    flex: 7,
    textAlign: "right",
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 10,
    fontWeight: 700,
    color: "#111827",
  },
  totalValueCell: {
    flex: 2,
    textAlign: "right",
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 10,
    fontWeight: 700,
    color: "#111827",
  },

  // QR bottom-right
  qrWrapper: {
    position: "absolute",
    right: 12,
    bottom: 120, // room for signatures
    width: 70,
    height: 70,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 2,
  },

  qrImage: {
    width: "100%",
    height: "100%",
  },

  // Signatures at page end
  signaturesSection: {
    position: "absolute",
    bottom: 28,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  signatureBlock: { width: "45%" },

  signatureImage: {
    width: 90,
    height: 34,
    objectFit: "contain",
    marginBottom: 4,
  },

  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginTop: 14,
  },

  signatureLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 4,
  },
});

// ----------------------------------------------------
// GRN Document
// ----------------------------------------------------
const GRNPdfDocument = ({
  grn,
  qrDataUrl,
  documentHash,
  logoSrc,
  preparedSignatureSrc,
  approvedSignatureSrc,
}) => {
  const status = (grn.status || "RECORDED").toUpperCase();

  const statusColors = {
    APPROVED: "#16a34a",
    RECORDED: "#2563eb",
    PENDING: "#d97706",
    CANCELLED: "#dc2626",
    REJECTED: "#dc2626",
  };

  const receivedDate = grn.receivedDate
    ? String(grn.receivedDate).split("T")[0]
    : "-";

  const supplierInvoiceDate = grn.supplierInvoiceDate
    ? String(grn.supplierInvoiceDate).split("T")[0]
    : "-";

  const items = grn.items || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageInner}>
          {/* Left accent strip */}
          <View style={styles.leftStrip} />

          {/* Security stripes background */}
          {Array.from({ length: 10 }).map((_, i) => (
            <Text
              key={i}
              style={[
                styles.securityLine,
                { top: 40 + i * 80 }, // medium density
              ]}
            >
              {SECURITY_TEXT.repeat(6)}
            </Text>
          ))}

          {/* MAIN CONTENT */}
          <View style={styles.contentArea}>
            {/* Company header */}
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>
                AGELKA HARDWARE PVT LTD (Agelka Agencies)
              </Text>
              <Text style={styles.companyLine}>
                NO 20 KAILAGODA ROAD, BADULLA, 90000, Sri Lanka
              </Text>
              <Text style={styles.companyLine}>Contact: (+94) 777788415</Text>
              <Text style={styles.companyLine}>
                Email: agelkahardware@gmail.com
              </Text>
              <View style={styles.companyUnderline} />
            </View>

            {/* Document header + Meta */}
            <View style={styles.headerMetaSection}>
              {/* Left: type + status */}
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>GOODS RECEIVED NOTE</Text>
                <Text
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusColors[status] || "#6b7280" },
                  ]}
                >
                  {status}
                </Text>
              </View>

              {/* Right: meta fields */}
              <View style={styles.metaBlock}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>GRN Number:</Text>
                  <Text style={styles.metaValue}>{grn.grnNo}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Supplier:</Text>
                  <Text style={styles.metaValue}>
                    {grn.supplier?.name || "-"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Branch:</Text>
                  <Text style={styles.metaValue}>
                    {grn.branch?.name || "-"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Supplier Invoice No:</Text>
                  <Text style={styles.metaValue}>
                    {grn.supplierInvoiceNo || "-"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Supplier Invoice Date:</Text>
                  <Text style={styles.metaValue}>{supplierInvoiceDate}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Received Date:</Text>
                  <Text style={styles.metaValue}>{receivedDate}</Text>
                </View>
              </View>
            </View>

            {/* Items table */}
            <View style={styles.tableWrapper}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.thItem]}>Item</Text>
                <Text style={[styles.th, styles.thQty]}>Qty</Text>
                <Text style={[styles.th, styles.thCost]}>Avg Cost (Base)</Text>
                <Text style={[styles.th, styles.thTotal]}>Line Total</Text>
              </View>

              {items.map((line, idx) => {
                const qty = Number(line.qty) || 0;
                const cost = Number(line.avgCostBase) || 0;
                const lineTotal =
                  typeof line.lineTotal === "number"
                    ? line.lineTotal
                    : qty * cost;

                return (
                  <View key={idx} style={styles.row}>
                    <Text style={[styles.td, styles.tdItem]}>
                      {line.item?.name || "-"}
                    </Text>
                    <Text style={[styles.td, styles.tdQty]}>{qty}</Text>
                    <Text style={[styles.td, styles.tdCost]}>
                      Rs. {formatMoney(cost)}
                    </Text>
                    <Text style={[styles.td, styles.tdTotal]}>
                      Rs. {formatMoney(lineTotal)}
                    </Text>
                  </View>
                );
              })}

              {/* Total row */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelCell}>TOTAL</Text>
                <Text style={styles.totalValueCell}>
                  Rs. {formatMoney(grn.totalValue)}
                </Text>
              </View>
            </View>
          </View>

          {/* QR bottom-right */}
          {qrDataUrl && (
            <View style={styles.qrWrapper}>
              <Image src={qrDataUrl} style={styles.qrImage} />
            </View>
          )}

          {/* Signatures bottom */}
          <View style={styles.signaturesSection}>
            <View style={styles.signatureBlock}>
              {preparedSignatureSrc && (
                <Image
                  src={preparedSignatureSrc}
                  style={styles.signatureImage}
                />
              )}
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Prepared By</Text>
            </View>

            <View style={styles.signatureBlock}>
              {approvedSignatureSrc && (
                <Image
                  src={approvedSignatureSrc}
                  style={styles.signatureImage}
                />
              )}
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Approved By</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// ----------------------------------------------------
// Wrapper Component
// ----------------------------------------------------
export const GRNPDF = ({
  grn,
  logoSrc = "/logo.png",
  preparedSignatureSrc = "/signatures/prepared.png",
  approvedSignatureSrc = "/signatures/approved.png",
}) => {
  const [qrDataUrl, setQr] = useState(null);
  const [documentHash, setHash] = useState(null);

  useEffect(() => {
    let cancel = false;

    async function run() {
      try {
        const [hash, qr] = await Promise.all([
          generateDocumentHash(grn),
          generateQrDataUrl(grn),
        ]);
        if (!cancel) {
          setHash(hash);
          setQr(qr);
        }
      } catch (err) {
        console.error("Failed to generate GRN QR/hash:", err);
      }
    }

    if (grn) run();
    return () => {
      cancel = true;
    };
  }, [grn]);

  if (!grn || !qrDataUrl || !documentHash) return null;

  return (
    <GRNPdfDocument
      grn={grn}
      qrDataUrl={qrDataUrl}
      documentHash={documentHash}
      logoSrc={logoSrc}
      preparedSignatureSrc={preparedSignatureSrc}
      approvedSignatureSrc={approvedSignatureSrc}
    />
  );
};

export default GRNPDF;
