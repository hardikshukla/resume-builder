/**
 * __tests__/integration/middleware.test.ts
 * Tests Next.js middleware rate-limiting behavior directly.
 *
 * Run: npx jest __tests__/integration/middleware.test.ts
 */

import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

function makeMockRequest(path: string, ip: string): NextRequest {
  const req = new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
    },
  });
  return req;
}

describe('Rate Limit Middleware', () => {
  const ipAddress = '192.168.1.50';

  it('allows up to 15 requests and returns 429 on the 16th', async () => {
    // Make 15 successful requests
    for (let i = 0; i < 15; i++) {
      const req = makeMockRequest('/api/generate', ipAddress);
      const res = middleware(req);
      
      // If allowed, it returns NextResponse.next() or modifies headers
      if (res) {
        expect(res.status).not.toBe(429);
      }
    }

    // 16th request should fail
    const blockReq = makeMockRequest('/api/generate', ipAddress);
    const blockRes = middleware(blockReq);
    
    expect(blockRes).toBeDefined();
    expect(blockRes?.status).toBe(429);

    const json = await blockRes?.json();
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('RATE_LIMIT');
    expect(json.error.retryAfterSeconds).toBeDefined();
    expect(blockRes?.headers.get('Retry-After')).toBeDefined();
  });

  it('maintains separate rate limit buckets for separate routes', async () => {
    const testIp = '10.0.0.5';

    // Exhaust generate route bucket
    for (let i = 0; i < 15; i++) {
      middleware(makeMockRequest('/api/generate', testIp));
    }
    const genBlockRes = middleware(makeMockRequest('/api/generate', testIp));
    expect(genBlockRes?.status).toBe(429);

    // Analyze route for the SAME IP should still be allowed (separate bucket)
    const analyzeReq = makeMockRequest('/api/analyze-jd', testIp);
    const analyzeRes = middleware(analyzeReq);
    
    if (analyzeRes) {
      expect(analyzeRes.status).not.toBe(429);
    }
  });
});
