import { CoverLetterData, ResumeData } from '@/types';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from 'docx';

/**
 * Strips any salutation line the LLM might have written at the top of the body.
 * The generator adds its own canonical salutation, so we must avoid duplicates.
 * Matches variations like:
 *   "Dear Hiring Manager,"  /  "Dear Manager,"  /  "Dear [Name],"
 */
function stripLeadingSalutation(body: string): string {
  return body
    .split('\n')
    .filter((line) => !/^\s*dear\b/i.test(line.trim()))
    .join('\n')
    .replace(/^\n+/, ''); // drop any leading blank lines that remain
}

/**
 * Strips protocol, www, and trailing slash so URLs display cleanly
 * on the letter header, e.g. "linkedin.com/in/username".
 */
function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

export async function generateCoverLetterDOCX(
  coverLetter: CoverLetterData,
  resume: ResumeData,
  companyName?: string
): Promise<Blob> {
  const JUSTIFY = AlignmentType.BOTH;

  const children: Paragraph[] = [];

  // ── CANDIDATE NAME (centred, large — mirrors resume header) ────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: resume.name,
          font: 'Times New Roman',
          size: 32,
          bold: true,
        }),
      ],
    })
  );

  // ── CONTACT LINE (centred, pipe-separated — mirrors resume header) ─────────
  const contactParts: string[] = [];
  if (resume.contact?.email)    contactParts.push(resume.contact.email);
  if (resume.contact?.phone)    contactParts.push(resume.contact.phone);
  if (resume.contact?.linkedin) contactParts.push(shortenUrl(resume.contact.linkedin));
  if (resume.contact?.github)   contactParts.push(shortenUrl(resume.contact.github));
  if (resume.contact?.location) contactParts.push(resume.contact.location);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            font: 'Times New Roman',
            size: 18,
          }),
        ],
      })
    );
  }

  // ── HORIZONTAL RULE (border-bottom on an empty paragraph) ─────────────────
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '2C3E50', space: 1 },
      },
      spacing: { before: 0, after: 240 },
      children: [],
    })
  );

  // ── DATE ──────────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  children.push(
    new Paragraph({
      alignment: JUSTIFY,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: today, font: 'Times New Roman', size: 20 })],
    })
  );

  // ── SUBJECT ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: JUSTIFY,
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: `Re: ${coverLetter.subject}`,
          font: 'Times New Roman',
          size: 20,
          bold: true,
        }),
      ],
    })
  );

  // ── SALUTATION (canonical — never duplicated) ──────────────────────────────
  children.push(
    new Paragraph({
      alignment: JUSTIFY,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: `Dear Hiring Manager${companyName ? ' at ' + companyName : ''},`,
          font: 'Times New Roman',
          size: 20,
        }),
      ],
    })
  );

  // ── BODY (strip any LLM-written salutation to prevent duplication) ─────────
  const cleanBody = stripLeadingSalutation(coverLetter.body);
  const paragraphs = cleanBody
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const para of paragraphs) {
    children.push(
      new Paragraph({
        alignment: JUSTIFY,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: para, font: 'Times New Roman', size: 20 })],
      })
    );
  }

  // ── SIGN-OFF ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: JUSTIFY,
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({ text: 'Sincerely,', font: 'Times New Roman', size: 20 }),
      ],
    })
  );

  const titleCasedName = (resume.name || '')
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  children.push(
    new Paragraph({
      alignment: JUSTIFY,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: titleCasedName, font: 'Times New Roman', size: 20, bold: true }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
