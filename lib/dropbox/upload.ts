/**
 * upload.ts — saving an export straight from the browser to the user's
 * Dropbox. The token never passes through our server for uploads.
 */
import { toDropboxUploadErrorMessage } from '@/lib/utils/dropboxError';

const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';

/**
 * Where an export is saved: /resumeBuilder/<Company>/<file>. The company is
 * reduced to letters, digits and underscores so it is always a valid folder.
 */
export function dropboxExportPath(companyName: string, filename: string): string {
  const folder = (companyName || 'Tailored').replace(/[^a-z0-9]/gi, '_');
  return `/resumeBuilder/${folder}/${filename}`;
}

/**
 * Uploads `file` to `path`, overwriting any earlier export of the same name.
 * Throws an Error with a user-facing message on failure.
 */
export async function uploadToDropbox(token: string, path: string, file: Blob): Promise<void> {
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      // Trimmed exactly as the token check trims it, so a token that passed
      // the check is not rejected here over surrounding whitespace.
      Authorization: `Bearer ${token.trim()}`,
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: true, mute: false }),
      'Content-Type': 'application/octet-stream',
    },
    body: file,
  });
  // Dropbox answers with JSON jargon; translate it before it reaches the banner.
  if (!res.ok) throw new Error(toDropboxUploadErrorMessage(await res.text()));
}
