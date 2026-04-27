import { CoverLetterData, ResumeData } from '@/types';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

export async function generateCoverLetterDOCX(
  coverLetter: CoverLetterData,
  resume: ResumeData,
  companyName?: string
): Promise<Blob> {
  const children: Paragraph[] = [];

  // ── DATE ───────────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  children.push(
    new Paragraph({
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: today, font: 'Arial', size: 20 })],
    })
  );

  // ── SENDER INFO ────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({ text: resume.name, font: 'Arial', size: 20, bold: true }),
      ],
    })
  );

  if (resume.contact.email) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: resume.contact.email,
            font: 'Arial',
            size: 20,
          }),
        ],
      })
    );
  }

  if (resume.contact.phone) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: resume.contact.phone,
            font: 'Arial',
            size: 20,
          }),
        ],
      })
    );
  }

  if (resume.contact.linkedin) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: resume.contact.linkedin,
            font: 'Arial',
            size: 20,
          }),
        ],
      })
    );
  }

  // ── SUBJECT ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: `Re: ${coverLetter.subject}`,
          font: 'Arial',
          size: 20,
          bold: true,
        }),
      ],
    })
  );

  // ── SALUTATION ─────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: `Dear Hiring Manager${companyName ? ' at ' + companyName : ''},`,
          font: 'Arial',
          size: 20,
        }),
      ],
    })
  );

  // ── BODY ───────────────────────────────────────────────────────────────────
  const paragraphs = coverLetter.body
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const para of paragraphs) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: para, font: 'Arial', size: 20 })],
      })
    );
  }

  // ── SIGN-OFF ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 160, after: 40 },
      children: [
        new TextRun({ text: 'Sincerely,', font: 'Arial', size: 20 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: resume.name, font: 'Arial', size: 20, bold: true }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
