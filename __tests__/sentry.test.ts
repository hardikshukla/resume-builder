/**
 * sentry.test.ts — the real Sentry `beforeSend` scrubber.
 *
 * This previously exercised a copy of the scrubber pasted into the test, which
 * had already drifted from the configs (it did not redact resume or JD text).
 * It now imports the shared implementation every Sentry config uses.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { scrubEvent, REDACTED_FIELDS, REDACTED_PLACEHOLDER } from '@/lib/sentry/scrubEvent';

describe('scrubEvent', () => {
  it('redacts every sensitive request-body field', () => {
    const event = {
      request: {
        data: {
          anthropicKey: 'sk-ant-1234',
          dropboxToken: 'sl.B1234',
          resume: 'Jane Doe, engineer',
          jobDescription: 'Senior engineer role',
          otherData: 'safe',
        },
      },
    };

    const result = scrubEvent(event);

    for (const field of REDACTED_FIELDS) {
      expect(result.request.data[field]).toBe(REDACTED_PLACEHOLDER);
    }
    expect(result.request.data.otherData).toBe('safe');
  });

  it('returns the same event object, as beforeSend requires', () => {
    const event = { request: { data: { anthropicKey: 'sk-ant-1234' } } };
    expect(scrubEvent(event)).toBe(event);
  });

  it('leaves empty values untouched', () => {
    const event = { request: { data: { anthropicKey: '', resume: 'text' } } };
    const result = scrubEvent(event);
    expect(result.request.data.anthropicKey).toBe('');
    expect(result.request.data.resume).toBe(REDACTED_PLACEHOLDER);
  });

  it('does not throw when request data is missing or not an object', () => {
    expect(() => scrubEvent({})).not.toThrow();
    expect(() => scrubEvent({ request: {} })).not.toThrow();
    expect(scrubEvent({ request: { data: 'raw body' } }).request.data).toBe('raw body');
  });

  it.each(['sentry.client.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts'])(
    '%s uses the shared scrubber',
    (file) => {
      const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(source).toContain("from '@/lib/sentry/scrubEvent'");
      expect(source).toMatch(/beforeSend:\s*scrubEvent/);
    }
  );
});
