/**
 * appVersion.test.ts — the header badge's version source.
 */
import { readFileSync } from 'fs';
import path from 'path';

describe('APP_VERSION', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('reads the build-time injected version', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '9.8.7';
    const { APP_VERSION } = await import('@/lib/constants');
    expect(APP_VERSION).toBe('9.8.7');
  });

  it('is empty when nothing was injected, so the badge is hidden rather than showing "v"', async () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const { APP_VERSION } = await import('@/lib/constants');
    expect(APP_VERSION).toBe('');
  });

  it('next.config.mjs injects package.json’s version, not a hand-set value', () => {
    const config = readFileSync(path.join(__dirname, '..', 'next.config.mjs'), 'utf8');
    expect(config).toMatch(/readFileSync\(new URL\('\.\/package\.json'/);
    expect(config).toMatch(/NEXT_PUBLIC_APP_VERSION:\s*version/);
  });
});
