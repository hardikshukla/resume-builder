/**
 * sentry.edge.config.ts — T7.1 Edge runtime error tracking
 *
 * Runs in the Edge runtime (middleware.ts).
 * Captures rate-limit bypass attempts and unexpected middleware failures.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.05,
});
