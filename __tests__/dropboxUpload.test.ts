import { dropboxExportPath, uploadToDropbox } from '@/lib/dropbox/upload';

describe('dropboxExportPath', () => {
  it('files exports under a folder per company', () => {
    expect(dropboxExportPath('Acme Inc.', 'Jane_Acme_Resume.docx')).toBe('/resumeBuilder/Acme_Inc_/Jane_Acme_Resume.docx');
  });

  it('uses a default folder when there is no company', () => {
    expect(dropboxExportPath('', 'Jane_Resume.docx')).toBe('/resumeBuilder/Tailored/Jane_Resume.docx');
  });

  it('keeps path separators out of the folder name', () => {
    expect(dropboxExportPath('../../etc', 'f.docx')).toBe('/resumeBuilder/______etc/f.docx');
  });
});

describe('uploadToDropbox', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('sends the file with the trimmed token and overwrite settings', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;
    const file = new Blob(['docx']);
    await uploadToDropbox('  sl.token  ', '/resumeBuilder/Acme/f.docx', file);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://content.dropboxapi.com/2/files/upload');
    expect(init.headers.Authorization).toBe('Bearer sl.token');
    expect(JSON.parse(init.headers['Dropbox-API-Arg'])).toEqual({
      path: '/resumeBuilder/Acme/f.docx', mode: 'overwrite', autorename: true, mute: false,
    });
    expect(init.body).toBe(file);
  });

  it('throws a readable message, never the raw response body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve(JSON.stringify({ error_summary: 'path/insufficient_space/..' })),
    }) as jest.Mock;
    await expect(uploadToDropbox('sl.token', '/p', new Blob())).rejects.toThrow('Your Dropbox is full');
  });
});
