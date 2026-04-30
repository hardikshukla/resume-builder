/**
 * instrumentation.ts — Server & Edge error tracking
 * This is the modern Next.js convention for instrumenting your app.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      tracesSampleRate: 0.1,

      // Strip API keys from server-side event data before sending
      beforeSend(event) {
        if (event.request?.data) {
          const data = event.request.data as Record<string, unknown>;
          if (data.anthropicKey) data.anthropicKey = '[REDACTED]';
          if (data.openaiKey)    data.openaiKey    = '[REDACTED]';
          if (data.dropboxToken) data.dropboxToken = '[REDACTED]';
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      tracesSampleRate: 0.05,
    });
  }
}
