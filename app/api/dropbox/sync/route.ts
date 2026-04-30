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

    const { resumeData, companyName, dropboxToken } = body;
    const { resume, coverLetter, gapAnalysis } = resumeData;

    // 1. Determine Company Name (User Input > AI Extracted)
    const rawCompany = companyName?.trim() || gapAnalysis.extractedCompanyName?.trim();
    
    // 2. Determine Folder Path
    const ts = getTimestampStr();
    let folderPath = '/resumeBuilder/general/' + ts.date;
    if (rawCompany) {
      folderPath = `/resumeBuilder/${toCamelCase(rawCompany)}`;
    }

    // 3. Determine Filenames
    const baseName = toCamelCase(resume.name || 'candidate');
    const companySuffix = rawCompany ? `+${toPascalCase(rawCompany)}` : '';
    
    const resumeFilename = sanitizeFilename(`${baseName}Resume${companySuffix}_${ts.full}`) + '.docx';
    const coverFilename = sanitizeFilename(`${baseName}CoverLetter${companySuffix}_${ts.full}`) + '.docx';

    // 4. Generate DOCX Blobs in-memory
    const resumeBlob = await generateResumeDOCX(resume);
    const coverBlob = await generateCoverLetterDOCX(coverLetter, resume, rawCompany);

    // 5. Upload to Dropbox
    const uploadToDropbox = async (blob: Blob, filename: string) => {
      const dbxArgs = {
        path: `${folderPath}/${filename}`,
        mode: 'add',
        autorename: true,
        mute: false,
        strict_conflict: false
      };

      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dropboxToken}`,
          'Dropbox-API-Arg': JSON.stringify(dbxArgs),
          'Content-Type': 'application/octet-stream'
        },
        body: await blob.arrayBuffer()
      });

      if (!res.ok) {
        let errMsg = `Dropbox API error: ${res.status}`;
        try {
          const json = await res.json();
          errMsg = json.error_summary || errMsg;
        } catch { /* ignore JSON parse error */ }
        throw new Error(errMsg);
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
    console.error('[API /dropbox/sync] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
