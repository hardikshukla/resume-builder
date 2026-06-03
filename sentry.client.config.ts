import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      if (typeof data === 'object' && data !== null) {
        if (data.anthropicKey) data.anthropicKey = '[REDACTED]';
        if (data.openaiKey)    data.openaiKey    = '[REDACTED]';
        if (data.dropboxToken) data.dropboxToken = '[REDACTED]';
        if (data.resume)       data.resume       = '[REDACTED]';
        if (data.jobDescription) data.jobDescription = '[REDACTED]';
      }
    }
    return event;
  },
});
