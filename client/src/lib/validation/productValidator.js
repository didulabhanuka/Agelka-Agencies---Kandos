import { z } from 'zod';

export const brandValidator = z.object({
  brandCode: z.string().min(3, "Brand code must be at least 3 characters").max(10, "Max 10 characters").regex(/^[A-Z0-9]+$/, "Only uppercase letters and numbers allowed"),
  name: z.string().min(5, "Brand name must be at least 5 characters").max(100, "Max 100 characters"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const productGroupValidator = z.object({
  groupCode: z.string().min(3, "Group code must be at least 3 characters").max(10, "Max 10 characters").regex(/^[A-Z0-9]+$/, "Only uppercase letters and numbers allowed"),
  name: z.string().min(3, "Group name must be at least 3 characters").max(100, "Max 100 characters"),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const productTypeValidator = z.object({
  typeCode: z.string().min(3, "Type code must be at least 3 characters").max(10, "Max 10 characters").regex(/^[A-Z0-9]+$/, "Only uppercase letters and numbers allowed"),
  name: z.string().min(3, "Type name must be at least 3 characters").max(100, "Max 100 characters"),
  baseUnit: z.string().optional(),
  subUnits: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const brandUnitConfigValidator = z.object({
  brand: z.string().min(1, "Brand required"),
  productType: z.string().min(1, "Product type required"),
  baseUnit: z.string().min(1, "Base unit required"),
  conversionFactor: z.coerce.number().min(1, "Conversion factor required"),
  note: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const itemValidator = z.object({
  itemCode: z.string().min(3, "Item code must be at least 3 characters").max(10, "Max 10 characters").regex(/^[A-Z0-9]+$/, "Only uppercase letters and numbers allowed"),
  name: z.string().min(5, "Item name must be at least 5 characters").max(100, "Max 100 characters"),
  description: z.string().min(2, "Description required"),
  brand: z.string(),
  productGroup: z.string(),
  unit: z.string(),
  supplier: z.string(), 
  subUnit: z.string(),
  conversionFactor: z.coerce.number().min(1),
  avgCostUnit: z.coerce.number().min(0),
  sellingPriceUnit: z.coerce.number().min(0),
  avgCostBase: z.coerce.number().min(0),
  sellingPriceBase: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
  status: z.enum(["active", "inactive"]).default("active"),
});
