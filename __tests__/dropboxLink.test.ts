/**
 * dropboxLink.test.ts — DROPBOX_APP_CONSOLE_URL resolution.
 *
 * The console link must stay account-neutral: every visitor needs their own
 * Dropbox app, so the URL must never carry a build-time app key.
 */

describe('DROPBOX_APP_CONSOLE_URL', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('points at the Dropbox app list', () => {
    const { DROPBOX_APP_CONSOLE_URL } = require('@/lib/constants');
    expect(DROPBOX_APP_CONSOLE_URL).toBe('https://www.dropbox.com/developers/apps');
  });

  it('is not personalised by any build-time app key', () => {
    process.env.NEXT_PUBLIC_DROPBOX_APP_KEY = 'abc123key';
    const { DROPBOX_APP_CONSOLE_URL } = require('@/lib/constants');
    expect(DROPBOX_APP_CONSOLE_URL).not.toContain('abc123key');
    expect(DROPBOX_APP_CONSOLE_URL).toBe('https://www.dropbox.com/developers/apps');
  });

  it('is an https dropbox.com developers URL', () => {
    const { DROPBOX_APP_CONSOLE_URL } = require('@/lib/constants');
    const url = new URL(DROPBOX_APP_CONSOLE_URL);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('www.dropbox.com');
    expect(url.search).toBe('');
    expect(url.pathname).toBe('/developers/apps');
  });
});
