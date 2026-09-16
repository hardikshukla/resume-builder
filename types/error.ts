/**
 * Every API error type the client can receive.
 * - AUTH_FAILED: Anthropic rejected the API key (401) or its access (403).
 * - RATE_LIMIT: our middleware or Anthropic throttled the request.
 * - TIMEOUT: Anthropic was slow, overloaded, or unreachable.
 * - TOKEN_LIMIT: the input or output did not fit.
 * - VALIDATION_FAILED: a bad request, or Claude returned unusable output.
 * - FATAL: anything unexpected.
 */
export type ApiErrorType =
  | 'AUTH_FAILED'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'TOKEN_LIMIT'
  | 'VALIDATION_FAILED'
  | 'FATAL';

export interface ApiErrorResponse {
  success: false;
  error: {
    type: ApiErrorType;
    message: string;
    retryAfterSeconds?: number;
  };
}

/** HTTP status each error type is returned with. */
const STATUS_BY_TYPE: Record<ApiErrorType, number> = {
  AUTH_FAILED: 401,
  RATE_LIMIT: 429,
  TIMEOUT: 504,
  TOKEN_LIMIT: 400,
  VALIDATION_FAILED: 400,
  FATAL: 500,
};

export function statusForErrorType(type: ApiErrorType): number {
  return STATUS_BY_TYPE[type];
}

/** Builds the JSON body for an error the route detected itself. */
export function apiError(type: ApiErrorType, message: string): ApiErrorResponse {
  return { success: false, error: { type, message } };
}

/** Plain-language messages for Anthropic auth failures (the raw body is JSON jargon). */
const AUTH_MESSAGES: Record<401 | 403, string> = {
  401: 'Anthropic rejected this API key. Check the key in the panel and try again.',
  403: "This API key isn't allowed to make this request. Check that it has access to the selected model.",
};

/**
 * The fields toApiErrorResponse reads off an unknown thrown value. SDK errors
 * (e.g. Anthropic.APIError) carry `status` and `headers`; some HTTP clients use
 * `statusCode` instead. Everything is optional because `err` can be anything.
 */
interface ErrorLike {
  status?: unknown;
  statusCode?: unknown;
  headers?: Record<string, string | undefined>;
}

export function toApiErrorResponse(err: unknown): ApiErrorResponse {
  const message = err instanceof Error ? err.message : String(err);

  // Only objects can carry these fields; primitives (a thrown string) cannot.
  const errorLike: ErrorLike = typeof err === 'object' && err !== null ? (err as ErrorLike) : {};
  const status = errorLike.status || errorLike.statusCode;
  
  let type: ApiErrorType = 'FATAL';
  let retryAfterSeconds: number | undefined;

  // Auth failures are decided by status alone and get a readable message.
  if (status === 401 || status === 403) {
    return apiError('AUTH_FAILED', AUTH_MESSAGES[status]);
  }

  if (status === 429 || message.toLowerCase().includes('rate limit') || message.includes('429')) {
    type = 'RATE_LIMIT';
    // If there's a retry header or we can parse it from headers
    const retryHeader = errorLike.headers?.['retry-after'];
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!isNaN(parsed)) {
        retryAfterSeconds = parsed;
      }
    }
  } else if (
    status === 408 ||
    status === 504 ||
    status === 524 ||
    status === 529 ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('overloaded') ||
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('econnreset')
  ) {
    type = 'TIMEOUT';
  } else if (
    message.toLowerCase().includes('token limit') ||
    message.toLowerCase().includes('cut off due to token limits') ||
    message.toLowerCase().includes('too long')
  ) {
    type = 'TOKEN_LIMIT';
  } else if (
    message.toLowerCase().includes('validation') ||
    message.toLowerCase().includes('json') ||
    message.toLowerCase().includes('schema') ||
    message.toLowerCase().includes('placeholder') ||
    message.toLowerCase().includes('repetitive') ||
    message.toLowerCase().includes('loop')
  ) {
    type = 'VALIDATION_FAILED';
  }

  return {
    success: false,
    error: {
      type,
      message,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    },
  };
}
