import {
  describeKeyCheckFailure,
  REJECTED_KEY_MESSAGE,
  UNREACHABLE_KEY_MESSAGE,
} from '@/lib/utils/keyCheckError';

describe('describeKeyCheckFailure', () => {
  it('blames the key only when Anthropic rejected it', () => {
    expect(describeKeyCheckFailure({ upstreamStatus: 401 })).toBe(REJECTED_KEY_MESSAGE);
    expect(describeKeyCheckFailure({ upstreamStatus: 403 })).toBe(REJECTED_KEY_MESSAGE);
  });

  it('does not blame the key for a rate limit or an outage', () => {
    // A working key that is merely throttled must not be reported as invalid —
    // users revoke good keys over that message.
    expect(describeKeyCheckFailure({ upstreamStatus: 429 })).toBe(UNREACHABLE_KEY_MESSAGE);
    expect(describeKeyCheckFailure({ upstreamStatus: 529 })).toBe(UNREACHABLE_KEY_MESSAGE);
    expect(describeKeyCheckFailure({ upstreamStatus: 500 })).toBe(UNREACHABLE_KEY_MESSAGE);
  });

  it('stays non-committal when the request never reached Anthropic', () => {
    expect(describeKeyCheckFailure({ success: false })).toBe(UNREACHABLE_KEY_MESSAGE);
    expect(describeKeyCheckFailure(null)).toBe(UNREACHABLE_KEY_MESSAGE);
    expect(describeKeyCheckFailure(undefined)).toBe(UNREACHABLE_KEY_MESSAGE);
  });
});
