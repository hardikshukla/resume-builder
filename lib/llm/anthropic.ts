import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, REFINE_SYSTEM_PROMPT, JD_EXTRACTION_SYSTEM_PROMPT } from '@/lib/prompt';
import { ResumeBuilderOutputSchema, RefineOutputSchema, JDExtractionResultSchema } from '@/lib/llm/schema';
import { Recommendation } from '@/types';
import { ANTHROPIC_DEFAULT_MODEL, MODEL_FALLBACKS, MODEL_IDS } from '@/lib/constants';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? ANTHROPIC_DEFAULT_MODEL;

const PLACEHOLDER_RE = /\[PLACEHOLDER[:\s]/i;

/**
 * Output budget per request. Models with adaptive thinking on by default
 * (Sonnet 5, Opus 5) spend part of this on thinking before writing the JSON,
 * so it is sized well above the ~3-6K tokens a tailored resume needs.
 */
const MAX_OUTPUT_TOKENS = 16_000;

/**
 * Pulls the human-readable message out of an SDK API error.
 *
 * The SDK keeps the raw response body on `err.error`
 * ({ type: 'error', error: { type, message } }) and sets `err.message` to
 * "<status> <body as JSON>". Matching against `err.message` is unreliable:
 * every 400 body contains "invalid_request_error", for example.
 */
function apiErrorDetail(err: InstanceType<typeof Anthropic.APIError>): string {
  const body = err.error as { error?: { message?: unknown } } | undefined;
  const detail = body?.error?.message;
  return typeof detail === 'string' ? detail : err.message;
}

/**
 * True only when the API rejected the request because of the model itself
 * (unknown, retired, or not available to this key). Other 400s — a malformed
 * request, an oversized input — are real errors and must not be masked by
 * silently retrying on a different model.
 */
function isUnsupportedModelError(err: unknown): boolean {
  if (err instanceof Anthropic.NotFoundError) {
    // A 404 from the Messages endpoint names the missing model ("model: <id>").
    return /\bmodel\b/i.test(apiErrorDetail(err));
  }
  if (err instanceof Anthropic.BadRequestError) {
    const detail = apiErrorDetail(err);
    return /\bmodel\b/i.test(detail)
      && /not found|not supported|unsupported|does not exist|not available|invalid model/i.test(detail);
  }
  return false;
}

/**
 * The model to retry with after an unsupported-model error: Haiku for the
 * extraction task (or when Haiku was requested), Sonnet for everything else.
 */
function fallbackModelFor(mode: 'generate' | 'refine' | 'analyze-jd', model: string): string {
  return mode === 'analyze-jd' || model.includes('haiku') ? MODEL_IDS.haiku : MODEL_IDS.sonnet;
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
 * Extract the outermost JSON object from a string that may contain
 * markdown fences, prose preamble, or trailing commentary.
 * Returns null if no balanced {} block is found.
 */
function extractJSON(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return raw.slice(start, end + 1);
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
  let messagesContent: Anthropic.TextBlockParam[] = [];

  if (mode === 'analyze-jd') {
    if (!payload.jobDescription) {
      throw new Error('Job Description is required for analyze-jd mode');
    }
    systemPrompt = JD_EXTRACTION_SYSTEM_PROMPT;
    messagesContent = [
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}${payload.companyName ? `\n\nCANDIDATE IS APPLYING TO: ${payload.companyName}` : ''}`,
      },
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
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}\n${payload.companyName ? `COMPANY NAME: ${payload.companyName}\n` : ''}`,
      },
    ];

    if (payload.jdKeywords) {
      messagesContent.push({
        type: 'text',
        text: `<jd_keywords>\n${JSON.stringify(payload.jdKeywords, null, 2)}\n</jd_keywords>`,
      });
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
      },
      {
        type: 'text',
        text: `SELECTED IMPROVEMENTS TO APPLY:\n${recList}`,
      },
    ];
  }

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } },
  ];

  /**
   * One Messages API call with transient-error retries. Prompt caching is GA,
   * so the cache_control markers above work on the standard endpoint without
   * a beta header.
   */
  const createMessage = (modelId: string) =>
    withRetry(() =>
      client.messages.create({
        model: modelId,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemBlocks,
        messages: [{ role: 'user', content: messagesContent }],
      })
    );

  const MAX_PARSE_ATTEMPTS = 3;
  let lastParseError: Error | undefined;

  for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS; attempt++) {
    let response: Anthropic.Message;
    try {
      response = await createMessage(model);
    } catch (err) {
      const fallbackModel = fallbackModelFor(mode, model);
      // Retry once on a known-good model, but never on the model that just failed.
      if (isUnsupportedModelError(err) && fallbackModel !== model) {
        console.warn(`[callAnthropic] Model "${model}" is unsupported. Falling back to "${fallbackModel}"...`);
        // Stay on the fallback for any later parse attempts too, instead of
        // paying for the same unsupported-model error on every retry.
        model = fallbackModel;
        response = await createMessage(model);
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

    // Log cache stats to the server console, to confirm prompt caching is hitting.
    if (response.usage) {
      console.log(
        `[Cache] write: ${response.usage.cache_creation_input_tokens ?? 0} | read: ${response.usage.cache_read_input_tokens ?? 0}`
      );
    }

    if (response.stop_reason === 'max_tokens') {
      throw new Error('Response was cut off due to token limits. Try shortening input.');
    }

    // A refusal is a deliberate decision, not a formatting glitch — retrying
    // the same request would only be declined again.
    if (response.stop_reason === 'refusal') {
      throw new Error('Claude declined to process this request. Review the resume and job description text, then try again.');
    }

    // Thinking models put a `thinking` block before the answer, so the JSON is
    // in the first *text* block rather than necessarily the first block.
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    if (!textBlock) {
      throw new Error('Anthropic returned no text content');
    }

    // ── JSON extraction ────────────────────────────────────────────────────────
    const raw = textBlock.text.trim();
    const jsonStr = extractJSON(raw);

    if (!jsonStr) {
      console.warn(
        `[callAnthropic] Attempt ${attempt + 1}: no JSON object found. Snippet: ${raw.slice(0, 300)}`
      );
      lastParseError = new Error('Claude returned invalid JSON. Please try again.');
      continue; // retry
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn(
        `[callAnthropic] Attempt ${attempt + 1}: JSON.parse failed. Snippet: ${raw.slice(0, 300)}`
      );
      lastParseError = new Error('Claude returned invalid JSON. Please try again.');
      continue; // retry
    }

    // ── Schema validation ──────────────────────────────────────────────────────
    if (mode === 'generate') {
      const result = ResumeBuilderOutputSchema.safeParse(parsed);
      if (!result.success) {
        const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
        const msg = result.error.issues[0]?.message ?? 'schema mismatch';
        console.warn(`[callAnthropic] Attempt ${attempt + 1}: schema validation failed at "${field}": ${msg}`);
        lastParseError = new Error(`Claude response failed validation at "${field}": ${msg}. Try again.`);
        continue; // retry
      }
      parsed = result.data;
    } else if (mode === 'refine') {
      const result = RefineOutputSchema.safeParse(parsed);
      if (!result.success) {
        const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
        const msg = result.error.issues[0]?.message ?? 'schema mismatch';
        console.warn(`[callAnthropic] Attempt ${attempt + 1}: refine schema validation failed at "${field}": ${msg}`);
        lastParseError = new Error(`Claude refine response failed validation at "${field}": ${msg}. Try again.`);
        continue; // retry
      }
      parsed = result.data;
    } else if (mode === 'analyze-jd') {
      const result = JDExtractionResultSchema.safeParse(parsed);
      if (!result.success) {
        const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
        const msg = result.error.issues[0]?.message ?? 'schema mismatch';
        console.warn(`[callAnthropic] Attempt ${attempt + 1}: analyze-jd schema validation failed at "${field}": ${msg}`);
        lastParseError = new Error(`Claude analyze-jd response failed validation at "${field}": ${msg}. Try again.`);
        continue; // retry
      }
      parsed = result.data;
    }

    // All good — guard for placeholders and return
    guardOutput(parsed);
    return parsed;
  }

  // All attempts exhausted
  throw lastParseError ?? new Error('Claude returned invalid JSON after multiple attempts. Please try again.');
}
