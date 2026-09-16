/**
 * scrubEvent.ts — Sentry `beforeSend` hook shared by the client, server and
 * edge Sentry configs.
 *
 * Request bodies in this app carry user secrets (API keys, Dropbox tokens) and
 * personal data (resume, job description). Sentry can attach the request body
 * to an error event, so every sensitive field is replaced with a placeholder
 * before the event leaves the process.
 */

/** Request-body fields that must never reach Sentry. */
export const REDACTED_FIELDS = [
  'anthropicKey',
  'dropboxToken',
  'resume',
  'jobDescription',
] as const;

export const REDACTED_PLACEHOLDER = '[REDACTED]';

/** The only part of a Sentry event this hook reads. */
interface EventWithRequestData {
  request?: { data?: unknown };
}

/**
 * Redacts sensitive request-body fields in place and returns the same event,
 * which is the contract Sentry expects from `beforeSend`.
 */
export function scrubEvent<T extends EventWithRequestData>(event: T): T {
  const data = event.request?.data;
  // Sentry may attach the body as a string or omit it; only objects can hold fields.
  if (typeof data !== 'object' || data === null) return event;

  const fields = data as Record<string, unknown>;
  for (const field of REDACTED_FIELDS) {
    // Truthiness check (not `in`) matches the original behaviour: empty values are left alone.
    if (fields[field]) fields[field] = REDACTED_PLACEHOLDER;
  }
  return event;
}
