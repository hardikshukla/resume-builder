import { readFileSync } from 'node:fs';
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */

// The header version badge reads package.json at build time, so bumping the
// version there is the only step — nothing to keep in sync by hand.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// ── Security Headers (T5.4) ────────────────────────────────────────────────
// Applied to every route.
const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer info
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable unused browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  // Force HTTPS for 1 year (production only)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval' " : ""}'unsafe-inline'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // Hosts the *browser* may call. Anthropic and the Dropbox token check are
      // reached through our own API routes ('self'); only the Dropbox file
      // upload goes straight from the browser. Add the Sentry ingest host here
      // when browser Sentry is wired up.
      "connect-src 'self' https://content.dropboxapi.com",
      "worker-src blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  // `next lint` and `next build` only lint app/, pages/, components/, lib/ and
  // src/ by default, which silently skipped hooks/, types/, __tests__/ and the
  // root config files. Lint the whole project instead; ESLint already ignores
  // node_modules and dot-directories such as .next.
  eslint: {
    dirs: ['.'],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config) => {
    // Suppress the @opentelemetry "Critical dependency" Webpack warnings caused by Sentry
    config.ignoreWarnings = [
      { module: /node_modules\/@opentelemetry/ },
      { module: /node_modules\/@sentry/ },
      { module: /node_modules\/@prisma\/instrumentation/ }
    ];
    return config;
  },
};

/**
 * withSentryConfig is what actually turns Sentry on:
 * - injects instrumentation-client.ts (browser Sentry) into the client bundle;
 * - on Next 14, enables experimental.instrumentationHook so instrumentation.ts
 *   loads the server and edge configs.
 * With no DSN set, Sentry.init is a no-op, so this is safe without a Sentry project.
 */
export default withSentryConfig(nextConfig, {
  // Browser events go to /monitoring on this app, which forwards them to
  // Sentry. Keeps the CSP at connect-src 'self' and survives ad-blockers.
  // Only applies to sentry.io DSNs; a self-hosted DSN is called directly and
  // its host must then be added to connect-src above.
  tunnelRoute: '/monitoring',
  // Source maps are uploaded only when Sentry credentials are configured.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Keep build output quiet locally; show plugin logs in CI.
  silent: !process.env.CI,
});
