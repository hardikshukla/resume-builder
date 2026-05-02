import { NextRequest, NextResponse } from 'next/server';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { DownloadRequest } from '@/types';

import { toCamelCase, toPascalCase, sanitizeFilename } from '@/lib/utils/string';

export async function POST(req: NextRequest): Promise<NextResponse> {
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
      if (!body.data.coverLetter) {
        return NextResponse.json(
          { error: 'Cover letter was not generated. Please generate the resume again.' },
          { status: 400 }
        );
      }
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

