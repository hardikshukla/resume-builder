/**
 * Turns a failed `/api/models` response into something a user can act on.
 *
 * The route reports the upstream HTTP status because "Anthropic rejected your
 * key" and "Anthropic is rate-limiting or down" need opposite reactions: one
 * means generate a new key, the other means wait. Telling a user their working
 * key was rejected sends them off to revoke it for nothing.
 */
export const REJECTED_KEY_MESSAGE = 'This key was rejected by Anthropic';
export const UNREACHABLE_KEY_MESSAGE = "Couldn't reach Anthropic to check this key — try again in a moment";

export function describeKeyCheckFailure(data: unknown): string {
  const status = (data as { upstreamStatus?: unknown } | null)?.upstreamStatus;
  if (status === 401 || status === 403) return REJECTED_KEY_MESSAGE;
  if (typeof status === 'number') return UNREACHABLE_KEY_MESSAGE;

  // No upstream status at all: the request never reached Anthropic (our own
  // server errored, or the body wasn't the shape we expect). That says nothing
  // about the key, so don't accuse it.
  return UNREACHABLE_KEY_MESSAGE;
}
