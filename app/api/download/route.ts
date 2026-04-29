import { NextRequest, NextResponse } from 'next/server';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { DownloadRequest } from '@/types';

/**
 * Sanitize a string for safe use in a Content-Disposition filename.
 * - Strips path traversal sequences (.. / \)
 * - Removes non-ASCII and control characters
 * - Collapses whitespace to underscores
 * - Caps length at 80 chars to avoid header size limits
 */
function sanitizeFilename(raw: string): string {
  return raw
    .replace(/\.\./g, '')          // block path traversal
    .replace(/[/\\]/g, '')         // block directory separators
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control chars
    .replace(/[^\w\s\-().+]/g, '') // only safe ASCII chars (now allowing '+')
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DownloadRequest;

    if (!body.data || !body.type) {
      return NextResponse.json(
        { error: 'type and data are required.' },
        { status: 400 }
      );
    }

    const baseName = toCamelCase(body.data.resume.name || 'candidate');
    const docType = body.type === 'resume' ? 'Resume' : 'CoverLetter';
    let rawFilename = `${baseName}${docType}`;

    if (body.companyName && body.companyName.trim()) {
      rawFilename += `+${toPascalCase(body.companyName)}`;
    }

    const safeName = sanitizeFilename(rawFilename);
    const filename = `${safeName}.docx`;

    let blob: Blob;

    if (body.type === 'resume') {
      blob = await generateResumeDOCX(body.data.resume);
    } else {
      blob = await generateCoverLetterDOCX(
        body.data.coverLetter,
        body.data.resume,
        body.companyName
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // Use both the legacy token form and RFC 5987 encoded form for maximum compatibility
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /download] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

