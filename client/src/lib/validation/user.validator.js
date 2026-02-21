import { z } from "zod";

export const userValidator = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special symbol"),
  role: z.enum(["Admin", "DataEntry"], "Please select a valid role"),
});

export const customerValidator = z.object({
  name: z.string().min(5, "Name must be at least 5 characters").max(100, "Max 100 characters"),
  address: z.string().min(10, "Address must be at least 5 characters").max(100, "Max 100 characters"),
  city: z.string().trim().min(4, "City name too short").max(100, "Max 100 chars"),
  owner: z.string().min(5, "Owner name must be at least 5 characters").max(100, "Max 100 characters"),
  contactNumber: z.string().trim().regex(/^\+?[0-9]{7,15}$/, "Invalid contact number"),
  salesRep: z.string().trim().min(1, "Sales rep required").max(50, "Max 50 chars").optional(),
  creditLimit: z.union([z.coerce.number().min(0).max(1e7), z.literal("").transform(() => 0)]).optional(),
  creditPeriod: z.union([z.coerce.number().min(0).max(365), z.literal("").transform(() => 0)]).optional(),
  status: z.enum(["active", "suspended"]).default("active"),
});

export const supplierValidator = z.object({
  name: z.string().min(5, "Name must be at least 5 characters").max(100, "Max 100 characters"),
  owner: z.string().min(5, "Owner name must be at least 5 characters").max(100, "Max 100 characters"),
  address: z.string().min(10, "Address must be at least 10 characters").max(100, "Max 100 characters"),
  contactNumber: z.string().trim().regex(/^\+?[0-9]{7,15}$/, "Invalid contact number"),
  status: z.enum(['active', 'inactive']).default("active"),
});

export const salesRepValidator = z.object({
  name: z.string().min(5, "Name must be at least 5 characters").max(100, "Max 100 characters"),
  contactNumber: z.string().trim().regex(/^\+?[0-9]{7,15}$/, "Invalid contact number"),
  route: z.string().min(4, "Route name too short").max(50, "Route name too long").optional().nullable(),
  address: z.string().max(200, "Address too long"),
  NIC: z.string().regex(/^([0-9]{9}[vVxX]|[0-9]{12})$/, "Invalid NIC format"),
  status: z.enum(["active", "inactive"]).default("active"),
});


export const userCreateOptionalPassword = userValidator.partial({ password: true });
