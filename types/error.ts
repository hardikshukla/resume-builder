export interface ApiErrorResponse {
  success: false;
  error: {
    type: 'RATE_LIMIT' | 'TIMEOUT' | 'TOKEN_LIMIT' | 'VALIDATION_FAILED' | 'FATAL';
    message: string;
    retryAfterSeconds?: number;
  };
}

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
  
  let type: ApiErrorResponse['error']['type'] = 'FATAL';
  let retryAfterSeconds: number | undefined;

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
