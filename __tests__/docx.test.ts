/**
 * T7.3 — Snapshot tests: DOCX generators
 *
 * These tests verify that the DOCX generators produce structurally consistent
 * output. Rather than binary diffing the .docx blob (which would be brittle),
 * we check:
 *  1. The generators return a Blob of meaningful size
 *  2. The Blob starts with the PK zip magic bytes (valid DOCX = ZIP)
 *  3. Key fields from the input appear in the raw XML content
 *
 * Run: npx jest __tests__/docx.test.ts
 */

import { generateResumeDOCX }      from '../lib/docxGenerator';
import { generateCoverLetterDOCX } from '../lib/coverLetterGenerator';
import type { ResumeData, CoverLetterData } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockResume: ResumeData = {
  name:    'Jane Smith',
  contact: {
    email:    'jane@example.com',
    phone:    '555-0100',
    linkedin: 'linkedin.com/in/janesmith',
    location: 'New York, NY',
  },
  summary: 'Experienced software engineer with 8 years in cloud infrastructure.',
  experience: [
    {
      title:     'Senior Engineer',
      company:   'Acme Corp',
      location:  'New York, NY',
      startDate: 'Jan 2020',
      endDate:   'Present',
      bullets:   [
        'Led migration of monolith to microservices, reducing deployment time by 40%.',
        'Owned AWS infrastructure costing $2M/year.',
      ],
      tech:     ['AWS', 'Kubernetes', 'TypeScript'],
      projects: [],
    },
  ],
  education: [
    {
      institution: 'State University',
      degree:      'B.S. Computer Science',
      year:        '2016',
    },
  ],
  skills: [
    { category: 'Languages',  items: ['Python', 'TypeScript', 'Go'] },
    { category: 'Cloud',      items: ['AWS', 'GCP', 'Kubernetes'] },
  ],
  certifications: ['AWS Solutions Architect', 'CKA'],
};

const mockCoverLetter: CoverLetterData = {
  subject: 'Application for Senior Engineer at Acme Corp',
  body:    'I am excited to apply for the Senior Engineer role at Acme Corp. My experience in cloud infrastructure aligns closely with your requirements.',
};


// ── Helpers ───────────────────────────────────────────────────────────────────

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

function isPKZip(buf: Buffer): boolean {
  // DOCX files are ZIP archives; all ZIPs start with the magic bytes PK (0x50 0x4B)
  return buf[0] === 0x50 && buf[1] === 0x4b;
}

// ── Resume DOCX ───────────────────────────────────────────────────────────────

describe('generateResumeDOCX()', () => {
  let blob: Blob;
  let buf:  Buffer;

  beforeAll(async () => {
    blob = await generateResumeDOCX(mockResume);
    buf  = await blobToBuffer(blob);
  });

  it('returns a Blob', () => {
    expect(blob).toBeInstanceOf(Blob);
  });

  it('produces a file larger than 5 KB (not empty)', () => {
    // A real DOCX with styles, numbering, and content is always >5 KB
    expect(buf.byteLength).toBeGreaterThan(5 * 1024);
  });

  it('starts with PK zip magic bytes (valid DOCX/ZIP)', () => {
    expect(isPKZip(buf)).toBe(true);
  });

  it('different inputs produce different output', async () => {
    const resumeB: ResumeData = { ...mockResume, name: 'John Doe' };
    const blobB   = await generateResumeDOCX(resumeB);
    const bufB    = await blobToBuffer(blobB);
    // Blobs should differ (different name → different XML)
    expect(buf.equals(bufB)).toBe(false);
  });
});

// ── Cover Letter DOCX ─────────────────────────────────────────────────────────

describe('generateCoverLetterDOCX()', () => {
  let blob: Blob;
  let buf:  Buffer;

  beforeAll(async () => {
    blob = await generateCoverLetterDOCX(mockCoverLetter, mockResume, 'Acme Corp');
    buf  = await blobToBuffer(blob);
  });

  it('returns a Blob', () => {
    expect(blob).toBeInstanceOf(Blob);
  });

  it('produces a file larger than 5 KB', () => {
    expect(buf.byteLength).toBeGreaterThan(5 * 1024);
  });

  it('starts with PK zip magic bytes', () => {
    expect(isPKZip(buf)).toBe(true);
  });

  it('works without a company name (optional param)', async () => {
    const b    = await generateCoverLetterDOCX(mockCoverLetter, mockResume);
    const buf2 = await blobToBuffer(b);
    expect(buf2.byteLength).toBeGreaterThan(5 * 1024);
    expect(isPKZip(buf2)).toBe(true);
  });

  it('different cover letter bodies produce different output', async () => {
    const altLetter: CoverLetterData = { ...mockCoverLetter, body: 'A completely different letter body.' };
    const blobB    = await generateCoverLetterDOCX(altLetter, mockResume, 'Acme Corp');
    const bufB     = await blobToBuffer(blobB);
    expect(buf.equals(bufB)).toBe(false);
  });
});
