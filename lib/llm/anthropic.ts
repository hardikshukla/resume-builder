import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, REFINE_SYSTEM_PROMPT, buildJDExtractionPrompt } from '@/lib/prompt';
import { ResumeBuilderOutputSchema, RefineOutputSchema, JDExtractionResultSchema } from '@/lib/llm/schema';
import { Recommendation } from '@/types';
import { ANTHROPIC_DEFAULT_MODEL, MODEL_FALLBACKS } from '@/lib/constants';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? ANTHROPIC_DEFAULT_MODEL;

const PLACEHOLDER_RE = /\[PLACEHOLDER[:\s]/i;

/** Check if error represents an unsupported model name. */
function isUnsupportedModelError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    const isModelError = err.status === 400 || err.status === 404;
    const msg = err.message.toLowerCase();
    return isModelError && (
      msg.includes('model') ||
      msg.includes('not found') ||
      msg.includes('unsupported') ||
      msg.includes('permission') ||
      msg.includes('invalid_request_error')
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

/** HTTP status codes that are safe to retry. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 529 || status >= 500;
}

/** Network-level error messages that are safe to retry. */
function isRetryableNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('socket hang up')
  );
}

/**
 * Wraps an async function with up to 3 attempts (1 initial + 2 retries).
 * Back-off: 2^attempt * 500 ms (attempt 0 = 0 ms, attempt 1 = 1000 ms, attempt 2 = 2000 ms).
 * Respects the Retry-After header (capped at 8 s) when present on 429 responses.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // ---- Determine whether this error is retryable ----------------------
      let retryable = false;
      let retryAfterMs: number | undefined;

      if (err instanceof Anthropic.APIError) {
        if (isRetryableStatus(err.status)) {
          retryable = true;
          // Honour the Retry-After header when present on 429 responses
          const headers = err.headers as Record<string, string> | undefined;
          const retryAfterHeader = headers?.['retry-after'];
          if (retryAfterHeader) {
            const seconds = parseFloat(retryAfterHeader);
            if (!isNaN(seconds)) {
              retryAfterMs = Math.min(seconds * 1000, 8000);
            }
          }
        }
        // 4xx client errors (400, 401, 403, etc.) are deterministic — do not retry
      } else if (err instanceof Anthropic.APIConnectionError) {
        retryable = true;
      } else if (err instanceof Error && isRetryableNetworkError(err.message)) {
        retryable = true;
      }

      if (!retryable || attempt === MAX_ATTEMPTS - 1) {
        throw err;
      }

      // ---- Compute wait time and log --------------------------------------
      const waitMs = retryAfterMs ?? Math.pow(2, attempt) * 500;
      console.warn(
        `[withRetry] Attempt ${attempt + 1} failed — retrying in ${waitMs} ms...`,
        err instanceof Error ? err.message : String(err)
      );
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
  }

  // Unreachable, but TypeScript requires a definite return or throw here.
  throw lastError;
}

export function guardOutput(output: unknown, path = 'root'): void {
  if (typeof output === 'string') {
    if (PLACEHOLDER_RE.test(output)) {
      throw new Error(
        `LLM returned placeholder text at "${path}". ` +
        `This is a prompt compliance issue — please try again.`
      );
    }
    return;
  }

  if (Array.isArray(output)) {
    output.forEach((item, i) => guardOutput(item, `${path}[${i}]`));
    return;
  }

  if (output !== null && typeof output === 'object') {
    for (const [key, value] of Object.entries(output)) {
      guardOutput(value, `${path}.${key}`);
    }
  }
}

export async function callAnthropic(
  apiKey: string,
  mode: 'generate' | 'refine' | 'analyze-jd',
  payload: {
    resume?: string;
    jobDescription?: string;
    companyName?: string;
    currentOutput?: unknown;
    selectedRecommendations?: Recommendation[];
    modelOverride?: string;
    jdKeywords?: unknown;
  }
): Promise<unknown> {
  const client = new Anthropic({ apiKey });
  let model = payload.modelOverride || DEFAULT_MODEL;
  if (MODEL_FALLBACKS[model]) {
    model = MODEL_FALLBACKS[model];
  }

  let systemPrompt = '';
  let messagesContent: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];

  if (mode === 'analyze-jd') {
    if (!payload.jobDescription) {
      throw new Error('Job Description is required for analyze-jd mode');
    }
    systemPrompt = buildJDExtractionPrompt(payload.jobDescription, payload.companyName);
    messagesContent = [
      {
        type: 'text',
        text: `Please analyze the job description and extract the keywords, seniority, and company name as JSON: ${payload.jobDescription}`,
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
    ];
  } else if (mode === 'generate') {
    if (!payload.resume || !payload.jobDescription) {
      throw new Error('Resume and Job Description are required for generate mode');
    }
    systemPrompt = SYSTEM_PROMPT;
    messagesContent = [
      {
        type: 'text',
        text: `CANDIDATE RESUME:\n${payload.resume}`,
        cache_control: { type: 'ephemeral' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}\n${payload.companyName ? `COMPANY NAME: ${payload.companyName}\n` : ''}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam
    ];

    if (payload.jdKeywords) {
      messagesContent.push({
        type: 'text',
        text: `<jd_keywords>\n${JSON.stringify(payload.jdKeywords, null, 2)}\n</jd_keywords>`,
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam);
    }
  } else if (mode === 'refine') {
    if (!payload.currentOutput || !payload.selectedRecommendations) {
      throw new Error('currentOutput and selectedRecommendations are required for refine mode');
    }
    systemPrompt = REFINE_SYSTEM_PROMPT;
    const recList = payload.selectedRecommendations.map((r) =>
      `- Claim: ${r.claim}\n  Target Section: ${r.targetSection}\n  Evidence Required: ${r.evidenceRequired}\n  Evidence Found: ${r.evidenceFound}\n  Risk Level: ${r.riskLevel}`
    ).join('\n');
    messagesContent = [
      {
        type: 'text',
        text: `CURRENT RESUME AND COVER LETTER (JSON):\n${JSON.stringify(payload.currentOutput, null, 2)}`,
        cache_control: { type: 'ephemeral' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
      {
        type: 'text',
        text: `SELECTED IMPROVEMENTS TO APPLY:\n${recList}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam
    ];
  }

  const systemBlocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } } as unknown as Anthropic.Beta.Messages.BetaTextBlockParam
  ];

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await withRetry(() =>
      client.beta.messages.create({
        model,
        max_tokens: 8192,
        system: systemBlocks,
        messages: [{ role: 'user', content: messagesContent }],
        betas: ['prompt-caching-2024-07-31'],
      })
    );
  } catch (err) {
    if (isUnsupportedModelError(err)) {
      const fallbackModel = (mode === 'analyze-jd' || model.includes('haiku'))
        ? 'claude-haiku-4-5-20251001'
        : 'claude-3-5-sonnet-20241022';
      console.warn(`[callAnthropic] Model "${model}" is unsupported. Falling back to "${fallbackModel}"...`);
      try {
        response = await withRetry(() =>
          client.beta.messages.create({
            model: fallbackModel,
            max_tokens: 8192,
            system: systemBlocks,
            messages: [{ role: 'user', content: messagesContent }],
            betas: ['prompt-caching-2024-07-31'],
          })
        );
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('looping content') || msg.includes('loop detection')) {
        throw new Error(
          'Claude flagged the output as repetitive. Try reducing repeated phrasing, then generate again.'
        );
      }
      throw err;
    }
  }

  // Log cache stats to server console
  if (response.usage) {
    const usage = response.usage as unknown as { cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
    console.log(
      `[Cache] write: ${usage.cache_creation_input_tokens ?? 0} | read: ${usage.cache_read_input_tokens ?? 0}`
    );
  }

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Response was cut off due to token limits. Try shortening input.');
  }

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Anthropic returned non-text content');
  }

  const raw = content.text.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Claude returned invalid JSON. Please try again.');
  }

  if (mode === 'generate') {
    const result = ResumeBuilderOutputSchema.safeParse(parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Claude response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  } else if (mode === 'refine') {
    const result = RefineOutputSchema.safeParse(parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Claude refine response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  } else if (mode === 'analyze-jd') {
    const result = JDExtractionResultSchema.safeParse(parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Claude analyze-jd response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  }

  guardOutput(parsed);
  return parsed;
}
