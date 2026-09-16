/**
 * Edge-runtime Sentry (middleware.ts runs here), loaded by instrumentation.ts.
 * Inactive unless NEXT_PUBLIC_SENTRY_DSN is set.
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
