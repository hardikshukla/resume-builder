import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { MAX_FILE_BYTES } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 5 MB.` },
        { status: 413 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();

    // ── Plain text ────────────────────────────────────────────────────────────
    if (ext === 'txt') {
      const text = await file.text();
      return NextResponse.json({ text, filename: file.name });
    }

    // ── DOCX ──────────────────────────────────────────────────────────────────
    if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });

      if (!result.value.trim()) {
        return NextResponse.json(
          {
            error:
              'No text could be extracted. The file may be image-based or password-protected.',
          },
          { status: 422 }
        );
      }

      return NextResponse.json({ text: result.value, filename: file.name });
    }

    // ── Legacy .doc ───────────────────────────────────────────────────────────
    if (ext === 'doc') {
      return NextResponse.json(
        {
          error:
            '.doc (legacy format) is not supported. Open the file in Word and Save As → .docx, then re-upload.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `Unsupported file type: .${ext}. Please upload a .docx or .txt file.` },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse file.';
    console.error('[API /parse-resume]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
