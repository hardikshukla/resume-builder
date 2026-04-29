import { NextRequest, NextResponse } from 'next/server';

/**
 * ── Rate Limiting Middleware (T6.2) ──────────────────────────────────────────
 *
 * Protects the two expensive LLM routes from abuse using an in-memory sliding
 * window counter per IP address.
 *
 * Limits (per IP):
 *   /api/generate  — 5 requests / 60 seconds  (costs ~$0.05–0.20 per call)
 *   /api/refine    — 15 requests / 60 seconds (cheaper, but still bounded)
 *
 * ── Upgrading to Upstash Redis (for multi-instance / Vercel deployment) ───────
 * This implementation uses process memory, which resets on every cold start and
 * is NOT shared across multiple server instances. For production:
 *
 *   1. npm install @upstash/ratelimit @upstash/redis
 *   2. Set env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *   3. Replace the in-memory store below with:
 *
 *      import { Ratelimit } from '@upstash/ratelimit';
 *      import { Redis }     from '@upstash/redis';
 *
 *      const ratelimit = new Ratelimit({
 *        redis: Redis.fromEnv(),
 *        limiter: Ratelimit.slidingWindow(5, '60 s'),
 *      });
 *
 *      const { success } = await ratelimit.limit(ip);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Per-route window config
const ROUTES: Record<string, { limit: number; windowMs: number }> = {
  '/api/generate': { limit: 5,  windowMs: 60_000 },
  '/api/refine':   { limit: 15, windowMs: 60_000 },
};

interface WindowEntry {
  count:     number;
  windowStart: number;
}

// In-memory store: Map<route, Map<ip, WindowEntry>>
const store = new Map<string, Map<string, WindowEntry>>();

function getClientIp(req: NextRequest): string {
  // Vercel forwards the real IP in x-forwarded-for; fall back to a placeholder.
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function checkLimit(route: string, ip: string): { allowed: boolean; remaining: number; resetMs: number } {
  const config = ROUTES[route];
  if (!config) return { allowed: true, remaining: 999, resetMs: 0 };

  if (!store.has(route)) store.set(route, new Map());
  const routeStore = store.get(route)!;

  const now = Date.now();
  const entry = routeStore.get(ip);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    // New window
    routeStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.limit - 1, resetMs: config.windowMs };
  }

  if (entry.count >= config.limit) {
    const resetMs = config.windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.count++;
  return { allowed: true, remaining: config.limit - entry.count, resetMs: config.windowMs - (now - entry.windowStart) };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only rate-limit the LLM routes
  if (!ROUTES[pathname]) return NextResponse.next();

  const ip = getClientIp(req);
  const { allowed, remaining, resetMs } = checkLimit(pathname, ip);

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please wait before generating again.',
        retryAfterSeconds: Math.ceil(resetMs / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After':        String(Math.ceil(resetMs / 1000)),
          'X-RateLimit-Limit':  String(ROUTES[pathname].limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':  String(Date.now() + resetMs),
        },
      }
    );
  }

  const res = NextResponse.next();
  res.headers.set('X-RateLimit-Remaining', String(remaining));
  return res;
}

export const config = {
  matcher: ['/api/generate', '/api/refine'],
};
