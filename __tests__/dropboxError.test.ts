import { toDropboxErrorMessage, toDropboxUploadErrorMessage } from '@/lib/utils/dropboxError';

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

describe('toDropboxUploadErrorMessage', () => {
  const body = (summary: string) => JSON.stringify({ error_summary: summary, error: {} });

  it('reuses the token wording for auth failures', () => {
    // This exact body is what a revoked token returns from files/upload.
    const raw = JSON.stringify({ error: { '.tag': 'invalid_access_token' }, error_summary: 'invalid_access_token/' });
    expect(toDropboxUploadErrorMessage(raw)).toMatch(/rejected this token/i);
  });

  it('explains a full Dropbox, whose code is nested under path/', () => {
    expect(toDropboxUploadErrorMessage(body('path/insufficient_space/..'))).toMatch(/Dropbox is full/i);
  });

  it('asks for a retry when Dropbox is busy', () => {
    expect(toDropboxUploadErrorMessage(body('too_many_write_operations/..'))).toMatch(/try saving again/i);
  });

  it('describes an unmapped code readably, never as raw JSON', () => {
    const message = toDropboxUploadErrorMessage(body('path/conflict/file/..'));
    expect(message).toBe("Dropbox couldn't save the file (conflict).");
    expect(message).not.toContain('{');
  });

  it('falls back to a plain message for a non-JSON or empty body', () => {
    expect(toDropboxUploadErrorMessage('<html>502 Bad Gateway</html>')).toMatch(/couldn't save the file/i);
    expect(toDropboxUploadErrorMessage('')).toMatch(/couldn't save the file/i);
    expect(toDropboxUploadErrorMessage('{}')).toMatch(/couldn't save the file/i);
  });
});
