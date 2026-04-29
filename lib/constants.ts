/**
 * constants.ts — Shared input size limits.
 *
 * Used by both the server-side API routes (to reject oversized input before
 * calling the LLM) and the client-side UI (to colour-code the char count
 * display and warn the user before they submit).
 *
 * Rationale for the chosen values:
 *   - Claude's context window is ~200k tokens. Output is capped at 8,192 tokens.
 *   - System prompt is ~2,000 tokens.
 *   - Resume at 30,000 chars ≈ 7,500 tokens — leaves ample room for output + prompt.
 *   - JD at 15,000 chars ≈ 3,750 tokens — JDs are rarely longer in practice.
 */

/** Maximum resume character length accepted by the API. */
export const MAX_RESUME_CHARS = 30_000;

/** Maximum job description character length accepted by the API. */
export const MAX_JD_CHARS = 15_000;

/** Char count at which the UI shows an amber warning (approaching limit). */
export const RESUME_WARN_CHARS = 24_000;

/** Char count at which the UI shows an amber warning for JD. */
export const JD_WARN_CHARS = 12_000;

/** Maximum uploaded file size (bytes) accepted by parse-resume. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
