/**
 * common.ts — pieces shared by the API request validators.
 */
import { z } from 'zod';

/** An optional short string (company name, API key, model id), trimmed. */
export const OptionalTextSchema = z.string().trim().max(500).optional();

/** The message shown to the user for an invalid request: the first problem found. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request payload.';
}

/** Result of validating a request body. */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
