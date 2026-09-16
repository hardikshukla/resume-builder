/**
 * constants.ts — Shared limits, model ids and app-wide constants.
 */

import { ModelOption } from '@/types';

/** Maximum resume character length accepted by the API. */
export const MAX_RESUME_CHARS = 15_000;

/** Maximum job description character length accepted by the API. */
export const MAX_JD_CHARS = 8_000;

/** Char count at which the UI shows an amber warning (approaching limit). */
export const RESUME_WARN_CHARS = 12_000;

/** Char count at which the UI shows an amber warning for JD. */
export const JD_WARN_CHARS = 6_000;

/**
 * Current Claude model ids used by this app.
 *
 * `sonnet` is the default: like the retired Claude 3.7 Sonnet it replaces, it
 * does not think unless asked, so responses keep the same shape. `sonnet5`
 * and `opus` think by default; lib/llm/anthropic.ts handles the thinking block
 * that precedes their text output.
 */
export const MODEL_IDS = {
  sonnet: 'claude-sonnet-4-6',
  sonnet5: 'claude-sonnet-5',
  opus: 'claude-opus-5',
  haiku: 'claude-haiku-4-5',
} as const;

/** Model used for generation when a request does not name one. */
export const ANTHROPIC_DEFAULT_MODEL: string = MODEL_IDS.sonnet;

/** Model used for the lightweight JD keyword extraction step. */
export const JD_EXTRACTION_MODEL: string = MODEL_IDS.haiku;

/**
 * Models offered in the picker before a key is entered (or if the live
 * /api/models lookup fails). Once a key is validated, the picker is replaced
 * with the models that key can actually use.
 */
export const DEFAULT_MODELS: ModelOption[] = [
  { id: MODEL_IDS.sonnet, name: 'Claude Sonnet 4.6', hint: 'Recommended' },
  { id: MODEL_IDS.sonnet5, name: 'Claude Sonnet 5' },
  { id: MODEL_IDS.opus, name: 'Claude Opus 5', hint: 'Advanced' },
  { id: MODEL_IDS.haiku, name: 'Claude Haiku 4.5', hint: 'Fast' },
];

/**
 * Retired or alias model ids, mapped to the current model that replaces them.
 * Applied before every request, so a stale id never costs a failed API call.
 */
export const MODEL_FALLBACKS: Record<string, string> = {
  // Claude 3.x Sonnet — all retired.
  'claude-3-7-sonnet-20250219': MODEL_IDS.sonnet,
  'claude-3-7-sonnet-latest': MODEL_IDS.sonnet,
  'claude-3-5-sonnet-20241022': MODEL_IDS.sonnet,
  'claude-3-5-sonnet-20240620': MODEL_IDS.sonnet,
  'claude-3-5-sonnet-latest': MODEL_IDS.sonnet,
  // Claude 3 Opus — retired.
  'claude-3-opus-20240229': MODEL_IDS.opus,
  'claude-3-opus-latest': MODEL_IDS.opus,
  // Claude 3.x Haiku — retired.
  'claude-3-5-haiku-20241022': MODEL_IDS.haiku,
  'claude-3-5-haiku-latest': MODEL_IDS.haiku,
  'claude-3-haiku-20240307': MODEL_IDS.haiku,
  // Not a real alias, but previously shipped in this map; kept so old callers still resolve.
  'claude-haiku-4-5-latest': MODEL_IDS.haiku,
};

/**
 * Dropbox App Console. Every user needs their own Dropbox app to mint a
 * personal access token, so this is deliberately not deep-linked to any
 * single app — it lands on the visitor's own app list.
 */
export const DROPBOX_APP_CONSOLE_URL = 'https://www.dropbox.com/developers/apps';

/**
 * localStorage key for the pasted resume. It is kept across tab closes for
 * convenience, and wiped when the inactivity lock fires.
 */
export const RESUME_STORAGE_KEY = 'rb_resume';

/** App version from package.json, injected at build time by next.config.mjs. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '';

/**
 * Match score rules, shared by the prompt (what Claude is asked to do), the
 * schema (what is accepted) and the gap analysis panel (what is shown).
 */
export const SCORE_SECTION_MAX = { summary: 25, skills: 30, experience: 30 } as const;
/** Sum of the section maximums: the full width of the breakdown bar. */
export const SCORE_BREAKDOWN_TOTAL =
  SCORE_SECTION_MAX.summary + SCORE_SECTION_MAX.skills + SCORE_SECTION_MAX.experience;
/** Points deducted per unresolved dealbreaker. */
export const DEALBREAKER_PENALTY = 5;
/** The highest match score Claude may report, even with every keyword present. */
export const MATCH_SCORE_CAP = 95;

/** Maximum file upload size in bytes (5 MB). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

