import { toDropboxErrorMessage } from '@/lib/utils/dropboxError';

describe('toDropboxErrorMessage', () => {
  it('explains an expired token', () => {
    expect(toDropboxErrorMessage('expired_access_token/...')).toMatch(/expired/i);
  });

  it('explains a rejected token', () => {
    expect(toDropboxErrorMessage('invalid_access_token/')).toMatch(/rejected this token/i);
  });

  it('points a missing scope back at the permissions step', () => {
    expect(toDropboxErrorMessage('missing_scope/.')).toMatch(/missing a permission/i);
  });

  it('never leaks the raw summary verbatim', () => {
    expect(toDropboxErrorMessage('invalid_access_token/')).not.toContain('invalid_access_token');
  });

  it('degrades readably for an unmapped code', () => {
    expect(toDropboxErrorMessage('some_new_code/detail')).toBe('Dropbox rejected this token (some new code).');
  });

  it('handles a missing or non-string summary', () => {
    expect(toDropboxErrorMessage(undefined)).toBe('Dropbox rejected this token.');
    expect(toDropboxErrorMessage('   ')).toBe('Dropbox rejected this token.');
    expect(toDropboxErrorMessage({ nope: true })).toBe('Dropbox rejected this token.');
  });
});
