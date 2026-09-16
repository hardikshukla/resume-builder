/**
 * anthropic.test.ts — callAnthropic() against a mocked Anthropic SDK.
 *
 * Covers the behaviour that depends on what the API actually returns:
 * which model is requested, when a failed request falls back to another model,
 * and how the JSON payload is located in the response.
 */
import Anthropic from '@anthropic-ai/sdk';
import { callAnthropic } from '@/lib/llm/anthropic';
import { MODEL_IDS } from '@/lib/constants';

// One shared mock for every messages.create call. The client is constructed
// inside callAnthropic, so the SDK class itself is replaced — while keeping its
// static error classes, which callAnthropic checks with instanceof.
const mockCreate = jest.fn();
// Separate mock for the beta namespace, so a test can assert it is never used.
const mockBetaCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk');
  class MockAnthropic extends actual.default {
    constructor(options: unknown) {
      super(options);
      Object.assign(this, { messages: { create: mockCreate }, beta: { messages: { create: mockBetaCreate } } });
    }
  }
  return { __esModule: true, ...actual, default: MockAnthropic };
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const JD_RESULT = {
  seniority: 'Senior',
  companyName: 'Acme',
  mustHaveSkills: ['React'],
  niceToHaveSkills: ['GraphQL'],
  gapsDetected: [],
};

/** A successful Messages API response whose text block holds `payload` as JSON. */
function textResponse(payload: unknown, extraBlocks: object[] = []) {
  return {
    content: [...extraBlocks, { type: 'text', text: JSON.stringify(payload) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

/**
 * Builds an SDK error shaped like a real API failure. The SDK stores the whole
 * response body on `error`, and its `message` is "<status> <body as JSON>".
 */
function apiError(status: 400 | 404, type: string, message: string) {
  const body = { type: 'error', error: { type, message } };
  return status === 404
    ? new Anthropic.NotFoundError(404, body, undefined, new Headers())
    : new Anthropic.BadRequestError(400, body, undefined, new Headers());
}

const analyzeJd = (modelOverride?: string) =>
  callAnthropic('sk-ant-test', 'analyze-jd', { jobDescription: 'Senior React role', modelOverride });

/** The `model` sent on the Nth messages.create call (0-based). */
const requestedModel = (call: number) => mockCreate.mock.calls[call][0].model;

beforeEach(() => {
  mockCreate.mockReset();
  mockBetaCreate.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Response parsing ─────────────────────────────────────────────────────────

describe('callAnthropic — response parsing', () => {
  it('returns the validated JSON from a text block', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JD_RESULT));
    await expect(analyzeJd()).resolves.toEqual(JD_RESULT);
  });

  it('reads the text block even when a thinking block comes first', async () => {
    // Models with adaptive thinking on by default (Sonnet 5, Opus 5) lead with a thinking block.
    mockCreate.mockResolvedValueOnce(
      textResponse(JD_RESULT, [{ type: 'thinking', thinking: '', signature: 'sig' }])
    );
    await expect(analyzeJd()).resolves.toEqual(JD_RESULT);
  });

  it('reports a refusal clearly instead of retrying it as bad JSON', async () => {
    mockCreate.mockResolvedValueOnce({ content: [], stop_reason: 'refusal', usage: {} });
    await expect(analyzeJd()).rejects.toThrow(/declined/i);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ── Model selection and fallback ─────────────────────────────────────────────

describe('callAnthropic — model selection', () => {
  it('maps a retired model id to its current replacement before calling', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JD_RESULT));
    await analyzeJd('claude-3-7-sonnet-20250219');
    expect(requestedModel(0)).toBe(MODEL_IDS.sonnet);
  });

  it('passes a current model id through unchanged', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JD_RESULT));
    await analyzeJd(MODEL_IDS.opus);
    expect(requestedModel(0)).toBe(MODEL_IDS.opus);
  });

  it('falls back once when the model is not found', async () => {
    mockCreate
      .mockRejectedValueOnce(apiError(404, 'not_found_error', 'model: claude-made-up'))
      .mockResolvedValueOnce(textResponse(JD_RESULT));

    await expect(analyzeJd('claude-made-up')).resolves.toEqual(JD_RESULT);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // analyze-jd is an extraction task, so it falls back to Haiku.
    expect(requestedModel(1)).toBe(MODEL_IDS.haiku);
  });

  it('does not treat an unrelated bad request as an unsupported model', async () => {
    // Every 400 body carries "invalid_request_error"; that alone must not trigger a model switch.
    mockCreate.mockRejectedValueOnce(
      apiError(400, 'invalid_request_error', 'messages.0.content: text content blocks must be non-empty')
    );

    await expect(analyzeJd(MODEL_IDS.sonnet)).rejects.toBeInstanceOf(Anthropic.BadRequestError);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('does not retry on the same model it just failed with', async () => {
    mockCreate.mockRejectedValueOnce(apiError(404, 'not_found_error', `model: ${MODEL_IDS.haiku}`));

    await expect(analyzeJd(MODEL_IDS.haiku)).rejects.toBeInstanceOf(Anthropic.NotFoundError);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('does not fall back on an authentication failure', async () => {
    const authError = new Anthropic.AuthenticationError(
      401,
      { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
      undefined,
      new Headers()
    );
    mockCreate.mockRejectedValueOnce(authError);

    await expect(analyzeJd()).rejects.toBe(authError);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
  it('stays on the fallback model when a later attempt has to be retried', async () => {
    mockCreate
      .mockRejectedValueOnce(apiError(404, 'not_found_error', 'model: claude-made-up'))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json' }], stop_reason: 'end_turn', usage: {} })
      .mockResolvedValueOnce(textResponse(JD_RESULT));

    await expect(analyzeJd('claude-made-up')).resolves.toEqual(JD_RESULT);
    // 404 on the requested model, then two attempts that both use the fallback.
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(requestedModel(2)).toBe(MODEL_IDS.haiku);
  });
});

// ── Request shape ────────────────────────────────────────────────────────────

describe('callAnthropic — request shape', () => {
  it('uses the GA Messages endpoint with prompt caching and no beta header', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JD_RESULT));
    await analyzeJd();

    expect(mockBetaCreate).not.toHaveBeenCalled();
    const params = mockCreate.mock.calls[0][0];
    expect(params).not.toHaveProperty('betas');
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(params.max_tokens).toBe(16_000);
  });
});
