/**
 * sentry.client.config.ts — T7.1 Client-side error tracking
 *
 * This file is loaded in the browser. It captures:
 * - Unhandled JS exceptions from the React tree
 * - Failed fetch() calls that throw (network errors, 5xx)
 *
 * Set NEXT_PUBLIC_SENTRY_DSN in .env.local to activate.
 * Without the DSN, Sentry initialises in no-op mode — no errors thrown.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production — keeps dev console clean
  enabled: process.env.NODE_ENV === 'production',

  // 10% of transactions sampled for performance monitoring
  tracesSampleRate: 0.1,

  // Capture replay for 1% of sessions, 10% of error sessions
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      // Mask all input fields (API keys!) in replays
      maskAllInputs: true,
      blockAllMedia:  true,
    }),
  ],

  // Strip API keys from breadcrumbs/events before sending
  beforeSend(event) {
    // Remove any anthropicKey / openaiKey that leaked into request body breadcrumbs
    if (event.breadcrumbs?.values) {
      const crumbs = Array.from(event.breadcrumbs.values as unknown as Iterable<Record<string, unknown>>);
      event.breadcrumbs.values = crumbs.map((crumb) => {
        const c = crumb as { data?: { body?: string } };
        if (c.data?.body) {
          try {
            const body = JSON.parse(c.data.body);
            if (body.anthropicKey) body.anthropicKey = '[REDACTED]';
            if (body.openaiKey)    body.openaiKey    = '[REDACTED]';
            c.data.body = JSON.stringify(body);
          } catch {
            // Non-JSON body — leave as-is
          }
        }
        return crumb;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
    }
    return event;
  },
});
