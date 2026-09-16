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
          token: 'sl.B5678',
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

  it('redacts a JSON-string body, which is how the server SDK attaches it', () => {
    // Regression: string bodies used to pass through untouched, so a failed
    // /api/generate request sent the API key and resume to Sentry verbatim.
    const body = JSON.stringify({
      mode: 'generate',
      resume: 'Jane Doe resume',
      jobDescription: 'Engineer role',
      anthropicKey: 'sk-ant-1234',
    });
    const result = scrubEvent({ request: { data: body } });

    const scrubbed = JSON.parse(result.request.data as string);
    expect(scrubbed).toEqual({
      mode: 'generate',
      resume: REDACTED_PLACEHOLDER,
      jobDescription: REDACTED_PLACEHOLDER,
      anthropicKey: REDACTED_PLACEHOLDER,
    });
  });

  it('drops a string body it cannot parse, rather than sending it', () => {
    const result = scrubEvent({ request: { data: 'token=sl.B1234&resume=Jane' } });
    expect(result.request.data).toBe(REDACTED_PLACEHOLDER);
  });

  it('drops a JSON body that is not an object', () => {
    expect(scrubEvent({ request: { data: '"sk-ant-1234"' } }).request.data).toBe(REDACTED_PLACEHOLDER);
  });

  it('does not throw when request data is missing', () => {
    expect(() => scrubEvent({})).not.toThrow();
    expect(() => scrubEvent({ request: {} })).not.toThrow();
  });

  it.each(['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts'])(
    '%s uses the shared scrubber',
    (file) => {
      const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(source).toContain("from '@/lib/sentry/scrubEvent'");
      expect(source).toMatch(/beforeSend:\s*scrubEvent/);
    }
  );
});

describe('Sentry wiring', () => {
  const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

  it('next.config.mjs wraps the config in withSentryConfig, which activates every Sentry config', () => {
    const config = read('next.config.mjs');
    expect(config).toMatch(/export default withSentryConfig\(nextConfig/);
    // Browser events tunnel through this app so the CSP can stay connect-src 'self'.
    expect(config).toMatch(/tunnelRoute:\s*'\/monitoring'/);
  });

  it.each(['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts'])(
    '%s reports errors only (no performance traces)',
    (file) => {
      expect(read(file)).toMatch(/tracesSampleRate:\s*0,/);
    }
  );

  it('instrumentation.ts loads the server and edge configs', () => {
    const source = read('instrumentation.ts');
    expect(source).toContain("import('./sentry.server.config')");
    expect(source).toContain("import('./sentry.edge.config')");
  });
});
