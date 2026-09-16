/**
 * routeErrors.test.ts — error classification and the Sentry reporting policy
 * shared by the Anthropic-backed routes.
 */
import { NextRequest } from 'next/server';
import { toApiErrorResponse, statusForErrorType } from '@/types/error';
import { handleRouteError, shouldReportToSentry } from '@/lib/api/routeErrors';

// Record what would be sent to Sentry instead of sending it.
const mockCaptureException = jest.fn();
jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  withScope: (fn: (scope: object) => void) => fn({ setTag: jest.fn(), setExtra: jest.fn() }),
}));

// The routes call Claude through these; each test decides what they throw.
jest.mock('@/lib/llm', () => ({ runLLM: jest.fn() }));
jest.mock('@/lib/llm/anthropic', () => ({ callAnthropic: jest.fn() }));
import { runLLM } from '@/lib/llm';
import { callAnthropic } from '@/lib/llm/anthropic';
import { POST as generate } from '@/app/api/generate/route';
import { POST as analyzeJd } from '@/app/api/analyze-jd/route';

/** An error shaped like the SDK's: numeric `status`, message embeds the raw body. */
function sdkError(status: number, body: object) {
  return Object.assign(new Error(`${status} ${JSON.stringify(body)}`), { status });
}
const AUTH_BODY = { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } };

const post = (url: string, body: object) =>
  new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  mockCaptureException.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('toApiErrorResponse — auth failures', () => {
  it('turns a 401 into AUTH_FAILED with a readable message', () => {
    const { error } = toApiErrorResponse(sdkError(401, AUTH_BODY));
    expect(error.type).toBe('AUTH_FAILED');
    expect(error.message).toMatch(/rejected this API key/i);
    // The raw JSON body must not reach the user.
    expect(error.message).not.toContain('{');
  });

  it('turns a 403 into AUTH_FAILED', () => {
    expect(toApiErrorResponse(sdkError(403, { type: 'error' })).error.type).toBe('AUTH_FAILED');
  });

  it('returns AUTH_FAILED with HTTP 401', () => {
    expect(statusForErrorType('AUTH_FAILED')).toBe(401);
  });

  it('leaves other classifications unchanged', () => {
    expect(toApiErrorResponse(sdkError(429, {})).error.type).toBe('RATE_LIMIT');
    expect(toApiErrorResponse(new Error('Something odd')).error.type).toBe('FATAL');
  });
});

describe('shouldReportToSentry', () => {
  it.each(['FATAL', 'TIMEOUT', 'VALIDATION_FAILED'] as const)('reports %s', (type) => {
    expect(shouldReportToSentry(type)).toBe(true);
  });

  it.each(['AUTH_FAILED', 'RATE_LIMIT', 'TOKEN_LIMIT'] as const)('does not report %s (expected in normal use)', (type) => {
    expect(shouldReportToSentry(type)).toBe(false);
  });
});

describe('handleRouteError', () => {
  it('reports an unexpected error and returns 500', async () => {
    const res = handleRouteError(new Error('boom'), 'test');
    expect(res.status).toBe(500);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it('does not report a rejected key, and returns 401', async () => {
    const res = handleRouteError(sdkError(401, AUTH_BODY), 'test');
    expect(res.status).toBe(401);
    expect((await res.json()).error.type).toBe('AUTH_FAILED');
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});

describe('routes use the shared policy', () => {
  const generateBody = { mode: 'generate', resume: 'Resume text', jobDescription: 'JD text', anthropicKey: 'sk-ant-x' };
  const analyzeBody = { jobDescription: 'JD text', anthropicKey: 'sk-ant-x' };

  it('/api/generate returns 401 for a bad key without alerting Sentry', async () => {
    (runLLM as jest.Mock).mockRejectedValueOnce(sdkError(401, AUTH_BODY));
    const res = await generate(post('http://localhost/api/generate', generateBody));
    expect(res.status).toBe(401);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('/api/analyze-jd now reports unexpected failures to Sentry', async () => {
    (callAnthropic as jest.Mock).mockRejectedValueOnce(new Error('Unexpected internal error'));
    const res = await analyzeJd(post('http://localhost/api/analyze-jd', analyzeBody));
    expect(res.status).toBe(500);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it('/api/analyze-jd does not report a bad key', async () => {
    (callAnthropic as jest.Mock).mockRejectedValueOnce(sdkError(401, AUTH_BODY));
    const res = await analyzeJd(post('http://localhost/api/analyze-jd', analyzeBody));
    expect(res.status).toBe(401);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
