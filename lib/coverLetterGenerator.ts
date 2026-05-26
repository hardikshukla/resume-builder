import { ResumeData, CoverLetterData } from '@/types';
import { capitalizeName } from '@/lib/utils/string';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from 'docx';

/**
 * Strips protocol, www, and trailing slash from a URL so it displays cleanly.
 */
function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/**
 * Shared candidate header function.
 */
function buildCandidateHeader(name?: string, contact?: ResumeData['contact']): Paragraph[] {
  const children: Paragraph[] = [];

  const formattedName = name ? name.toUpperCase() : 'FIRST LAST';

  // Name (Bold, 14pt, centered)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: formattedName,
          font: 'Times New Roman',
          size: 28, // 14pt (half-points)
          bold: true,
        }),
      ],
    })
  );

  // Contact line (11pt, centered, pipe-separated)
  const contactParts: string[] = [];
  if (contact?.email) contactParts.push(contact.email);
  if (contact?.phone) contactParts.push(contact.phone);
  if (contact?.linkedin) contactParts.push(shortenUrl(contact.linkedin));
  if (contact?.github) contactParts.push(shortenUrl(contact.github));
  if (contact?.location) contactParts.push(contact.location);

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: contactParts.join('  |  '),
          font: 'Times New Roman',
          size: 22, // 11pt
        }),
      ],
    })
  );

  // Thin horizontal rule
  children.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: 'A0A0A0',
          space: 1,
        },
      },
      spacing: { before: 0, after: 200 },
      children: [],
    })
  );

  return children;
}

/**
 * Generates a cover letter DOCX blob.
 *
 * @param coverLetter  The cover letter data (subject + body).
 * @param resume       The candidate's resume data (name, contact info).
 * @param companyName  Optional company name (currently reserved for future use).
 */
export async function generateCoverLetterDOCX(
  coverLetter: CoverLetterData,
  resume: ResumeData,
  companyName?: string
): Promise<Blob> {
  void companyName; // reserved for future personalisation

  const children: Paragraph[] = [];

  // Header
  children.push(...buildCandidateHeader(resume.name, resume.contact));

  // Date
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({ text: dateStr, font: 'Times New Roman', size: 22 }),
      ],
    })
  );

  // Subject line
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 200 },
      children: [
        new TextRun({
          text: `Subject: ${coverLetter.subject}`,
          font: 'Times New Roman',
          size: 22,
          bold: true,
        }),
      ],
    })
  );

  // Greeting
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({ text: 'Dear Hiring Manager,', font: 'Times New Roman', size: 22 }),
      ],
    })
  );

  // Body paragraphs
  for (const paraText of coverLetter.body.split(/\n+/)) {
    const trimmed = paraText.trim();
    if (!trimmed) continue;
    children.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({ text: trimmed, font: 'Times New Roman', size: 22 }),
        ],
      })
    );
  }

  // Sign off
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({ text: 'Sincerely,', font: 'Times New Roman', size: 22 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 0 },
      children: [
        new TextRun({
          text: resume.name ? capitalizeName(resume.name) : 'Candidate Name',
          font: 'Times New Roman',
          size: 22,
          bold: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1-inch margins
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
