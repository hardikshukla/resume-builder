/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs';

const securityHeaders = [
  // ── T6.4 Security Headers ──────────────────────────────────────────────────

  // Prevent clickjacking — disallow embedding in iframes
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevent MIME-type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Control how much referrer info is sent
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Disable browser features that are not needed
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Force HTTPS for 1 year (only applies in production behind HTTPS)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.anthropic.com https://api.openai.com https://o1.ingest.sentry.io",
      "worker-src blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // T7.1 — Sentry build-time options
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps only in CI/production — avoids leaking them locally
  silent:              true,
  hideSourceMaps:      true,
  disableLogger:       true,

  // Automatically instrument Next.js server components and API routes
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware:      true,

  // Tunnel Sentry requests through /monitoring to avoid ad-blockers
  tunnelRoute: '/monitoring',
});
