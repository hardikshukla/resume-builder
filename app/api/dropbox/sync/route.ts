import { NextRequest, NextResponse } from 'next/server';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { DropboxSyncRequest } from '@/types';

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/\.\./g, '')          // block path traversal
    .replace(/[/\\]/g, '')         // block directory separators
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control chars
    .replace(/[^\w\s\-().+]/g, '') // only safe ASCII chars (allowing '+')
    .replace(/\s+/g, '_')          // spaces → underscores
    .slice(0, 80)                  // cap length
    || 'document';                 // fallback if empty after sanitising
}

function toCamelCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function getTimestampStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    full: `${year}${month}${day}_${hours}${minutes}${seconds}`
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DropboxSyncRequest;

    if (!body.resumeData || !body.dropboxToken) {
      return NextResponse.json(
        { error: 'resumeData and dropboxToken are required.' },
        { status: 400 }
      );
    }

    // Basic token sanity — Dropbox PATs start with "sl."
    if (!body.dropboxToken.startsWith('sl.')) {
      return NextResponse.json(
        { error: 'Invalid Dropbox token format. Personal Access Tokens start with "sl.". Generate one at https://www.dropbox.com/developers/apps' },
        { status: 400 }
      );
    }

    const { resumeData, companyName, dropboxToken } = body;
    const { resume, coverLetter, gapAnalysis } = resumeData;

    // 1. Determine Company Name (User Input > AI Extracted)
    const rawCompany = companyName?.trim() || gapAnalysis.extractedCompanyName?.trim();
    
    // 2. Determine Folder Path (never allow double-slashes)
    const ts = getTimestampStr();
    let folderPath = `/resumeBuilder/general/${ts.date}`;
    if (rawCompany) {
      folderPath = `/resumeBuilder/${toCamelCase(rawCompany)}`.replace(/\/+/g, '/');
    }

    // 3. Determine Filenames
    const baseName = toCamelCase(resume.name || 'candidate');
    const companySuffix = rawCompany ? `+${toPascalCase(rawCompany)}` : '';
    
    const resumeFilename = sanitizeFilename(`${baseName}Resume${companySuffix}_${ts.full}`) + '.docx';
    const coverFilename = sanitizeFilename(`${baseName}CoverLetter${companySuffix}_${ts.full}`) + '.docx';

    // 4. Generate DOCX Blobs in-memory
    const resumeBlob = await generateResumeDOCX(resume);
    const coverBlob = await generateCoverLetterDOCX(coverLetter, resume, rawCompany);

    console.log('[dropbox/sync] Upload plan:', {
      folderPath,
      resumeFilename,
      coverFilename,
      tokenPrefix: dropboxToken.slice(0, 12) + '...',
      resumeBytes: (await resumeBlob.arrayBuffer()).byteLength,
      coverBytes:  (await coverBlob.arrayBuffer()).byteLength,
    });

    // 5. Upload to Dropbox
    const uploadToDropbox = async (blob: Blob, filename: string) => {
      const dbxArgs = {
        path: `${folderPath}/${filename}`,
        mode: { '.tag': 'add' },      // Dropbox v2 requires tagged union, not plain string
        autorename: true,
        mute: false,
        strict_conflict: false
      };

      // Dropbox-API-Arg must be ASCII-safe — encode non-ASCII chars
      const argHeader = JSON.stringify(dbxArgs)
        .replace(/[^\x20-\x7E]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

      console.log('[dropbox/sync] Uploading:', filename, '\n  arg:', argHeader);

      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dropboxToken}`,
          'Dropbox-API-Arg': argHeader,
          'Content-Type': 'application/octet-stream'
        },
        body: await blob.arrayBuffer()
      });

      if (!res.ok) {
        const rawBody = await res.text();
        // Log everything: status, every response header, full body
        const respHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => { respHeaders[k] = v; });
        console.error('[dropbox/sync] Upload failed:', {
          file: filename,
          status: res.status,
          headers: respHeaders,
          body: rawBody,
          argHeader,
        });

        let errMsg = `Dropbox ${res.status}`;
        let errDetail = rawBody;
        try {
          const json = JSON.parse(rawBody);
          const tag     = json?.error?.['.tag'] ?? '';
          const summary = json?.error_summary ?? '';
          const scope   = json?.error?.required_scope ?? '';

          if (tag === 'missing_scope') {
            errMsg = `Dropbox token is missing the "${scope || 'files.content.write'}" permission. ` +
              `Go to dropbox.com/developers/apps → your app → Permissions tab → enable "${scope || 'files.content.write'}" → ` +
              `then regenerate your access token under the Settings tab.`;
          } else {
            errMsg = `Dropbox ${res.status}: ${summary || tag || 'unknown error'}`;
          }
          errDetail = JSON.stringify(json, null, 2);
        } catch { /* body was not JSON — e.g. HTML error page */ }

        throw Object.assign(new Error(errMsg), { detail: errDetail, status: res.status, file: filename });
      }
    };

    // Upload both files simultaneously
    await Promise.all([
      uploadToDropbox(resumeBlob, resumeFilename),
      uploadToDropbox(coverBlob, coverFilename)
    ]);

    return NextResponse.json({ success: true, folder: folderPath });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail  = (err as any)?.detail ?? null;
    console.error('[API /dropbox/sync] Error:', message, detail ?? '');
    return NextResponse.json(
      { error: message, detail },
      { status: 500 }
    );
  }
}
