/**
 * Dropbox returns machine-readable `error_summary` strings like
 * "invalid_access_token/..." or "missing_scope/.". They leak API jargon into the
 * UI and carry a trailing slash, so map the ones users actually hit to plain
 * language that says what to do next.
 */
const MESSAGES: ReadonlyArray<[string, string]> = [
  ['expired_access_token', 'This token has expired. Generate a new one in the Dropbox App Console.'],
  ['invalid_access_token', 'Dropbox rejected this token. Check you pasted all of it, or generate a new one.'],
  ['missing_scope', 'This token is missing a permission. Set both scopes, then generate a new token.'],
  ['rate_limited', 'Dropbox is rate-limiting this token. Try again in a minute.'],
];

export function toDropboxErrorMessage(errorSummary: unknown): string {
  if (typeof errorSummary !== 'string' || !errorSummary.trim()) {
    return 'Dropbox rejected this token.';
  }

  const summary = errorSummary.trim();
  const match = MESSAGES.find(([code]) => summary.startsWith(code));
  if (match) return match[1];

  // Unmapped code: strip Dropbox's trailing "/" and path segments so the raw
  // summary at least reads as a single token rather than a broken URL.
  const cleaned = summary.split('/')[0].replace(/_/g, ' ').trim();
  return cleaned ? `Dropbox rejected this token (${cleaned}).` : 'Dropbox rejected this token.';
}
