import { z } from "zod";

// Shared
const objectId = z.string().min(1, "Required");

// Line items
export const lineItemSchema = z.object({
  item: objectId,
  qty: z.number().positive("Qty must be > 0"),
  price: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  reason: z.string().optional(),
});

// Invoice
export const invoiceSchema = z.object({
  invoiceNo: z.string().min(1, "Invoice No is required"),
  customer: objectId,
  salesRep: objectId,
  branch: objectId,
  date: z.string().min(1, "Date is required"),
  items: z
    .array(lineItemSchema.pick({ item: true, qty: true, price: true, discount: true, tax: true }))
    .min(1, "At least one item is required"),
});

// Sales Return
export const returnSchema = z.object({
  returnNo: z.string().min(1, "Return No is required"),
  invoice: objectId,
  date: z.string().min(1),
  items: z.array(lineItemSchema.pick({ item: true, qty: true, reason: true })).min(1),
});

// ✅ GRN (Updated)
export const grnSchema = z.object({
  supplier: objectId,
  receivedDate: z.string().min(1, "Received date required"),
  linkedPO: z.string().optional(),
  items: z
    .array(
      z.object({
        item: objectId,
        qty: z.number().positive("Qty must be > 0"),
        cost: z.number().nonnegative("Cost must be >= 0"),
      })
    )
    .min(1, "At least one item required"),
});

// Stock Adjustment
export const adjustmentSchema = z.object({
  adjustmentNo: z.string().min(1),
  item: objectId,
  branch: objectId,
  qty: z.number(), // +/- allowed
  remarks: z.string().min(2),
  date: z.string().min(1),
});
