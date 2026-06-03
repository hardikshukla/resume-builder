import { z } from 'zod';
import { MAX_JD_CHARS } from '@/lib/constants';

const OptionalTextSchema = z.string().trim().max(500).optional();

const AnalyzeJdSchema = z.object({
  jobDescription: z.string().min(1, 'Job description is required.').max(
    MAX_JD_CHARS,
    `Job description must be under ${MAX_JD_CHARS.toLocaleString()} characters.`
  ),
  companyName: OptionalTextSchema,
  anthropicKey: OptionalTextSchema,
  model: OptionalTextSchema,
});

export interface AnalyzeJdRequest {
  jobDescription: string;
  companyName?: string;
  anthropicKey?: string;
  model?: string;
}

type ValidationResult =
  | { success: true; data: AnalyzeJdRequest }
  | { success: false; error: string };

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request payload.';
}

export function validateAnalyzeJdRequest(body: unknown): ValidationResult {
  const result = AnalyzeJdSchema.safeParse(body);
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}
