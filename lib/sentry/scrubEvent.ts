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
  'token', // /api/dropbox/verify sends the Dropbox token under this name
  'resume',
  'jobDescription',
] as const;

export const REDACTED_PLACEHOLDER = '[REDACTED]';

/** The only part of a Sentry event this hook reads. */
interface EventWithRequestData {
  request?: { data?: unknown };
}

/** Replaces every sensitive field that holds a value. Mutates `fields`. */
function redactFields(fields: Record<string, unknown>): void {
  for (const field of REDACTED_FIELDS) {
    // Truthiness check (not `in`): empty values carry nothing worth hiding.
    if (fields[field]) fields[field] = REDACTED_PLACEHOLDER;
  }
}

/**
 * Redacts sensitive request-body fields in place and returns the same event,
 * which is the contract Sentry expects from `beforeSend`.
 *
 * The server SDK attaches the body as a JSON *string*, not an object, so both
 * shapes are handled. A string body that is not JSON cannot be inspected
 * field by field, so it is dropped entirely rather than sent as-is.
 */
export function scrubEvent<T extends EventWithRequestData>(event: T): T {
  const request = event.request;
  const data = request?.data;
  if (!request || data === undefined || data === null) return event;

  if (typeof data === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      request.data = REDACTED_PLACEHOLDER;
      return event;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      redactFields(parsed as Record<string, unknown>);
      request.data = JSON.stringify(parsed);
    } else {
      // Valid JSON but not an object (e.g. a bare string): nothing to keep.
      request.data = REDACTED_PLACEHOLDER;
    }
    return event;
  }

  if (typeof data === 'object') {
    redactFields(data as Record<string, unknown>);
  }
  return event;
}
