/**
 * __tests__/integration/models.test.ts
 * POST /api/models — lists the Claude models a key can use. The page relies on
 * this response both to fill the model picker and to validate the key.
 */
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/models/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Replaces global fetch with a single canned upstream response. */
function mockUpstream(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as jest.Mock;
}

describe('POST /api/models', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns only Claude models, as { id, name } picker options', async () => {
    mockUpstream(200, {
      data: [
        { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
        { id: 'claude-haiku-4-5' }, // no display_name: falls back to the id
        { id: 'some-other-model', display_name: 'Other' },
      ],
    });

    const res = await POST(makeRequest({ anthropicKey: 'sk-ant-test' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: true,
      models: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'claude-haiku-4-5', name: 'claude-haiku-4-5' },
      ],
    });
  });

  it('reports a rejected key as 401 with the upstream status', async () => {
    mockUpstream(401, { type: 'error', error: { type: 'authentication_error' } });

    const res = await POST(makeRequest({ anthropicKey: 'sk-ant-bad' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.upstreamStatus).toBe(401);
    expect(json.error.type).toBe('VALIDATION_FAILED');
  });

  it('reports an upstream outage as 502, not as a bad key', async () => {
    mockUpstream(529, { type: 'error', error: { type: 'overloaded_error' } });

    const res = await POST(makeRequest({ anthropicKey: 'sk-ant-test' }));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.upstreamStatus).toBe(529);
  });

  it('requires a key when the server has none configured', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
