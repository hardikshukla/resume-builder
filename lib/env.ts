/**
 * T7.5 — Startup Environment Variable Validation
 *
 * Import this module in any API route that needs a specific env var.
 * It throws at module-load time (i.e. on cold start) rather than at
 * request time, giving an immediate, descriptive failure instead of a
 * cryptic "undefined" later.
 *
 * Usage:
 *   import '@/lib/env';  // just importing is enough — throws if invalid
 *   import { env } from '@/lib/env';  // or use the validated object directly
 */

type Env = {
  // LLM provider defaults (all optional — users can override in the UI)
  DEFAULT_LLM_PROVIDER: string;
  ANTHROPIC_MODEL:       string;
  OPENAI_MODEL:          string;
  OLLAMA_BASE_URL:       string;
  OLLAMA_MODEL:          string;
  // Runtime
  NODE_ENV: string;
};

// ── Optional vars with defaults ───────────────────────────────────────────────
const DEFAULTS: Partial<Env> = {
  DEFAULT_LLM_PROVIDER: 'anthropic',
  ANTHROPIC_MODEL:       'claude-haiku-4-5',
  OPENAI_MODEL:          'gpt-4o',
  OLLAMA_BASE_URL:       'http://localhost:11434',
  OLLAMA_MODEL:          'llama3',
  NODE_ENV:              'development',
};

// ── Required vars (no fallback — hard fail if absent in production) ───────────
// Currently none are hard-required because users supply API keys via the UI.
// If you add a server-side API key (e.g. for a shared deployment), add it here:
const REQUIRED_IN_PRODUCTION: (keyof Env)[] = [
  // e.g. 'ANTHROPIC_API_KEY'
];

function buildEnv(): Env {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];

  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!process.env[key]) missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variable(s): ${missing.join(', ')}\n` +
      `Copy .env.example to .env.local and set the missing values.`
    );
  }

  return {
    DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER ?? DEFAULTS.DEFAULT_LLM_PROVIDER!,
    ANTHROPIC_MODEL:       process.env.ANTHROPIC_MODEL       ?? DEFAULTS.ANTHROPIC_MODEL!,
    OPENAI_MODEL:          process.env.OPENAI_MODEL           ?? DEFAULTS.OPENAI_MODEL!,
    OLLAMA_BASE_URL:       process.env.OLLAMA_BASE_URL        ?? DEFAULTS.OLLAMA_BASE_URL!,
    OLLAMA_MODEL:          process.env.OLLAMA_MODEL           ?? DEFAULTS.OLLAMA_MODEL!,
    NODE_ENV:              process.env.NODE_ENV               ?? DEFAULTS.NODE_ENV!,
  };
}

/**
 * Validated, typed environment variables.
 * Throws at import time in production if required vars are missing.
 */
export const env = buildEnv();
