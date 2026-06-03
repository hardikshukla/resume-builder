import { NextRequest, NextResponse } from 'next/server';

const ROUTES: Record<string, { limit: number; windowMs: number }> = {
  '/api/generate': { limit: 15, windowMs: 60_000 },
  '/api/analyze-jd': { limit: 15, windowMs: 60_000 },
};

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Map<string, WindowEntry>>();

function getClientIp(req: NextRequest): string {
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
    routeStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.limit - 1, resetMs: config.windowMs };
  }

  if (entry.count >= config.limit) {
    const resetMs = config.windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetMs: config.windowMs - (now - entry.windowStart),
  };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!ROUTES[pathname]) return NextResponse.next();

  const ip = getClientIp(req);
  const { allowed, remaining, resetMs } = checkLimit(pathname, ip);

  if (!allowed) {
    const retryAfterSeconds = Math.ceil(resetMs / 1000);
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'RATE_LIMIT',
          message: 'Too many requests. Please wait before generating or refining again.',
          retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(ROUTES[pathname].limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() + resetMs),
        },
      }
    );
  }

  const res = NextResponse.next();
  res.headers.set('X-RateLimit-Remaining', String(remaining));
  return res;
}

export const config = {
  matcher: ['/api/generate', '/api/analyze-jd'],
};
