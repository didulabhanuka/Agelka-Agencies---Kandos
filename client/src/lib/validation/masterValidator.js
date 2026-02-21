import { z } from 'zod';

export const branchValidator = z.object({
  branchCode: z.string().min(1, 'Branch code required'),
  name: z.string().min(2, 'Name required'),
  location: z.string().optional(),
  contactNumber: z.string().optional(),
  manager: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
