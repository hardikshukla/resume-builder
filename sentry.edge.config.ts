import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry/scrubEvent';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: 1.0,
  // Strips API keys, tokens and resume/JD text from any attached request body.
  beforeSend: scrubEvent,
});
