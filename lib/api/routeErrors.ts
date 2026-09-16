/**
 * routeErrors.ts — shared error responses for the API route handlers.
 *
 * Server-only (imports Sentry's server SDK and next/server).
 */
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { ApiErrorType, apiError, statusForErrorType, toApiErrorResponse } from '@/types/error';

/**
 * Error types that mean the app or Claude misbehaved, and are worth an alert.
 * The rest are expected in normal use — a mistyped key, a rate limit, an
 * oversized resume — and would only be noise in Sentry.
 */
const REPORTED_TYPES: ReadonlySet<ApiErrorType> = new Set<ApiErrorType>(['FATAL', 'TIMEOUT', 'VALIDATION_FAILED']);

export function shouldReportToSentry(type: ApiErrorType): boolean {
  return REPORTED_TYPES.has(type);
}

/** A JSON error response with the status that matches its type. */
export function errorResponse(type: ApiErrorType, message: string): NextResponse {
  return NextResponse.json(apiError(type, message), { status: statusForErrorType(type) });
}

/** The response every Anthropic-backed route returns when no key is available. */
export function missingApiKeyResponse(): NextResponse {
  return errorResponse(
    'VALIDATION_FAILED',
    'Anthropic API key is required. Please set ANTHROPIC_API_KEY or supply it in the UI.'
  );
}

/**
 * Turns an error thrown inside a route into a typed JSON response, logging it
 * and reporting it to Sentry when it signals a real problem.
 *
 * @param route  Short route name for logs and Sentry tags, e.g. "generate".
 */
export function handleRouteError(err: unknown, route: string): NextResponse {
  console.error(`[API /${route}] Error:`, err);
  const body = toApiErrorResponse(err);

  if (shouldReportToSentry(body.error.type)) {
    Sentry.withScope((scope) => {
      scope.setTag('route', route);
      scope.setTag('api_error_type', body.error.type);
      scope.setExtra('apiError', err instanceof Error ? err.message : String(err));
      Sentry.captureException(err);
    });
  }

  return NextResponse.json(body, { status: statusForErrorType(body.error.type) });
}
