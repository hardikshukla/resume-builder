/**
 * sentry.server.config.ts — T7.1 Server-side error tracking
 *
 * Runs in the Node.js runtime (API routes, Server Components).
 * Captures:
 * - LLM API failures (Anthropic / OpenAI / Ollama errors)
 * - DOCX generation errors
 * - Unhandled promise rejections in route handlers
 *
 * Set SENTRY_DSN in .env.local to activate.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === 'production',

  tracesSampleRate: 0.1,

  // Strip API keys from server-side event data before sending
  beforeSend(event) {
    // Scrub request bodies that contain API keys
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      if (data.anthropicKey) data.anthropicKey = '[REDACTED]';
      if (data.openaiKey)    data.openaiKey    = '[REDACTED]';
    }
    return event;
  },
});
