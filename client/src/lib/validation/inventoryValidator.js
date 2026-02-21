import { z } from "zod";

// Shared ObjectId (for internal referencing if needed)
export const objectId = z.string().min(1, "Required");

// -------------------- BRANCH VALIDATION --------------------
export const branchValidator = z.object({
  branchCode: z
    .string()
    .trim()
    .min(1, "Branch code is required")
    .max(10, "Branch code cannot exceed 10 characters")
    .regex(/^[A-Z0-9-]+$/, "Branch code may only contain uppercase letters, numbers, or dashes."),
  name: z
    .string()
    .trim()
    .min(1, "Branch name is required")
    .max(100, "Branch name cannot exceed 100 characters"),
  address: z
    .string()
    .trim()
    .max(200, "Address must be valid text.")
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+ -]{6,20}$/, "Phone number must be valid and within 20 characters.")
    .optional(),
  email: z
    .string()
    .trim()
    .email("Email address must be valid.")
    .optional(),
  status: z
    .enum(["active", "inactive"], { errorMap: () => ({ message: "Status must be either active or inactive." }) })
    .optional()
    .default("active"),
});