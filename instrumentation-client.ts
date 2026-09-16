/**
 * Browser Sentry. Injected into the client bundle by withSentryConfig
 * (next.config.mjs). Inactive unless NEXT_PUBLIC_SENTRY_DSN is set.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry/scrubEvent';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  // Errors only. Every error is still reported; 0 just turns off performance
  // traces (a timing report per request), which would use up Sentry quota.
  tracesSampleRate: 0,
  // Strips API keys, tokens and resume/JD text from any attached request body.
  beforeSend: scrubEvent,
});

// Next.js calls this on client-side navigations (Next 15.3+). With traces off
// it records nothing; exporting it silences the SDK's build-time notice.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
