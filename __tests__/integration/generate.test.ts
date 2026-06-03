/**
 * __tests__/integration/generate.test.ts
 * Integration tests for POST /api/generate route handler.
 *
 * Tests verify:
 *  - Response contract shape (ApiErrorResponse on failure, { success, data } on success)
 *  - Correct HTTP status codes for different error types
 *  - Validation rejection for bad request payloads
 *
 * Run: npx jest __tests__/integration/generate.test.ts
 */

import { NextRequest } from 'next/server';
import { POST } from '../../app/api/generate/route';

// ── Mock LLM so we never hit Anthropic in tests ───────────────────────────────

jest.mock('../../lib/llm', () => ({
  runLLM: jest.fn(),
}));

import { runLLM } from '../../lib/llm';
const mockRunLLM = runLLM as jest.MockedFunction<typeof runLLM>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validGenerateBody = {
  mode: 'generate',
  resume: 'My resume with 10+ years of experience in software engineering.',
  jobDescription: 'We are looking for a senior software engineer.',
  anthropicKey: 'sk-ant-test-key',
};

const minimalOutput = {
  gapAnalysis: {
    matchScore: 78,
    strongMatches: ['Python'],
    gaps: [],
    dealbreakers: [],
    recommendations: [],
    keywordsAdded: [],
    missingKeywords: [],
    summaryChanges: 'None.',
    extractedCompanyName: null,
  },
  resume: {
    name: 'Jane Doe',
    contact: { email: 'jane@example.com', phone: null, linkedin: null, github: null, location: null },
    summary: 'Engineer.',
    skills: [],
    experience: [],
    projects: [],
    education: [],
  },
};

beforeEach(() => {
  mockRunLLM.mockReset();
});

// ── Success response shape ────────────────────────────────────────────────────

describe('POST /api/generate — success', () => {
  it('returns { success: true, data: ... } on valid request', async () => {
    mockRunLLM.mockResolvedValueOnce(minimalOutput);

    const res = await POST(makeRequest(validGenerateBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.gapAnalysis.matchScore).toBe(78);
  });
});

// ── Validation failure — 400 ──────────────────────────────────────────────────

describe('POST /api/generate — validation errors (400)', () => {
  it('returns 400 with ApiErrorResponse when mode is missing', async () => {
    const res = await POST(makeRequest({ resume: 'text', jobDescription: 'jd' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
    expect(typeof json.error.type).toBe('string');
    expect(typeof json.error.message).toBe('string');
  });

  it('returns 400 when resume is empty', async () => {
    const res = await POST(makeRequest({ ...validGenerateBody, resume: '' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when jobDescription is missing', async () => {
    const res = await POST(makeRequest({ mode: 'generate', resume: 'text', anthropicKey: 'sk-ant-key' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when API key is absent and no server key is set', async () => {
    // Ensure no env key
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await POST(makeRequest({ ...validGenerateBody, anthropicKey: undefined }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');

    // Restore
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
  });
});

// ── LLM error → typed API error ──────────────────────────────────────────────

describe('POST /api/generate — LLM errors map to correct HTTP codes', () => {
  it('returns 504 for timeout errors', async () => {
    mockRunLLM.mockRejectedValueOnce(new Error('Request timeout'));

    const res = await POST(makeRequest(validGenerateBody));
    const json = await res.json();

    expect(res.status).toBe(504);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('TIMEOUT');
  });

  it('returns 500 for unknown fatal errors', async () => {
    mockRunLLM.mockRejectedValueOnce(new Error('Unexpected internal error'));

    const res = await POST(makeRequest(validGenerateBody));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('FATAL');
  });

  it('returns 400 for token limit errors', async () => {
    mockRunLLM.mockRejectedValueOnce(new Error('Response was cut off due to token limits.'));

    const res = await POST(makeRequest(validGenerateBody));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('TOKEN_LIMIT');
  });

  it('returns 400 for validation / JSON errors', async () => {
    mockRunLLM.mockRejectedValueOnce(new Error('Claude returned invalid JSON. Please try again.'));

    const res = await POST(makeRequest(validGenerateBody));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
  });
});
