import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { ResumeData, CoverLetterData } from '@/types';
import { capitalizeName } from '@/lib/utils/string';
import { BODY_RUN, LETTER_PAGE, buildCandidateHeader, buildTextRunsWithBolding } from '@/lib/docx/shared';

/** A left-aligned paragraph holding a single run. */
function leftParagraph(text: string, spacing: { before: number; after: number }, bold?: boolean): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing,
    children: [new TextRun({ text, ...BODY_RUN, bold })],
  });
}

/**
 * Generates a cover letter DOCX blob.
 *
 * @param coverLetter  The cover letter data (subject + body).
 * @param resume       The candidate's resume data (name, contact info).
 * @param keywords     Terms to bold in the body paragraphs.
 */
export async function generateCoverLetterDOCX(
  coverLetter: CoverLetterData,
  resume: ResumeData,
  keywords: string[] = []
): Promise<Blob> {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Each blank-line-separated block of the body becomes a justified paragraph.
  const bodyParagraphs = coverLetter.body
    .split(/\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { before: 0, after: 120 },
      children: buildTextRunsWithBolding(text, keywords, BODY_RUN),
    }));

  const children: Paragraph[] = [
    ...buildCandidateHeader(resume.name, resume.contact),
    leftParagraph(today, { before: 120, after: 120 }),
    leftParagraph(`Subject: ${coverLetter.subject}`, { before: 120, after: 200 }, true),
    leftParagraph('Dear Hiring Manager,', { before: 0, after: 120 }),
    ...bodyParagraphs,
    leftParagraph('Sincerely,', { before: 200, after: 40 }),
    leftParagraph(resume.name ? capitalizeName(resume.name) : 'Candidate Name', { before: 200, after: 0 }, true),
  ];

  const doc = new Document({
    sections: [{ properties: { page: LETTER_PAGE }, children }],
  });

  return await Packer.toBlob(doc);
}
