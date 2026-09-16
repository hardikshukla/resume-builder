/**
 * Next.js calls register() once per server runtime at startup. It loads the
 * matching Sentry config. On Next 14 this file only runs because
 * withSentryConfig enables experimental.instrumentationHook.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
