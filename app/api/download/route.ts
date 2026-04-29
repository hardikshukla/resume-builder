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
    .replace(/[^\w\s\-().]/g, '')  // only safe ASCII chars
    .replace(/\s+/g, '_')          // spaces → underscores
    .slice(0, 80)                  // cap length
    || 'document';                 // fallback if empty after sanitising
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

    const safeName = sanitizeFilename(body.data.resume.name);

    let blob: Blob;
    let filename: string;

    if (body.type === 'resume') {
      blob = await generateResumeDOCX(body.data.resume);
      filename = `${safeName}_Resume.docx`;
    } else {
      blob = await generateCoverLetterDOCX(
        body.data.coverLetter,
        body.data.resume,
        body.companyName
      );
      filename = `${safeName}_Cover_Letter.docx`;
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

