/**
 * __tests__/integration/analyzeJd.test.ts
 * Tests for POST /api/analyze-jd endpoint validation and merge logic.
 *
 * Run: npx jest __tests__/integration/analyzeJd.test.ts
 */

import { NextRequest } from 'next/server';
import { POST } from '../../app/api/analyze-jd/route';

// ── Mock Anthropic Client Calls ────────────────────────────────────────────────
jest.mock('../../lib/llm/anthropic', () => ({
  callAnthropic: jest.fn(),
}));

import { callAnthropic } from '../../lib/llm/anthropic';
const mockCallAnthropic = callAnthropic as jest.MockedFunction<typeof callAnthropic>;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/analyze-jd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validAnalyzeBody = {
  jobDescription: 'We are seeking a senior engineer to join Google.',
  companyName: 'Google',
  anthropicKey: 'sk-ant-test-key',
};

const mockHaikuOutput = {
  seniority: 'Senior',
  companyName: 'Google',
  mustHaveSkills: ['React', 'TypeScript'],
  niceToHaveSkills: ['AWS', 'Next.js'],
  gapsDetected: ['No Kubernetes'],
};

describe('POST /api/analyze-jd', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-env-key';
  });

  it('returns 200 and matches JDExtractionResult schema on valid request', async () => {
    mockCallAnthropic.mockResolvedValueOnce(mockHaikuOutput);

    const res = await POST(makeRequest(validAnalyzeBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.seniority).toBe('Senior');
    expect(json.data.companyName).toBe('Google');
    expect(json.data.mustHaveSkills).toContain('React');
    expect(mockCallAnthropic).toHaveBeenCalledWith(
      'sk-ant-test-key',
      'analyze-jd',
      expect.objectContaining({
        jobDescription: validAnalyzeBody.jobDescription,
        companyName: 'Google',
      })
    );
  });

  it('returns 400 validation error if jobDescription is missing', async () => {
    const res = await POST(makeRequest({ companyName: 'Google' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
  });

  it('merges regex heuristics with LLM result if companyName is null in LLM result', async () => {
    // Regex should extract "Google" from the job description "to join Google."
    // We mock Haiku to return null companyName
    mockCallAnthropic.mockResolvedValueOnce({
      ...mockHaikuOutput,
      companyName: null,
    });

    const res = await POST(
      makeRequest({
        jobDescription: 'We are seeking a senior engineer to join Google.',
        anthropicKey: 'sk-key',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.companyName).toBe('Google'); // falls back to regex parser
  });

  it('returns 400 if Anthropic API key is absent both in payload and env', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await POST(makeRequest({ jobDescription: 'Text description' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('Anthropic API key is required');
  });

  it('catches callAnthropic failures and returns ApiErrorResponse', async () => {
    mockCallAnthropic.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    const res = await POST(makeRequest(validAnalyzeBody));
    const json = await res.json();

    expect(res.status).toBe(429); // rate limit maps to 429
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('RATE_LIMIT');
  });
});
