/**
 * Dropbox returns machine-readable `error_summary` strings such as
 * "invalid_access_token/..." or "path/insufficient_space/..". They leak API
 * jargon into the UI and carry trailing slashes, so the ones users actually hit
 * are mapped to plain language that says what to do next.
 */

/** Auth problems — the same cause whether it surfaced on the check or an upload. */
const TOKEN_MESSAGES: ReadonlyArray<[string, string]> = [
  ['expired_access_token', 'This token has expired. Generate a new one in the Dropbox App Console.'],
  ['invalid_access_token', 'Dropbox rejected this token. Check you pasted all of it, or generate a new one.'],
  ['missing_scope', 'This token is missing a permission. Set both scopes, then generate a new token.'],
  ['rate_limited', 'Dropbox is rate-limiting this token. Try again in a minute.'],
];

/** Problems specific to saving a file. */
const UPLOAD_MESSAGES: ReadonlyArray<[string, string]> = [
  ['insufficient_space', 'Your Dropbox is full. Free up some space, then save again.'],
  ['too_many_write_operations', 'Dropbox is busy with other changes. Try saving again in a moment.'],
  ['too_many_requests', 'Dropbox is busy with other changes. Try saving again in a moment.'],
  ['disallowed_name', 'Dropbox would not accept this file name. Try a different company name.'],
];

const UPLOAD_FALLBACK = "Dropbox couldn't save the file. Try again in a moment.";

/** Splits "path/insufficient_space/.." into its non-empty segments. */
function summaryCodes(summary: string): string[] {
  return summary.split('/').map((part) => part.trim()).filter(Boolean);
}

/** First message whose code appears as any segment of the summary. */
function findMessage(summary: string, table: ReadonlyArray<[string, string]>): string | undefined {
  const codes = summaryCodes(summary);
  return table.find(([code]) => codes.includes(code))?.[1];
}

/** Human-readable form of a summary's first segment, e.g. "path conflict". */
function describeCode(summary: string): string {
  return (summaryCodes(summary)[0] ?? '').replace(/[_.]/g, ' ').trim();
}

/** Message for a failed token check (`/api/dropbox/verify`). */
export function toDropboxErrorMessage(errorSummary: unknown): string {
  if (typeof errorSummary !== 'string' || !errorSummary.trim()) {
    return 'Dropbox rejected this token.';
  }

  const summary = errorSummary.trim();
  const known = findMessage(summary, TOKEN_MESSAGES);
  if (known) return known;

  const described = describeCode(summary);
  return described ? `Dropbox rejected this token (${described}).` : 'Dropbox rejected this token.';
}

/**
 * Message for a failed file upload, given the raw response body from
 * content.dropboxapi.com. The body is never shown as-is: it is JSON the user
 * cannot act on, and non-JSON bodies (proxies, outages) are worse.
 */
export function toDropboxUploadErrorMessage(responseBody: string): string {
  let summary: unknown;
  try {
    summary = (JSON.parse(responseBody) as { error_summary?: unknown }).error_summary;
  } catch {
    return UPLOAD_FALLBACK;
  }
  if (typeof summary !== 'string' || !summary.trim()) return UPLOAD_FALLBACK;

  const known = findMessage(summary, TOKEN_MESSAGES) ?? findMessage(summary, UPLOAD_MESSAGES);
  if (known) return known;

  // Upload errors wrap the real code in "path/", e.g. "path/conflict/file/..".
  const codes = summaryCodes(summary);
  const specific = codes[0] === 'path' && codes[1] ? codes.slice(1).join('/') : summary;
  const described = describeCode(specific);
  return described ? `Dropbox couldn't save the file (${described}).` : UPLOAD_FALLBACK;
}
