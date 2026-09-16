import { z } from 'zod';
import { MAX_JD_CHARS } from '@/lib/constants';
import { OptionalTextSchema, ValidationResult, firstIssueMessage } from '@/lib/validation/common';

const AnalyzeJdSchema = z.object({
  jobDescription: z.string().min(1, 'Job description is required.').max(
    MAX_JD_CHARS,
    `Job description must be under ${MAX_JD_CHARS.toLocaleString()} characters.`
  ),
  companyName: OptionalTextSchema,
  anthropicKey: OptionalTextSchema,
  model: OptionalTextSchema,
});

/** A validated /api/analyze-jd request body. */
export type AnalyzeJdRequest = z.infer<typeof AnalyzeJdSchema>;

export function validateAnalyzeJdRequest(body: unknown): ValidationResult<AnalyzeJdRequest> {
  const result = AnalyzeJdSchema.safeParse(body);
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}
