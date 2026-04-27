import { NextRequest, NextResponse } from 'next/server';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { DownloadRequest } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DownloadRequest;

    if (!body.data || !body.type) {
      return NextResponse.json(
        { error: 'type and data are required.' },
        { status: 400 }
      );
    }

    let blob: Blob;
    let filename: string;

    if (body.type === 'resume') {
      blob = await generateResumeDOCX(body.data.resume);
      filename = `${body.data.resume.name.replace(/\s+/g, '_')}_Resume.docx`;
    } else {
      blob = await generateCoverLetterDOCX(
        body.data.coverLetter,
        body.data.resume,
        body.companyName
      );
      filename = `${body.data.resume.name.replace(/\s+/g, '_')}_Cover_Letter.docx`;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /download] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
