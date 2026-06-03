/**
 * __tests__/integration/parseResume.test.ts
 * Integration/unit tests for POST /api/parse-resume route handler.
 *
 * Run: npx jest __tests__/integration/parseResume.test.ts
 */

import { NextRequest } from 'next/server';
import { POST } from '../../app/api/parse-resume/route';
import mammoth from 'mammoth';

// ── Mock mammoth ─────────────────────────────────────────────────────────────
jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

const mockExtractRawText = mammoth.extractRawText as jest.MockedFunction<
  typeof mammoth.extractRawText
>;

// ── Helper to mock NextRequest with formData ──────────────────────────────────
function makeMockRequest(file: unknown): NextRequest {
  const req = new NextRequest('http://localhost/api/parse-resume', {
    method: 'POST',
  });
  req.formData = jest.fn().mockResolvedValue({
    get: (name: string) => (name === 'file' ? file : null),
  } as any);
  return req;
}

describe('POST /api/parse-resume', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 400 with ApiErrorResponse when no file is provided', async () => {
    const req = makeMockRequest(null);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
    expect(json.error.message).toBe('No file provided.');
  });

  it('returns 413 when file is too large (exceeds MAX_FILE_BYTES)', async () => {
    const mockFile = {
      name: 'large_resume.txt',
      size: 6 * 1024 * 1024, // 6 MB (max is 5 MB)
    };
    const req = makeMockRequest(mockFile);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(413);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('File is too large');
  });

  it('returns 200 with text content for valid .txt files', async () => {
    const mockFile = {
      name: 'my_resume.txt',
      size: 1024,
      text: jest.fn().mockResolvedValue('Resume text contents from text file.'),
    };
    const req = makeMockRequest(mockFile);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.text).toBe('Resume text contents from text file.');
    expect(json.filename).toBe('my_resume.txt');
  });

  it('returns 200 with extracted text for valid .docx files via mammoth', async () => {
    mockExtractRawText.mockResolvedValueOnce({
      value: 'Extracted text from docx file.',
      messages: [],
    });

    const mockFile = {
      name: 'resume.docx',
      size: 2048,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
    };
    const req = makeMockRequest(mockFile);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.text).toBe('Extracted text from docx file.');
    expect(json.filename).toBe('resume.docx');
    expect(mockExtractRawText).toHaveBeenCalled();
  });

  it('returns 422 with ApiErrorResponse when no text could be extracted from docx', async () => {
    mockExtractRawText.mockResolvedValueOnce({
      value: '   ',
      messages: [],
    });

    const mockFile = {
      name: 'empty.docx',
      size: 1024,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
    };
    const req = makeMockRequest(mockFile);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('No text could be extracted');
  });

  it('returns 400 with helpful warning for legacy .doc files', async () => {
    const mockFile = {
      name: 'old_resume.doc',
      size: 1024,
    };
    const req = makeMockRequest(mockFile);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('.doc (legacy format) is not supported');
  });

  it('returns 400 for unsupported file extensions like .pdf', async () => {
    const mockFile = {
      name: 'resume.pdf',
      size: 1024,
    };
    const req = makeMockRequest(mockFile);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('Unsupported file type');
  });

  it('returns 500 with FATAL ApiErrorResponse on unexpected mammoth errors', async () => {
    mockExtractRawText.mockRejectedValueOnce(new Error('Corrupted docx format'));

    const mockFile = {
      name: 'corrupted.docx',
      size: 1024,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
    };
    const req = makeMockRequest(mockFile);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('FATAL');
    expect(json.error.message).toBe('Corrupted docx format');
  });
});
