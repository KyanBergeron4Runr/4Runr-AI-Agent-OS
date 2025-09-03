import { z } from 'zod';

// Strong types exported for SDK reuse
export const RunCreateInputSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(128, 'Name must be 128 characters or less')
    .refine(name => name.trim().length > 0, 'Name cannot be empty or whitespace'),
  
  input: z.union([
    z.string().max(65536, 'Input string must be 64KB or less'), // 64KB
    z.record(z.any()).refine(
      (obj) => JSON.stringify(obj).length <= 131072, // 128KB
      'Input object must be 128KB or less when serialized'
    )
  ]).optional(),
  
  client_token: z.string()
    .min(8, 'Client token must be at least 8 characters')
    .max(128, 'Client token must be 128 characters or less')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Client token must contain only alphanumeric characters, underscores, and hyphens')
    .optional(),
  
  tags: z.array(
    z.string()
      .min(1, 'Tag cannot be empty')
      .max(64, 'Tag must be 64 characters or less')
  )
    .max(16, 'Maximum 16 tags allowed')
    .optional()
});

export type RunCreateInput = z.infer<typeof RunCreateInputSchema>;

// Validation result type for error handling
export type ValidationResult = {
  success: boolean;
  data?: RunCreateInput;
  errors?: Array<{
    path: string;
    code: string;
    message: string;
  }>;
};

// Helper function to validate and return structured errors
export function validateRunCreate(input: unknown): ValidationResult {
  const result = RunCreateInputSchema.safeParse(input);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message
  }));
  
  return { success: false, errors };
}
