import { z } from 'zod';
import { MAX_JD_CHARS, MAX_RESUME_CHARS } from '@/lib/constants';
import { GenerateRequest } from '@/types';

export const MAX_SELECTED_RECOMMENDATIONS = 10;
export const MAX_RECOMMENDATION_TEXT_CHARS = 500;
export const MAX_CURRENT_OUTPUT_JSON_CHARS = MAX_RESUME_CHARS * 2;

type ValidationResult =
  | { success: true; data: GenerateRequest }
  | { success: false; error: string };

const OptionalTextSchema = z.string().trim().max(500).optional();

const RecommendationSchema = z.object({
  id: z.string().trim().min(1).max(100),
  claim: z.string().trim().min(1).max(MAX_RECOMMENDATION_TEXT_CHARS),
  targetSection: z.string().trim().min(1).max(120),
  evidenceRequired: z.string().trim().min(1).max(MAX_RECOMMENDATION_TEXT_CHARS),
  evidenceFound: z.string().trim().min(1).max(MAX_RECOMMENDATION_TEXT_CHARS),
  riskLevel: z.enum(['low', 'medium', 'high']),
  resolvesDealbreakers: z.array(z.string().trim().max(100)).max(10).default([]),
});

const GenerateSchema = z.object({
  mode: z.literal('generate'),
  resume: z.string().min(1, 'Resume is required.').max(
    MAX_RESUME_CHARS,
    `Resume must be under ${MAX_RESUME_CHARS.toLocaleString()} characters.`
  ),
  jobDescription: z.string().min(1, 'Job description is required.').max(
    MAX_JD_CHARS,
    `Job description must be under ${MAX_JD_CHARS.toLocaleString()} characters.`
  ),
  companyName: OptionalTextSchema,
  anthropicKey: OptionalTextSchema,
  model: OptionalTextSchema,
});

const RefineSchema = z.object({
  mode: z.literal('refine'),
  resume: z.string().max(MAX_RESUME_CHARS).optional(),
  jobDescription: z.string().max(MAX_JD_CHARS).optional(),
  companyName: OptionalTextSchema,
  anthropicKey: OptionalTextSchema,
  model: OptionalTextSchema,
  currentOutput: z.object({
    resume: z.object({}).passthrough(),
    coverLetter: z.object({}).passthrough().optional(),
  }).passthrough(),
  selectedRecommendations: z.array(RecommendationSchema)
    .min(1, 'Select at least one recommendation to refine.')
    .max(
      MAX_SELECTED_RECOMMENDATIONS,
      `Select at most ${MAX_SELECTED_RECOMMENDATIONS} recommendations at once.`
    ),
});

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request payload.';
}

export function validateGenerateRequest(body: unknown): ValidationResult {
  const mode = z.object({ mode: z.enum(['generate', 'refine']) }).safeParse(body);
  if (!mode.success) {
    return { success: false, error: 'Invalid mode specified.' };
  }

  if (mode.data.mode === 'generate') {
    const result = GenerateSchema.safeParse(body);
    if (!result.success) {
      return { success: false, error: firstIssueMessage(result.error) };
    }
    return { success: true, data: result.data };
  }

  const result = RefineSchema.safeParse(body);
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }

  {
    const currentOutputSize = JSON.stringify(result.data.currentOutput).length;
    if (currentOutputSize > MAX_CURRENT_OUTPUT_JSON_CHARS) {
      return {
        success: false,
        error: 'Current resume output is too large to refine. Try regenerating with a shorter resume.',
      };
    }
  }

  return { success: true, data: result.data as unknown as GenerateRequest };
}
