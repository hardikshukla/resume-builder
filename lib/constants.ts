/**
 * constants.ts — Shared input size limits.
 */

/** Maximum resume character length accepted by the API. */
export const MAX_RESUME_CHARS = 15_000;

/** Maximum job description character length accepted by the API. */
export const MAX_JD_CHARS = 8_000;

/** Char count at which the UI shows an amber warning (approaching limit). */
export const RESUME_WARN_CHARS = 12_000;

/** Char count at which the UI shows an amber warning for JD. */
export const JD_WARN_CHARS = 6_000;

/** Default Anthropic model name. */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
